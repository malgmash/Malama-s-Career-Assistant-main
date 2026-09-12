import { app, InvocationContext, Timer } from '@azure/functions';
import { runIngestPass } from '../../../lib/ingest';

// Fetch + hash + insert only. See lib/ingest/index.ts and
// docs/ARCHITECTURE.md's Ingest worker description — this function is a
// thin scheduling wrapper, all real logic lives in /lib so it's testable
// without Azure tooling (see scripts/run-ingest-once.ts).
export async function ingestSimplify(_timer: Timer, context: InvocationContext): Promise<void> {
  context.log('ingestSimplify: starting ingest pass');
  await runIngestPass();
  context.log('ingestSimplify: ingest pass complete');
}

app.timer('ingestSimplify', {
  // Every 6 hours. Adjust once real usage patterns are known.
  schedule: '0 0 */6 * * *',
  handler: ingestSimplify,
});
