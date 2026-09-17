import { createServiceRoleClient } from './client';
import { fetchAllPages } from './pagination';
import { RANK_PROMPT_VERSION } from '../scoring/config';

export type DigestOpportunity = {
  id: string;
  title: string;
  org: string;
  url: string;
  deadline: string | null;
  first_seen_at: string;
};

export async function getNewEligibleOpportunities(sinceIso: string): Promise<DigestOpportunity[]> {
  const db = createServiceRoleClient();
  return fetchAllPages<DigestOpportunity>((from, to) =>
    db
      .from('opportunities')
      .select('id, title, org, url, deadline, first_seen_at, matches!inner(eligible, prompt_version)')
      .eq('matches.prompt_version', RANK_PROMPT_VERSION)
      .eq('matches.eligible', true)
      .gte('first_seen_at', sinceIso)
      .range(from, to) as unknown as PromiseLike<{ data: DigestOpportunity[] | null; error: unknown }>,
  );
}

export async function getClosingSoonEligibleOpportunities(
  nowIso: string,
  untilIso: string,
): Promise<DigestOpportunity[]> {
  const db = createServiceRoleClient();
  const rows = await fetchAllPages<DigestOpportunity>((from, to) =>
    db
      .from('opportunities')
      .select('id, title, org, url, deadline, first_seen_at, matches!inner(eligible, prompt_version)')
      .eq('matches.prompt_version', RANK_PROMPT_VERSION)
      .eq('matches.eligible', true)
      .gte('deadline', nowIso)
      .lte('deadline', untilIso)
      .range(from, to) as unknown as PromiseLike<{ data: DigestOpportunity[] | null; error: unknown }>,
  );
  return rows.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
}

// Every scored match's blockers, not just eligible ones — a recurring
// blocker like "Java experience" is worth knowing about even on postings
// that were excluded for an unrelated reason (e.g. field or region).
export async function getAllBlockers(): Promise<string[]> {
  const db = createServiceRoleClient();
  const rows = await fetchAllPages<{ blockers: string[] }>((from, to) =>
    db.from('matches').select('blockers').eq('prompt_version', RANK_PROMPT_VERSION).range(from, to),
  );
  return rows.flatMap((r) => r.blockers);
}

export type DigestToSave = {
  newCount: number;
  closingSoonCount: number;
  summary: string;
  details: unknown;
};

export async function saveDigest(digest: DigestToSave): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db.from('digests').insert({
    new_count: digest.newCount,
    closing_soon_count: digest.closingSoonCount,
    summary: digest.summary,
    details: digest.details,
  });
  if (error) throw error;
}
