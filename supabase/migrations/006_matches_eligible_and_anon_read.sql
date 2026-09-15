-- Phase 3: the LLM ranking pass (prompts/rank.v1.md) judges hard eligibility
-- (field relevance, international-student friendliness, region/travel
-- reimbursement for events, class-year targeting) by reading free text that
-- no Pass 1 SQL rule can reliably check. `eligible` records that verdict
-- explicitly instead of overloading rule_score/llm_score/blockers, which
-- docs/SCORING.md already defines around softer, score-alongside-a-gap
-- reasoning ("a posting can score 80 and still have one blocker").
-- `matches` table has no rows yet (Phase 3 hasn't run before now), so this
-- is safe to add as not null with no backfill.
alter table matches add column eligible boolean not null;

-- Phase 3: the ranked feed (app/opportunities/page.tsx) runs the same
-- static-export, no-server, anon-key pattern as the plain opportunities
-- table (003_anon_read_opportunities.sql). Same reasoning applies: this is
-- a single-user app with no login, and match reasoning about postings is
-- not sensitive in the way profile_facts, resumes or documents are.
create policy "anon read matches" on matches
  for select to anon using (true);
