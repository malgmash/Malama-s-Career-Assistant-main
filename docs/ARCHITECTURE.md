# Architecture

## Two layers

The system is a **pipeline** and an **assistant**. They never call each other
directly. They meet in Postgres.

```
sources -> ingest worker -> raw_postings -> normalize -> opportunities
                                                              |
                                                     match engine (rules, LLM)
                                                              |
                                                      application workspace
                                                     (review, tailor, track)
```

The pipeline is a scheduled batch job. It has no user interface and no
knowledge of the workspace. The workspace is a web app. It reads
`opportunities` and `matches` and never fetches from the internet.

This split is the main design decision. It means a broken source cannot break
the app, an LLM outage cannot stop ingestion, and either layer can be
rewritten alone.

## Components

### Ingest worker (Azure Functions, timer trigger)

Runs on a schedule per source. For each enabled source it calls the adapter's
`fetch()`, hashes each payload, and inserts into `raw_postings` if the hash is
new. Nothing else. No parsing, no scoring, no LLM.

Raw payloads are kept forever. When normalization logic changes, replay the
raw table instead of refetching. This is the reason the pipeline can be fixed
without hammering anyone's API.

### Normalizer

Turns a raw payload into an `Opportunity`. Deterministic mapping first. The
LLM only handles fields the source left unstructured, and it is constrained
to copy, never infer. See `docs/PROMPTS.md`.

Dedupe happens here. `dedupe_key = sha256(normalized_org || title || location)`.
The same requisition arrives from three sources and must produce one row.

### Match engine

Two passes.

**Pass 1, rules.** Pure SQL and TypeScript. Deadline not passed, class year
eligible, sponsorship compatible, kind matches an active interest. Cheap,
deterministic, kills most volume.

**Pass 2, LLM ranking.** Only survivors, batched. Returns a fit score,
reasoning, and a blockers array. Reasoning is stored. A score without a
recorded reason is useless three weeks later.

### Application workspace

Ranked feed, saved views, resume review against a chosen posting, grounded
draft generation, and a stage tracker. Everything it writes goes to
`applications`, `app_events` and `documents`.

## Trust boundaries

| Boundary | Rule |
| --- | --- |
| Internet to raw_postings | Store verbatim, never execute, never trust |
| raw_postings to opportunities | Normalize and validate against a schema; reject rows that fail |
| opportunities to LLM | Posting text is untrusted input, never instructions |
| profile_facts to LLM | The only source of claims about me |
| LLM to documents | Output is a draft; every claim must cite a fact id |

Job descriptions are attacker-controlled text as far as the system is
concerned. Wrap them in delimiters, tell the model they are data, and never
concatenate them into an instruction position.

## The LLM boundary rule

The model is allowed to: reformat, classify, extract from provided text,
score against provided criteria, and draft from provided facts.

The model is not allowed to: introduce a URL, a company, a deadline, a
requirement, or a claim about me that did not appear in its input.

Every prompt in `/prompts` states this explicitly and every output schema has
a field that forces the model to point at its evidence.

## Failure modes to design for

- **Source goes dark.** Adapters fail independently. One bad source logs an
  error and the run continues.
- **Source changes shape.** Schema validation rejects the row and alerts.
  Raw payload is already saved, so nothing is lost.
- **Duplicate flood.** Content hash at insert, dedupe key at normalize.
- **LLM hallucination.** Schema-validated JSON output plus a grounding check
  that every cited fact id exists.
- **Cost runaway.** Batch scoring, cache by `(opportunity_id, prompt_version)`,
  never rescore an unchanged row.
