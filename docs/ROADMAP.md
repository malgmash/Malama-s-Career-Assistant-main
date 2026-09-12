# Roadmap

Each phase ships to production before the next one starts. A phase is not done
until it is deployed and I have used it once for real.

## Phase 0, skeleton

Repo, Supabase project, first migration, empty Next.js page deployed to Static
Web Apps, Bicep deploying an empty resource group and Key Vault.

**Exit:** a live URL and `npx supabase db reset` runs clean.

## Phase 1, one source end to end

The Simplify internship JSON only. Timer-triggered Function, raw insert,
normalize, dedupe, and a plain table view of `opportunities`.

**Exit:** new postings appear in the table without me touching anything.

## Phase 2, the adapter pattern

Greenhouse and Lever adapters behind the `Adapter` interface. Company slugs in
`sources.config`. Fixtures for each.

**Exit:** adding a target company is a database insert.

## Phase 3, matching

Rule filters in SQL. LLM ranking pass over survivors with blockers. Ranked
feed with saved views and a closing-soon sort.

**Exit:** I open the feed instead of opening job boards.

## Phase 4, profile and tracking

`profile_facts` seeded from my accomplishments doc. Application tracker with
stages and events.

**Exit:** every application I send this season is recorded here.

## Phase 5, resume review

Blob upload, Document Intelligence parsing, structural checks, requirement
coverage, term match, first rubric for `swe_intern`.

**Exit:** I score a resume against a real posting and change the resume
because of what it said.

## Phase 6, drafting

Grounded bullet and short-answer generation from `profile_facts`, with
`fact_ids` recorded on every document.

**Exit:** a draft I actually submit, with every claim traceable.

## Phase 7, digest

Weekly summary of what is new, what is closing, and what my blockers cluster
around.

## Explicitly out of scope

- Auto-submitting applications. Headless browsers against real job portals
  mean captchas, account risk and constant breakage. Drafting and tracking
  captures most of the value.
- Multi-user support.
- A mobile app.
