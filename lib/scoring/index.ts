import Anthropic from '@anthropic-ai/sdk';
import { getCandidateOpportunities, getProfileFacts, getScoredOpportunityIds, saveMatch } from '../db/matches';
import { applyRules } from './rules';
import { BATCH_SIZE, PROMPT_VERSION, rankBatch } from './rank';

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

// Pass 1 (rules.ts) then Pass 2 (rank.ts), per docs/SCORING.md. One bad
// batch logs and the run continues — same failure posture as
// lib/ingest/index.ts and lib/normalize/index.ts.
export async function runMatchPass(): Promise<void> {
  const candidates = await getCandidateOpportunities();
  const alreadyScored = await getScoredOpportunityIds(PROMPT_VERSION);

  const survivors = candidates.filter(
    (o) => !alreadyScored.has(o.id) && applyRules(o).pass,
  );
  if (survivors.length === 0) return;

  const facts = await getProfileFacts();
  const client = new Anthropic();

  for (const batch of chunk(survivors, BATCH_SIZE)) {
    try {
      const results = await rankBatch(batch, facts, client);
      for (const result of results) {
        await saveMatch(PROMPT_VERSION, result);
      }
    } catch (err) {
      console.error('runMatchPass: batch failed, continuing', err);
    }
  }
}
