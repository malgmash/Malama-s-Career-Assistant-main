import Anthropic from '@anthropic-ai/sdk';
import {
  getPendingDraftRequests,
  getProfileFactsWithIds,
  markDraftProcessed,
  saveDocument,
  type PendingDraftRequest,
} from '../db/documents';
import { draftBullets, TAILOR_PROMPT_VERSION } from './tailor';
import { draftShortAnswer, SHORT_ANSWER_PROMPT_VERSION } from './shortAnswer';

function postingTextFor(request: PendingDraftRequest): string {
  const opp = request.applications.opportunities;
  return `${opp.title}\n${opp.org}\n${opp.description ?? ''}`;
}

async function processOne(request: PendingDraftRequest, client: Anthropic): Promise<void> {
  const facts = await getProfileFactsWithIds();
  const postingText = postingTextFor(request);

  if (request.kind === 'bullets') {
    const result = await draftBullets(postingText, facts, client);
    await saveDocument({
      applicationId: request.application_id,
      kind: 'bullets',
      content: result.bullets.map((b) => b.text).join('\n'),
      factIds: result.factIds,
      gaps: result.gaps,
      keywordsUsed: result.keywordsUsed,
      promptVersion: TAILOR_PROMPT_VERSION,
    });
  } else {
    if (!request.question) {
      throw new Error(`Draft request ${request.id} is kind "short_answer" but has no question`);
    }
    const result = await draftShortAnswer(postingText, request.question, facts, client);
    await saveDocument({
      applicationId: request.application_id,
      kind: 'short_answer',
      content: result.answer,
      factIds: result.factIds,
      gaps: result.gaps,
      keywordsUsed: [],
      promptVersion: SHORT_ANSWER_PROMPT_VERSION,
    });
  }

  await markDraftProcessed(request.id);
}

// One bad request logs and the run continues — same posture as
// lib/ingest, lib/scoring and lib/review.
export async function runDraftPass(): Promise<void> {
  const pending = await getPendingDraftRequests();
  if (pending.length === 0) return;

  const client = new Anthropic();
  for (const request of pending) {
    try {
      await processOne(request, client);
    } catch (err) {
      console.error(`runDraftPass: request ${request.id} failed, continuing`, err);
    }
  }
}
