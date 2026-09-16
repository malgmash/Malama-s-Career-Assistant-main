# Data model

Postgres via Supabase. Single user today, RLS everywhere anyway.

## Tables

```sql
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
  eligible       boolean not null, -- added 006_matches_eligible_and_anon_read.sql
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
  storage_path text not null,             -- Supabase Storage path, "resumes" bucket
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

-- Added 010_review_requests.sql. reviews' score columns are all "not
-- null" -- a reviews row can only represent a *completed* review -- so a
-- request needs somewhere to sit in the gap between "the user asked for
-- this" and "review:once computed it". Same split as raw_postings ->
-- opportunities.
create table review_requests (
  id             uuid primary key default gen_random_uuid(),
  resume_id      uuid not null references resumes(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  requested_at   timestamptz not null default now(),
  processed_at   timestamptz
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
```

## Key decisions

**`profile_facts.strength`** distinguishes demonstrated from coursework from
exposure. The tailoring prompts must respect it. Coursework-level familiarity
never gets written as experience.

**`documents.fact_ids`** is the grounding audit trail. Every generated
document records which facts it drew on. A document with an empty array is a
bug, not a document.

**`matches` is keyed by prompt version.** Change a scoring prompt and old
scores stay for comparison instead of being silently overwritten.

**`opportunity_sources` is many to many.** One requisition, several sources.

## RLS posture

Enable RLS on every table. Owner-only policies check the session's email
against the one real account (`007_owner_policies_by_email.sql`) rather
than just `auth.uid() is not null`, once real login (magic link) existed to
make "any authenticated session" a real hole, not a theoretical one.
Service role is used only by the ingestion, match and review worker code,
and only for `sources`, `raw_postings`, `opportunities`,
`opportunity_sources`, `matches`, `resumes`, `review_requests` and
`reviews`. `opportunities` and `matches` also grant anon read (see
`003_anon_read_opportunities.sql`, `006_matches_eligible_and_anon_read.sql`)
since the ranked feed is a static-export page with no server. Resume files
in Supabase Storage's `resumes` bucket get the same owner-by-email policy,
on `storage.objects` (`009_resume_storage.sql`).

Any function that needs elevated rights is `security definer` with
`set search_path = public, pg_temp`.

## Migration conventions

- `supabase/migrations/NNN_short_name.sql`, zero padded, sequential.
- Never edit a committed migration. Write a new one.
- Every migration that creates a table creates its policies in the same file.
- Destructive changes get a comment explaining what data is lost.
