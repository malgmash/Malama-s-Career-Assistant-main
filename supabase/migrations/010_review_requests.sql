-- Phase 5: reviews.total_score/subscores/findings/prompt_version are all
-- "not null" (001_init.sql) -- a reviews row represents a *completed*
-- review, it can't exist mid-computation. review_requests is the queue a
-- review sits in between "the user asked for this" and "the manual
-- review:once pass computed it", the same split ingest already uses
-- between raw_postings and opportunities.

create table review_requests (
  id             uuid primary key default gen_random_uuid(),
  resume_id      uuid not null references resumes(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  requested_at   timestamptz not null default now(),
  processed_at   timestamptz
);

alter table review_requests enable row level security;

create policy "owner full access to review_requests" on review_requests
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');
