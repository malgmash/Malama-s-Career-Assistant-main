import { createHash } from 'node:crypto';
import { getAdapter } from '../sources';
import { getUnprocessed, markProcessed } from '../db/rawPostings';
import { upsertByDedupeKey, linkSource, markStale } from '../db/opportunities';

function forDedupe(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

// dedupe_key = sha256(normalized org || title || location), per
// docs/ARCHITECTURE.md's Normalizer section.
function computeDedupeKey(org: string, title: string, location: string | null): string {
  const combined = forDedupe(org) + forDedupe(title) + forDedupe(location ?? '');
  return createHash('sha256').update(combined).digest('hex');
}

// Separate pass from ingest, per docs/ARCHITECTURE.md: "normalize in a
// separate pass so a normalization bug never loses data." Runs against
// whatever is sitting unprocessed in raw_postings regardless of when or
// how it got there.
export async function runNormalizePass(): Promise<void> {
  const unprocessed = await getUnprocessed();

  for (const row of unprocessed) {
    try {
      const adapter = getAdapter(row.sources.kind);
      const result = await adapter.normalize({ externalId: '', payload: row.payload });

      if (result.kind === 'skip') {
        await markProcessed(row.id);
        continue;
      }

      const dedupeKey = computeDedupeKey(
        result.opportunity.org,
        result.opportunity.title,
        result.opportunity.location,
      );
      const opportunityId = await upsertByDedupeKey(
        dedupeKey,
        result.opportunity,
        result.status ?? 'open',
      );
      await linkSource(opportunityId, row.id);
      await markProcessed(row.id);
    } catch {
      // Leave processed_at null so a fixed normalizer can retry this row
      // later, per docs/ARCHITECTURE.md's "reject rows that fail" boundary.
      continue;
    }
  }

  await markStale();
}
