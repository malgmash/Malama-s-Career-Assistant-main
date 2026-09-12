import { getAdapter } from '../sources';
import { getEnabledSources, recordSourceError, recordSourceRun } from '../db/sources';
import { insertIfNew } from '../db/rawPostings';

// Fetch + hash + insert only. No parsing, no scoring, no LLM — see
// docs/ARCHITECTURE.md's Ingest worker description. One bad source logs
// to sources.last_error and the run continues (docs/SOURCES.md rule 4).
export async function runIngestPass(): Promise<void> {
  const sources = await getEnabledSources();

  for (const source of sources) {
    try {
      const adapter = getAdapter(source.kind);
      const rawPostings = await adapter.fetch(source.config);
      for (const raw of rawPostings) {
        await insertIfNew(source.id, raw.payload);
      }
      await recordSourceRun(source.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordSourceError(source.id, message);
    }
  }
}
