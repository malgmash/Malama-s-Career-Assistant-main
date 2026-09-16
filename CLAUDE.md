# Malama's Career Assistant

Read this file at the start of every session. If a change contradicts anything
here, stop and ask before writing code.

## What this is

A personal tool that ingests internship, hackathon, scholarship and fellowship
opportunities from structured sources, scores them against my profile, reviews
my resume against a specific posting, and tracks my applications.

Single user. Me. Not a product, not multi-tenant, but built as if it were.

## Stack

- Next.js (App Router) + TypeScript, hosted on Azure Static Web Apps
- Supabase Postgres with Row Level Security
- Azure Functions (timer trigger) for ingestion, Bicep for IaC
- Supabase Storage for resume files (raw payloads live in Postgres
  `raw_postings`, not blob storage)
- Local PDF text extraction (`pdf-parse`) for the deterministic structural
  check; Anthropic API for everything requiring judgment (requirement
  extraction, coverage, review). No Azure AI Document Intelligence — see
  docs/DATA-MODEL.md for why (Azure subscription off for cost reasons)
- Azure Key Vault for secrets, Application Insights for telemetry
- Anthropic API for all LLM calls

## Repo map

```
/app                Next.js routes and server actions
/lib
  /sources          one adapter per opportunity source
  /normalize        raw payload to Opportunity
  /scoring          rule filters, LLM ranking, resume review
  /db               typed queries, no raw SQL in components
/functions          Azure Functions app (ingestion worker)
/infra              Bicep templates
/supabase/migrations numbered SQL migrations
/docs               design docs, read before large changes
/prompts            versioned prompt templates
```

## Non-negotiables

1. Every table has RLS enabled. No table ships without policies.
2. Security-definer functions pin `search_path`.
3. Fetching is deterministic code. LLMs normalize, score and draft. An LLM
   never produces an opportunity URL, a company name, or a deadline that did
   not appear in fetched source data.
4. Anything that touches my resume is grounded in the `profile_facts` table.
   If a claim is not in that table, it does not go in a document. Gaps get
   reported as gaps, never written around.
5. No secrets in client components. Server actions or route handlers only.
6. No scraping of sites that prohibit it. See docs/SOURCES.md.
7. Cost guardrails in docs/AZURE.md are hard limits, not suggestions.

## Working agreement

- Propose a plan before writing code on anything over roughly 50 lines.
- One migration per change. Numbered. Never edited after commit.
- New source? Implement the existing `Adapter` interface. Do not invent a
  second pattern.
- Show a diff summary before any refactor touching more than three files.
- Prefer boring, readable code over clever code. I have to maintain this.
- If you are unsure whether something is a fact about me or an assumption,
  ask. Do not fill in plausible detail.

## Definition of done

A change is done when it has a migration (if schema changed), RLS policies,
types regenerated, a manual test path written in the PR description, and no
new secrets in source. Tests where a test framework exists.

## Glossary

- **Opportunity**: a normalized, deduped posting. Internship, hackathon,
  scholarship or fellowship.
- **Raw posting**: untouched payload from a source, kept forever.
- **Profile fact**: an atomic, verified claim about me with evidence.
- **Blocker**: a stated requirement I demonstrably do not meet.
- **Rubric**: a versioned scoring definition for one role family.
