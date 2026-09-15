import { createServiceRoleClient } from './client';

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
  const { data, error } = await db
    .from('opportunities')
    .select('id, kind, title, org, location, description, deadline, tags, status, last_seen_at')
    .neq('status', 'closed');
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await db
    .from('matches')
    .select('opportunity_id')
    .eq('prompt_version', promptVersion);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.opportunity_id));
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
