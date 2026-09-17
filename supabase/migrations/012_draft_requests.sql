-- Phase 6: drafting. Same request-queue pattern as review_requests
-- (010_review_requests.sql) — documents.content is "not null", so a
-- documents row can only represent a *finished* draft.
--
-- gaps and keywords_used are added to documents because the original
-- schema (001_init.sql) only had columns for content and fact_ids.
-- docs/PROMPTS.md's tailor.vN contract requires the model to also produce
-- gaps[] and keywords_used[] — dropping them on the floor would defeat
-- the entire point of asking the model to surface them.
alter table documents add column gaps text[] not null default '{}';
alter table documents add column keywords_used text[] not null default '{}';

create table draft_requests (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  kind           text not null,   -- 'bullets' | 'short_answer'
  question       text,            -- required for 'short_answer', null for 'bullets'
  requested_at   timestamptz not null default now(),
  processed_at   timestamptz
);

alter table draft_requests enable row level security;

create policy "owner full access to draft_requests" on draft_requests
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');
