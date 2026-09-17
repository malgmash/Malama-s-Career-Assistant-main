# Prompts

Prompts are versioned artifacts, not strings inlined in code. They live in
`/prompts/<name>.v<N>.md` and are referenced by version everywhere they are
used.

Status: contracts defined below, prompt bodies to be written next.

## Rules for every prompt

1. Untrusted input goes inside delimiters and is labelled as data. Job
   descriptions are attacker-controlled text.
2. Output is JSON matching a stated schema. No prose, no code fences.
3. Every prompt states what the model may not invent.
4. Every output schema includes an evidence field forcing the model to point
   at its input.
5. Absent data becomes `null` or `"unknown"`. Never a guess.
6. Drafted application text uses no em-dashes and no colons.

## Versioning

Bump the version on any change to wording, schema or model. Never edit a
version in place. `matches`, `reviews` and `documents` all store
`prompt_version`, so scores stay comparable across changes.

## Slots

### `normalize.vN`

**In:** one raw payload, plus the source kind.
**Out:** `NormalizedOpportunity` from `lib/sources/types.ts`.
**May not invent:** deadlines, URLs, org names, class years, sponsorship
status. Copy or null.

### `rank.vN`

**In:** a batch of up to 20 opportunities, plus a compact profile summary
derived from `profile_facts`, plus Malama's standing match criteria
(`lib/scoring/config.ts`).
**Out:** `[{ opportunity_id, score, eligible, reasoning, blockers[] }]`.
`eligible` was added in v1 once real criteria turned out to include hard
gates (field relevance, international-student eligibility, region/travel
reimbursement) that only exist in free text, not structured fields — see
`matches.eligible` in `006_matches_eligible_and_anon_read.sql`. These are
gates, not blockers: `docs/SCORING.md`'s "a posting can score 80 and still
have one blocker" is about softer gaps, not a rule Malama stated as a hard
requirement.
**May not invent:** requirements not present in the posting text.

### `extract-requirements.vN`

**In:** one job description.
**Out:** `[{ text, kind: 'required' | 'preferred', category }]`.
Shared by the match engine and the resume reviewer. Write it once.

### `coverage.vN`

**In:** extracted requirements, plus parsed resume text.
**Out:** `[{ requirement_id, met: boolean, proof: string | null }]`.
**Rule:** `met: true` with `proof: null` is invalid. Reject and retry once.

### `tailor.vN`

**In:** the opportunity, plus `profile_facts` rows with ids and strengths.
**Out:** `{ bullets[], fact_ids[], gaps[], keywords_used[] }`.
**May not invent:** any claim not traceable to a supplied fact id. Facts at
`strength = 'coursework'` or `'exposure'` may not be written as experience.
Missing requirements go in `gaps`, never written around.
Persisted in `documents`: `content` (bullets joined by newline), `fact_ids`,
plus `gaps` and `keywords_used` (added in `012_draft_requests.sql` — the
original `documents` schema had no column for either, and silently
dropping what the prompt is explicitly required to produce would defeat
the point of asking for it).

### `short-answer.vN`

**In:** the opportunity, `profile_facts` rows with ids and strengths, and
the actual application question (supplied by Malama — the question itself
can't be invented, it varies per application and isn't derivable from the
posting).
**Out:** `{ answer, fact_ids[], gaps[] }`.
**May not invent:** same rules as `tailor.vN` — no claim without a fact id,
no coursework/exposure written as experience, gaps stay gaps.

## Evaluation

Keep a small fixture set in `/prompts/__evals__`. Ten postings with hand
labelled expected output for `normalize` and `extract-requirements`. Run it
before bumping any version. This is not a full eval harness, it is a smoke
test that catches the obvious regressions.
