import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ProfileFactWithId } from '../db/documents';

export const SHORT_ANSWER_PROMPT_VERSION = 'short-answer.v1';

const MODEL = 'claude-sonnet-5';
const PROMPT_PATH = fileURLToPath(new URL('../../prompts/short-answer.v1.md', import.meta.url));

export type ShortAnswerResult = {
  answer: string;
  factIds: string[];
  gaps: string[];
};

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

const SUBMIT_ANSWER_TOOL: Anthropic.Tool = {
  name: 'submit_answer',
  description: 'Submit the drafted answer, cited facts, and gaps.',
  input_schema: {
    type: 'object',
    properties: {
      answer: { type: 'string' },
      fact_ids: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
    },
    required: ['answer', 'fact_ids', 'gaps'],
  },
};

export async function draftShortAnswer(
  postingText: string,
  question: string,
  facts: ProfileFactWithId[],
  client: Anthropic = new Anthropic(),
): Promise<ShortAnswerResult> {
  const template = await readFile(PROMPT_PATH, 'utf8');
  const prompt = template
    .replace('{{POSTING_TEXT}}', postingText)
    .replace('{{FACTS_JSON}}', JSON.stringify(facts, null, 2))
    .replace('{{QUESTION}}', question);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [SUBMIT_ANSWER_TOOL],
    tool_choice: { type: 'tool', name: 'submit_answer' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('draftShortAnswer: model did not call submit_answer');

  const input = toolUse.input as Record<string, unknown>;
  if (typeof input.answer !== 'string' || input.answer.length === 0) {
    throw new Error('draftShortAnswer: no answer text returned');
  }

  const validFactIds = new Set(facts.map((f) => f.id));
  const rawFactIds = (asArray(input.fact_ids, 'fact_ids') ?? []).filter((id): id is string => typeof id === 'string');
  const factIds = [...new Set(rawFactIds.filter((id) => validFactIds.has(id)))];

  const gaps = (asArray(input.gaps, 'gaps') ?? []).filter((g): g is string => typeof g === 'string');

  return { answer: input.answer, factIds, gaps };
}
