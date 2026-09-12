-- Phase 0 skeleton: full initial schema, per docs/DATA-MODEL.md.
-- All tables and their RLS policies are created together in this one
-- migration since they describe a single, already-fixed data model.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table sources (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,            -- greenhouse | lever | github_json | rss
  name          text not null,
  config        jsonb not null default '{}',
  enabled       boolean not null default true,
  last_run_at   timestamptz,
  last_error    text,
  created_at    timestamptz not null default now()
);

create table raw_postings (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references sources(id) on delete cascade,
  payload       jsonb not null,
  content_hash  text not null,
  fetched_at    timestamptz not null default now(),
  processed_at  timestamptz,
  unique (source_id, content_hash)
);

create table opportunities (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,            -- internship | newgrad | hackathon | scholarship | fellowship
  title         text not null,
  org           text not null,
  location      text,
  remote        text not null default 'unknown',
  url           text not null,
  description   text,
  deadline      date,
  class_years   text[] not null default '{}',
  sponsorship   text not null default 'unknown',
  tags          text[] not null default '{}',
  dedupe_key    text not null unique,
  status        text not null default 'open',
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table opportunity_sources (
  opportunity_id uuid references opportunities(id) on delete cascade,
  raw_posting_id uuid references raw_postings(id) on delete cascade,
  primary key (opportunity_id, raw_posting_id)
);

create table matches (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  rule_score     int  not null,
  llm_score      int,
  reasoning      text,
  blockers       text[] not null default '{}',
  prompt_version text,
  scored_at      timestamptz not null default now(),
  unique (opportunity_id, prompt_version)
);

create table profile_facts (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,              -- project | skill | award | education | leadership
  claim       text not null,
  evidence    text,                       -- repo link, doc reference, artifact
  strength    text not null default 'demonstrated', -- demonstrated | coursework | exposure
  tags        text[] not null default '{}',
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table resumes (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  storage_path text not null,             -- Azure Blob path
  parsed_text  text,
  role_family  text,
  created_at   timestamptz not null default now()
);

create table rubrics (
  id          uuid primary key default gen_random_uuid(),
  role_family text not null,              -- swe_intern | pm_intern | data_analyst
  version     int  not null,
  criteria    jsonb not null,
  created_at  timestamptz not null default now(),
  unique (role_family, version)
);

create table reviews (
  id             uuid primary key default gen_random_uuid(),
  resume_id      uuid not null references resumes(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  rubric_id      uuid not null references rubrics(id),
  total_score    int not null,
  subscores      jsonb not null,
  findings       jsonb not null,
  prompt_version text not null,
  created_at     timestamptz not null default now()
);

create table applications (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  stage          text not null default 'interested',
  applied_at     timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (opportunity_id)
);

create table app_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  kind           text not null,           -- stage_change | email | interview | offer | reject
  occurred_at    timestamptz not null default now(),
  payload        jsonb not null default '{}'
);

create table documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  kind           text not null,           -- bullets | cover_letter | short_answer
  content        text not null,
  fact_ids       uuid[] not null default '{}',
  prompt_version text not null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Ingestion-owned tables: the service role (BYPASSRLS) is the only writer.
-- Authenticated reads are allowed so the app can display them.
alter table sources enable row level security;
alter table raw_postings enable row level security;
alter table opportunities enable row level security;
alter table opportunity_sources enable row level security;

create policy "authenticated read sources" on sources
  for select to authenticated using (true);

create policy "authenticated read raw_postings" on raw_postings
  for select to authenticated using (true);

create policy "authenticated read opportunities" on opportunities
  for select to authenticated using (true);

create policy "authenticated read opportunity_sources" on opportunity_sources
  for select to authenticated using (true);

-- Owner tables: full access for the authenticated user. None of these
-- tables carry a user_id column in the fixed schema (docs/DATA-MODEL.md),
-- and this is a single-user app (CLAUDE.md), so "owner-only" here means
-- "any authenticated session" rather than per-row filtering.
alter table matches enable row level security;
alter table profile_facts enable row level security;
alter table resumes enable row level security;
alter table rubrics enable row level security;
alter table reviews enable row level security;
alter table applications enable row level security;
alter table app_events enable row level security;
alter table documents enable row level security;

create policy "owner full access to matches" on matches
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "owner full access to profile_facts" on profile_facts
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "owner full access to resumes" on resumes
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "owner full access to rubrics" on rubrics
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "owner full access to reviews" on reviews
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "owner full access to applications" on applications
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "owner full access to app_events" on app_events
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "owner full access to documents" on documents
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
