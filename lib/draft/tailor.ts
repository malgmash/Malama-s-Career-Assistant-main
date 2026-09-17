import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ProfileFactWithId } from '../db/documents';

export const TAILOR_PROMPT_VERSION = 'tailor.v1';

const MODEL = 'claude-sonnet-5';
const PROMPT_PATH = fileURLToPath(new URL('../../prompts/tailor.v1.md', import.meta.url));

export type TailorResult = {
  bullets: Array<{ text: string; factIds: string[] }>;
  factIds: string[]; // union of every bullet's factIds
  gaps: string[];
  keywordsUsed: string[];
};

type BulletRow = { text: string; fact_ids: string[] };

function isBulletRow(value: unknown): value is BulletRow {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.text === 'string' && Array.isArray(v.fact_ids) && v.fact_ids.every((f) => typeof f === 'string');
}

// Same tool-use quirk as lib/scoring/rank.ts — arrays sometimes arrive as
// a JSON-encoded string instead of a real nested array.
function asArray(value: unknown, key: string): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray((parsed as Record<string, unknown>)?.[key])) return (parsed as Record<string, unknown>)[key] as unknown[];
    } catch {
      return null;
    }
  }
  return null;
}

const SUBMIT_DRAFT_TOOL: Anthropic.Tool = {
  name: 'submit_draft',
  description: 'Submit the tailored bullets, cited facts, gaps, and matched keywords.',
  input_schema: {
    type: 'object',
    properties: {
      bullets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            fact_ids: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'fact_ids'],
        },
      },
      gaps: { type: 'array', items: { type: 'string' } },
      keywords_used: { type: 'array', items: { type: 'string' } },
    },
    required: ['bullets', 'gaps', 'keywords_used'],
  },
};

export async function draftBullets(
  postingText: string,
  facts: ProfileFactWithId[],
  client: Anthropic = new Anthropic(),
): Promise<TailorResult> {
  const template = await readFile(PROMPT_PATH, 'utf8');
  const prompt = template
    .replace('{{POSTING_TEXT}}', postingText)
    .replace('{{FACTS_JSON}}', JSON.stringify(facts, null, 2));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [SUBMIT_DRAFT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_draft' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('draftBullets: model did not call submit_draft');

  const input = toolUse.input as Record<string, unknown>;
  const rawBullets = asArray(input.bullets, 'bullets') ?? [];
  const bullets = rawBullets.filter(isBulletRow).map((b) => ({ text: b.text, factIds: b.fact_ids }));
  if (bullets.length === 0) throw new Error('draftBullets: no valid bullets returned');

  const validFactIds = new Set(facts.map((f) => f.id));
  const factIds = [...new Set(bullets.flatMap((b) => b.factIds).filter((id) => validFactIds.has(id)))];

  const gaps = (asArray(input.gaps, 'gaps') ?? []).filter((g): g is string => typeof g === 'string');
  const keywordsUsed = (asArray(input.keywords_used, 'keywords_used') ?? []).filter(
    (k): k is string => typeof k === 'string',
  );

  return { bullets, factIds, gaps, keywordsUsed };
}
