import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { MatchResult, OpportunityForMatching, ProfileFactForMatching } from '../db/matches';
import { MATCH_CRITERIA_TEXT, RANK_PROMPT_VERSION } from './config';

export const PROMPT_VERSION = RANK_PROMPT_VERSION;

const MODEL = 'claude-sonnet-5';
export const BATCH_SIZE = 20; // per prompts/rank.v1.md's stated batch contract
const MAX_DESCRIPTION_CHARS = 2000; // cost guardrail, not a content decision

const PROMPT_PATH = fileURLToPath(new URL('../../prompts/rank.v1.md', import.meta.url));

type RankOutputRow = {
  opportunity_id: string;
  score: number;
  eligible: boolean;
  reasoning: string;
  blockers: string[];
};

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

function renderPrompt(template: string, profileSummary: string, batch: OpportunityForMatching[]): string {
  return template
    .replace('{{MATCH_CRITERIA}}', MATCH_CRITERIA_TEXT)
    .replace('{{PROFILE_SUMMARY}}', profileSummary)
    .replace('{{POSTINGS_JSON}}', JSON.stringify(buildPostingsPayload(batch), null, 2));
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
  const prompt = renderPrompt(template, buildProfileSummary(facts), batch);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [SUBMIT_RANKINGS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_rankings' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) {
    throw new Error('rankBatch: model did not call submit_rankings');
  }

  const input = toolUse.input as { rankings?: unknown };
  if (!Array.isArray(input.rankings)) {
    throw new Error('rankBatch: submit_rankings input missing a rankings array');
  }

  const batchIds = new Set(batch.map((o) => o.id));
  const results: MatchResult[] = [];
  for (const row of input.rankings) {
    if (!isRankOutputRow(row) || !batchIds.has(row.opportunity_id)) continue;
    results.push({
      opportunityId: row.opportunity_id,
      ruleScore: 100,
      llmScore: Math.max(0, Math.min(100, Math.round(row.score))),
      eligible: row.eligible,
      reasoning: row.reasoning,
      blockers: row.blockers,
    });
  }
  return results;
}
