import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Requirement } from './requirements';

export const COVERAGE_PROMPT_VERSION = 'coverage.v1';

const MODEL = 'claude-sonnet-5';
const PROMPT_PATH = fileURLToPath(new URL('../../prompts/coverage.v1.md', import.meta.url));

export type CoverageResult = {
  requirementId: number;
  met: boolean;
  proof: string | null;
};

type CoverageOutputRow = { requirement_id: number; met: boolean; proof: string | null };

function isCoverageOutputRow(value: unknown): value is CoverageOutputRow {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.requirement_id === 'number' &&
    typeof v.met === 'boolean' &&
    (v.proof === null || typeof v.proof === 'string')
  );
}

// Same Anthropic tool-use quirk as lib/scoring/rank.ts — the array
// sometimes arrives as a JSON string instead of a real nested array.
function extractCoverageList(input: unknown): unknown[] | null {
  if (typeof input !== 'object' || input === null) return null;
  const coverage = (input as { coverage?: unknown }).coverage;
  if (Array.isArray(coverage)) return coverage;
  if (typeof coverage === 'string') {
    try {
      const parsed = JSON.parse(coverage);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray((parsed as { coverage?: unknown })?.coverage)) {
        return (parsed as { coverage: unknown[] }).coverage;
      }
    } catch {
      return null;
    }
  }
  return null;
}

const SUBMIT_COVERAGE_TOOL: Anthropic.Tool = {
  name: 'submit_coverage',
  description: 'Submit whether each requirement is met by the resume, with quoted proof where met.',
  input_schema: {
    type: 'object',
    properties: {
      coverage: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            requirement_id: { type: 'number' },
            met: { type: 'boolean' },
            proof: { type: ['string', 'null'] },
          },
          required: ['requirement_id', 'met', 'proof'],
        },
      },
    },
    required: ['coverage'],
  },
};

async function callCoverage(
  requirements: Array<Requirement & { id: number }>,
  resumeText: string,
  client: Anthropic,
): Promise<CoverageOutputRow[]> {
  const template = await readFile(PROMPT_PATH, 'utf8');
  const prompt = template
    .replace('{{REQUIREMENTS_JSON}}', JSON.stringify(requirements, null, 2))
    .replace('{{RESUME_TEXT}}', resumeText);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [SUBMIT_COVERAGE_TOOL],
    tool_choice: { type: 'tool', name: 'submit_coverage' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) throw new Error('checkCoverage: model did not call submit_coverage');

  const rows = extractCoverageList(toolUse.input);
  if (!rows) throw new Error('checkCoverage: submit_coverage input missing a coverage array');

  return rows.filter(isCoverageOutputRow);
}

function isInvalid(row: CoverageOutputRow): boolean {
  return row.met === true && row.proof === null;
}

// docs/PROMPTS.md's coverage.vN rule: "met: true with proof: null is
// invalid... Reject and retry once." One retry of the whole call, then any
// row still invalid is downgraded to not-met rather than trusted — a
// requirement counted met with no quote is a failed extraction, not a pass.
export async function checkCoverage(
  requirements: Requirement[],
  resumeText: string,
  client: Anthropic = new Anthropic(),
): Promise<CoverageResult[]> {
  const withIds = requirements.map((r, id) => ({ ...r, id }));

  let rows = await callCoverage(withIds, resumeText, client);
  if (rows.some(isInvalid)) {
    rows = await callCoverage(withIds, resumeText, client);
  }

  return withIds.map((req) => {
    const row = rows.find((r) => r.requirement_id === req.id);
    if (!row || isInvalid(row)) {
      return { requirementId: req.id, met: false, proof: null };
    }
    return { requirementId: row.requirement_id, met: row.met, proof: row.proof };
  });
}
