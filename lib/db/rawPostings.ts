import { createHash } from 'node:crypto';
import { createServiceRoleClient } from './client';
import { fetchAllPages } from './pagination';

export type RawPostingRow = {
  id: string;
  source_id: string;
  payload: unknown;
};

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// Returns true if a new row was inserted, false if this exact payload was
// already seen for this source (the (source_id, content_hash) unique
// constraint in 001_init.sql is what actually enforces this — a duplicate
// is expected, not an error, per docs/SOURCES.md ingestion rule 1).
export async function insertIfNew(sourceId: string, payload: unknown): Promise<boolean> {
  const db = createServiceRoleClient();
  const contentHash = hashPayload(payload);

  const { error } = await db
    .from('raw_postings')
    .insert({ source_id: sourceId, payload, content_hash: contentHash });

  if (error) {
    if (error.code === '23505') return false; // unique_violation
    throw error;
  }
  return true;
}

type UnprocessedRow = RawPostingRow & { sources: { kind: string; config: Record<string, unknown> } };

// Same 1000-row PostgREST default cap as lib/db/matches.ts — found here
// the hard way too: getUnprocessed was capped, so once raw_postings grew
// past ~1000 unprocessed rows, most never got normalized. malg_dropbox's
// hackathon/conference postings ended up almost entirely stuck this way,
// silently, with no error anywhere (lib/normalize's own catch block only
// guards against a single row's normalize() throwing, not against never
// being selected at all).
export async function getUnprocessed(): Promise<UnprocessedRow[]> {
  const db = createServiceRoleClient();
  return fetchAllPages<UnprocessedRow>((from, to) =>
    db
      .from('raw_postings')
      .select('id, source_id, payload, sources!inner(kind, config)')
      .is('processed_at', null)
      .range(from, to) as unknown as PromiseLike<{ data: UnprocessedRow[] | null; error: unknown }>,
  );
}

export async function markProcessed(id: string): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db
    .from('raw_postings')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
