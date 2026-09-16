import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const EXTRACT_REQUIREMENTS_PROMPT_VERSION = 'extract-requirements.v1';

const MODEL = 'claude-sonnet-5';
const PROMPT_PATH = fileURLToPath(new URL('../../prompts/extract-requirements.v1.md', import.meta.url));

export type Requirement = {
  text: string;
  kind: 'required' | 'preferred';
  category: string;
};

function isRequirement(value: unknown): value is Requirement {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.text === 'string' &&
    (v.kind === 'required' || v.kind === 'preferred') &&
    typeof v.category === 'string'
  );
}

// See lib/scoring/rank.ts's extractRankings for why this handles a
// stringified array — the same Anthropic tool-use quirk applies here.
function extractRequirementsList(input: unknown): unknown[] | null {
  if (typeof input !== 'object' || input === null) return null;
  const requirements = (input as { requirements?: unknown }).requirements;
  if (Array.isArray(requirements)) return requirements;
  if (typeof requirements === 'string') {
    try {
      const parsed = JSON.parse(requirements);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray((parsed as { requirements?: unknown })?.requirements)) {
        return (parsed as { requirements: unknown[] }).requirements;
      }
    } catch {
      return null;
    }
  }
  return null;
}

const SUBMIT_REQUIREMENTS_TOOL: Anthropic.Tool = {
  name: 'submit_requirements',
  description: 'Submit every distinct requirement extracted from the posting.',
  input_schema: {
    type: 'object',
    properties: {
      requirements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            kind: { type: 'string', enum: ['required', 'preferred'] },
            category: { type: 'string' },
          },
          required: ['text', 'kind', 'category'],
        },
      },
    },
    required: ['requirements'],
  },
};

export async function extractRequirements(
  postingText: string,
  client: Anthropic = new Anthropic(),
): Promise<Requirement[]> {
  const template = await readFile(PROMPT_PATH, 'utf8');
  const prompt = template.replace('{{POSTING_TEXT}}', postingText);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [SUBMIT_REQUIREMENTS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_requirements' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) throw new Error('extractRequirements: model did not call submit_requirements');

  const requirements = extractRequirementsList(toolUse.input);
  if (!requirements) throw new Error('extractRequirements: submit_requirements input missing a requirements array');

  return requirements.filter(isRequirement);
}
