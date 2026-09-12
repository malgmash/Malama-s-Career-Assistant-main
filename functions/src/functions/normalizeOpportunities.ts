import { app, InvocationContext, Timer } from '@azure/functions';
import { runNormalizePass } from '../../../lib/normalize';

// Runs on its own schedule, separate from ingestSimplify, so a hang or
// error in normalization can never affect the ingest function's execution
// or vice versa — see docs/ARCHITECTURE.md and docs/AZURE.md's explicit
// per-function timeout guardrail.
export async function normalizeOpportunities(
  _timer: Timer,
  context: InvocationContext,
): Promise<void> {
  context.log('normalizeOpportunities: starting normalize pass');
  await runNormalizePass();
  context.log('normalizeOpportunities: normalize pass complete');
}

app.timer('normalizeOpportunities', {
  // Every 6 hours, offset 15 minutes after ingestSimplify.
  schedule: '0 15 */6 * * *',
  handler: normalizeOpportunities,
});
