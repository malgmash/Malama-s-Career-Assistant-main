import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { MatchResult, OpportunityForMatching, ProfileFactForMatching } from '../db/matches';
import { MATCH_CRITERIA_TEXT, RANK_PROMPT_VERSION } from './config';

export const PROMPT_VERSION = RANK_PROMPT_VERSION;

const MODEL = 'claude-sonnet-5';
export const BATCH_SIZE = 20; // per prompts/rank.v1.md's stated batch contract
const MAX_DESCRIPTION_CHARS = 2000; // cost guardrail, not a content decision

const PROMPT_PATH = fileURLToPath(new URL('../../prompts/rank.v2.md', import.meta.url));

type RankOutputRow = {
  opportunity_id: string;
  score: number;
  eligible: boolean;
  reasoning: string;
  blockers: string[];
};

// Observed in practice: on some batches the model puts the array as a
// JSON-encoded string under `rankings` instead of a real nested array
// (still schema-conformant per the tool's declared type, `string` was never
// promised, but Anthropic's tool-use doesn't hard-enforce nested array
// types the same way a strict JSON Schema validator would). Handle both
// shapes rather than rejecting a batch outright for it.
function extractRankings(input: unknown): unknown[] | null {
  if (typeof input !== 'object' || input === null) return null;
  const rankings = (input as { rankings?: unknown }).rankings;
  if (Array.isArray(rankings)) return rankings;
  if (typeof rankings === 'string') {
    try {
      const parsed = JSON.parse(rankings);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray((parsed as { rankings?: unknown })?.rankings)) {
        return (parsed as { rankings: unknown[] }).rankings;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function isRankOutputRow(value: unknown): value is RankOutputRow {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.opportunity_id === 'string' &&
    typeof v.score === 'number' &&
    typeof v.eligible === 'boolean' &&
    typeof v.reasoning === 'string' &&
    Array.isArray(v.blockers) &&
    v.blockers.every((b) => typeof b === 'string')
  );
}

function buildProfileSummary(facts: ProfileFactForMatching[]): string {
  if (facts.length === 0) {
    return 'No profile facts on record yet. Do not assume any skill or experience — treat every requirement as unsupported.';
  }
  return facts.map((f) => `- [${f.category}, ${f.strength}] ${f.claim}`).join('\n');
}

function buildPostingsPayload(batch: OpportunityForMatching[]) {
  return batch.map((o) => ({
    opportunity_id: o.id,
    kind: o.kind,
    title: o.title,
    org: o.org,
    location: o.location,
    deadline: o.deadline,
    tags: o.tags,
    description: o.description ? o.description.slice(0, MAX_DESCRIPTION_CHARS) : null,
  }));
}

async function loadPromptTemplate(): Promise<string> {
  return readFile(PROMPT_PATH, 'utf8');
}

// Split into a static prefix (criteria + profile summary + fixed
// instructions — identical across every batch in a run, and across runs
// until facts or criteria change) and a dynamic suffix (just this batch's
// postings). The prefix is marked as a prompt-cache breakpoint: the first
// call in a run pays a small premium to write it, every subsequent batch
// in that run reads it back at roughly a tenth of the normal input price.
// Splitting on the placeholder keeps this in sync with the template file
// automatically — no separate copy of the wording to drift out of date.
function renderPromptParts(
  template: string,
  profileSummary: string,
  batch: OpportunityForMatching[],
): { prefix: string; suffix: string } {
  const [prefixTemplate, suffixTemplate] = template.split('{{POSTINGS_JSON}}');
  const prefix = prefixTemplate
    .replace('{{MATCH_CRITERIA}}', MATCH_CRITERIA_TEXT)
    .replace('{{PROFILE_SUMMARY}}', profileSummary);
  const suffix = JSON.stringify(buildPostingsPayload(batch), null, 2) + suffixTemplate;
  return { prefix, suffix };
}

// Forcing a tool call gets a schema-conformant JSON object back directly
// (response.content has a tool_use block with a pre-parsed `input`), instead
// of asking the model to follow a "no prose, no code fences" instruction in
// free text and hoping it complies — which it did not, in practice.
const SUBMIT_RANKINGS_TOOL: Anthropic.Tool = {
  name: 'submit_rankings',
  description: 'Submit the eligibility and fit ranking for every posting in POSTINGS, in the same order.',
  input_schema: {
    type: 'object',
    properties: {
      rankings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            opportunity_id: { type: 'string' },
            score: { type: 'number' },
            eligible: { type: 'boolean' },
            reasoning: { type: 'string' },
            blockers: { type: 'array', items: { type: 'string' } },
          },
          required: ['opportunity_id', 'score', 'eligible', 'reasoning', 'blockers'],
        },
      },
    },
    required: ['rankings'],
  },
};

// Batches survivors of Pass 1 (rules.ts) through the Anthropic API per
// prompts/rank.v1.md. Returns one MatchResult per posting the model
// returned a valid row for — an invalid or missing row for a posting is
// skipped, not defaulted, per docs/ARCHITECTURE.md's "reject rows that
// fail" boundary. ruleScore is always 100 here since only rule-pass rows
// reach this function.
export async function rankBatch(
  batch: OpportunityForMatching[],
  facts: ProfileFactForMatching[],
  client: Anthropic = new Anthropic(),
): Promise<MatchResult[]> {
  if (batch.length === 0) return [];
  if (batch.length > BATCH_SIZE) {
    throw new Error(`rankBatch: batch of ${batch.length} exceeds prompts/rank.v1.md's limit of ${BATCH_SIZE}`);
  }

  const template = await loadPromptTemplate();
  const { prefix, suffix } = renderPromptParts(template, buildProfileSummary(facts), batch);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    tools: [SUBMIT_RANKINGS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_rankings' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prefix, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: suffix },
        ],
      },
    ],
  });

  // Visible evidence the cache is actually being hit, not just assumed —
  // cache_read_input_tokens > 0 means this batch paid the ~10% rate for
  // the criteria+profile prefix instead of the full input price.
  console.log(
    `rankBatch usage: input=${response.usage.input_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_write=${response.usage.cache_creation_input_tokens ?? 0} output=${response.usage.output_tokens}`,
  );

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) {
    throw new Error('rankBatch: model did not call submit_rankings');
  }

  const rankings = extractRankings(toolUse.input);
  if (!rankings) {
    throw new Error('rankBatch: submit_rankings input missing a rankings array');
  }

  const batchIds = new Set(batch.map((o) => o.id));
  const results: MatchResult[] = [];
  for (const row of rankings) {
    if (!isRankOutputRow(row)) {
      console.log('rankBatch: row failed isRankOutputRow', JSON.stringify(row).slice(0, 300));
      continue;
    }
    if (!batchIds.has(row.opportunity_id)) {
      console.log('rankBatch: opportunity_id not in batch', row.opportunity_id, 'batch ids sample:', [...batchIds].slice(0, 3));
      continue;
    }
    results.push({
      opportunityId: row.opportunity_id,
      ruleScore: 100,
      llmScore: Math.max(0, Math.min(100, Math.round(row.score))),
      eligible: row.eligible,
      reasoning: row.reasoning,
      blockers: row.blockers,
    });
  }
  console.log(`rankBatch: batch=${batch.length} rankings=${rankings.length} results=${results.length}`);
  return results;
}
