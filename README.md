# Malama's Career Assistant

A personal tool that ingests internship, hackathon, scholarship and
fellowship opportunities from structured sources, scores them against a
real profile, reviews a resume against a specific posting, and tracks
applications.

Single user, built with production discipline: RLS on every table,
versioned prompts, and every claim about the user grounded in a fact table
rather than invented by a model. See [CLAUDE.md](CLAUDE.md) for the full
set of working rules this project follows.

## Stack

- Next.js (App Router) + TypeScript, static export
- Supabase Postgres with Row Level Security
- Anthropic API for opportunity ranking and (later) resume review
- GitHub Actions for scheduled ingestion — no Azure spend required to run
  the pipeline day to day

## How it works

```
sources -> ingest -> raw_postings -> normalize -> opportunities
                                                        |
                                               match engine (rules, LLM)
                                                        |
                                                  ranked feed (this app)
```

Fetching is deterministic code. The LLM only normalizes unstructured text
and scores survivors of a rules pass — it never invents a URL, company
name, or deadline that didn't appear in the source data. Full design
rationale is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Ingestion runs automatically: [.github/workflows/ingest.yml](.github/workflows/ingest.yml)
triggers on any push to `data/**` (an external feed being updated) and on
manual dispatch, running ingest, normalize, and match in sequence.

## Status

- **Ingestion:** live. Two sources registered (Simplify internship list,
  MALG Opportunity Dropbox), running automatically on every feed update.
- **Matching:** live. Rule filters plus an LLM ranking pass grade survivors
  against a stated set of personal criteria (field, region, international-
  student eligibility, and more — see `lib/scoring/config.ts`) and produce
  a ranked, categorized feed at `/opportunities`.
- **Profile facts:** in progress. Resume-grounding facts are being seeded
  by hand, one verified claim at a time — nothing here is generated.
- **Resume review, drafting, tracking:** not started. See
  [docs/ROADMAP.md](docs/ROADMAP.md) for the full phase plan.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic credentials
npm run dev                  # http://localhost:3000/opportunities

npm run ingest:once          # pull raw postings from registered sources
npm run normalize:once       # turn raw postings into opportunities
npm run match:once           # score opportunities against profile_facts
```

Database schema lives in [supabase/migrations](supabase/migrations) —
numbered, sequential, never edited after commit. See
[docs/DATA-MODEL.md](docs/DATA-MODEL.md) for the full schema and RLS
posture.

## Repo map

```
/app                Next.js routes
/lib
  /sources          one adapter per opportunity source
  /normalize        raw payload to Opportunity
  /scoring          rule filters, LLM ranking
  /db               typed queries, no raw SQL in components
/functions          Azure Functions app (ingestion worker, not currently deployed)
/prompts            versioned prompt templates
/supabase/migrations numbered SQL migrations
/docs               design docs — read before large changes
```
