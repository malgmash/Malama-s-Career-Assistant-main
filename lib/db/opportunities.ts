import type { NormalizedOpportunity } from '../sources/types';
import { createServiceRoleClient } from './client';

export async function upsertByDedupeKey(
  dedupeKey: string,
  opportunity: NormalizedOpportunity,
  status: 'open' | 'closed',
): Promise<string> {
  const db = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await db
    .from('opportunities')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (findError) throw findError;

  const fields = {
    kind: opportunity.kind,
    title: opportunity.title,
    org: opportunity.org,
    location: opportunity.location,
    remote: opportunity.remote,
    url: opportunity.url,
    description: opportunity.description,
    deadline: opportunity.deadline,
    class_years: opportunity.classYears,
    sponsorship: opportunity.sponsorship,
    tags: opportunity.tags,
    status,
  };

  if (existing) {
    // Never touch first_seen_at on an update.
    const { error } = await db
      .from('opportunities')
      .update({ ...fields, last_seen_at: now })
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data: inserted, error: insertError } = await db
    .from('opportunities')
    .insert({ ...fields, dedupe_key: dedupeKey, first_seen_at: now, last_seen_at: now })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return inserted.id;
}

export async function linkSource(opportunityId: string, rawPostingId: string): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db
    .from('opportunity_sources')
    .upsert(
      { opportunity_id: opportunityId, raw_posting_id: rawPostingId },
      { onConflict: 'opportunity_id,raw_posting_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function markStale(): Promise<void> {
  const db = createServiceRoleClient();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db
    .from('opportunities')
    .update({ status: 'stale' })
    .eq('status', 'open')
    .lt('last_seen_at', fourteenDaysAgo);
  if (error) throw error;
}
