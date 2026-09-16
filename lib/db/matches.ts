import { createServiceRoleClient } from './client';

const PAGE_SIZE = 1000; // Supabase/PostgREST's own default row cap per request

// Supabase caps any unpaginated .select() at 1000 rows — silently, no
// error, no warning. Confirmed the hard way: past ~1000 opportunities and
// ~1000 matches rows, getCandidateOpportunities and getScoredOpportunityIds
// were each truncated to an arbitrary first 1000, which both hid genuine
// new candidates past that row and made the "already scored" set
// incomplete (causing wasteful re-scoring of rows actually already done).
// This pages through every row regardless of table size — pass a function
// that runs the same query with a given range.
async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

export type OpportunityForMatching = {
  id: string;
  kind: string;
  title: string;
  org: string;
  location: string | null;
  description: string | null;
  deadline: string | null;
  tags: string[];
  status: string;
  last_seen_at: string;
};

export type ProfileFactForMatching = {
  category: string;
  claim: string;
  strength: string;
};

export type MatchResult = {
  opportunityId: string;
  ruleScore: number;
  llmScore: number;
  eligible: boolean;
  reasoning: string;
  blockers: string[];
};

// Everything not already closed — status='closed' postings are known-dead
// per docs/SOURCES.md and never worth scoring. Pass 1 rule filtering
// (freshness, deadline, tags) happens in lib/scoring/rules.ts against this
// candidate set.
export async function getCandidateOpportunities(): Promise<OpportunityForMatching[]> {
  const db = createServiceRoleClient();
  return fetchAllPages<OpportunityForMatching>((from, to) =>
    db
      .from('opportunities')
      .select('id, kind, title, org, location, description, deadline, tags, status, last_seen_at')
      .neq('status', 'closed')
      .range(from, to),
  );
}

export async function getProfileFacts(): Promise<ProfileFactForMatching[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db.from('profile_facts').select('category, claim, strength');
  if (error) throw error;
  return data ?? [];
}

// (opportunity_id, prompt_version) is unique per 001_init.sql — never
// rescore a row already scored for the current prompt version, per
// docs/SCORING.md's "cache, never rescore an unchanged row."
export async function getScoredOpportunityIds(promptVersion: string): Promise<Set<string>> {
  const db = createServiceRoleClient();
  const rows = await fetchAllPages<{ opportunity_id: string }>((from, to) =>
    db.from('matches').select('opportunity_id').eq('prompt_version', promptVersion).range(from, to),
  );
  return new Set(rows.map((row) => row.opportunity_id));
}

export async function saveMatch(promptVersion: string, match: MatchResult): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db.from('matches').upsert(
    {
      opportunity_id: match.opportunityId,
      rule_score: match.ruleScore,
      llm_score: match.llmScore,
      eligible: match.eligible,
      reasoning: match.reasoning,
      blockers: match.blockers,
      prompt_version: promptVersion,
      scored_at: new Date().toISOString(),
    },
    { onConflict: 'opportunity_id,prompt_version' },
  );
  if (error) throw error;
}
