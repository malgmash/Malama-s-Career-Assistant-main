-- Phase 4: real login (Supabase Auth, magic link) is being added for the
-- first time. Until now, "owner full access" policies from 001_init.sql
-- checked only `auth.uid() is not null` — harmless while nothing could
-- actually authenticate, but a real hole the moment sign-in exists: any
-- email that requests a magic link would get full read/write on resumes,
-- profile_facts, applications and documents. This is a single-user app
-- (CLAUDE.md) with exactly one legitimate owner, so scope these policies to
-- that specific account instead of "any authenticated session".
--
-- Email is used (not a stored user id) because there is no separate owner
-- table to compare against, and Supabase Auth exposes the session's email
-- directly in the JWT via auth.jwt(). This is not new exposure: the same
-- email already appears in every commit author line in this repo's git
-- history.
alter policy "owner full access to matches" on matches
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');

alter policy "owner full access to profile_facts" on profile_facts
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');

alter policy "owner full access to resumes" on resumes
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');

alter policy "owner full access to rubrics" on rubrics
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');

alter policy "owner full access to reviews" on reviews
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');

alter policy "owner full access to applications" on applications
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');

alter policy "owner full access to app_events" on app_events
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');

alter policy "owner full access to documents" on documents
  using ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');
