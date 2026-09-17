-- Phase 7: weekly digest. Deterministic, no LLM calls (see lib/digest) —
-- new/closing-soon are plain date filters, blocker clustering is word
-- frequency over matches.blockers, which are themselves already
-- LLM-written summaries from the match pass. Re-running an LLM over
-- LLM output weekly would just be a second cost layer for little gain.
--
-- Same anon-read pattern as opportunities/matches (003, 006) — no login
-- needed to check the digest, consistent with the rest of the public feed.
create table digests (
  id                 uuid primary key default gen_random_uuid(),
  computed_at        timestamptz not null default now(),
  new_count          int not null,
  closing_soon_count int not null,
  summary            text not null,
  details            jsonb not null
);

alter table digests enable row level security;

create policy "anon read digests" on digests
  for select to anon using (true);

create policy "owner full access to digests" on digests
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');
