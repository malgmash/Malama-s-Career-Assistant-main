-- Phase 1: the plain table view (app/opportunities/page.tsx) runs inside
-- a static-export Next.js build with no server, so it reads Supabase
-- directly with the public anon key. This is a deliberate, scoped RLS
-- loosening: anonymous read access to opportunities only. Posting data is
-- not sensitive and is meant to be browsed; sources, raw_postings and
-- opportunity_sources are untouched and remain authenticated-read /
-- service-role-write only, per 001_init.sql.

create policy "anon read opportunities" on opportunities
  for select to anon using (true);
