import { createHash } from 'node:crypto';
import { createServiceRoleClient } from './client';

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

export async function getUnprocessed(): Promise<
  Array<RawPostingRow & { sources: { kind: string; config: Record<string, unknown> } }>
> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('raw_postings')
    .select('id, source_id, payload, sources!inner(kind, config)')
    .is('processed_at', null);
  if (error) throw error;
  return (data ?? []) as unknown as Array<
    RawPostingRow & { sources: { kind: string; config: Record<string, unknown> } }
  >;
}

export async function markProcessed(id: string): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db
    .from('raw_postings')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
