# Scoring

Two scoring systems. Opportunity match, and resume review. They share the
blocker concept and should share the requirement extraction code.

## Opportunity match

### Pass 1, rules (deterministic)

Run in SQL. No model involved.

| Filter | Rule |
| --- | --- |
| Deadline | Not passed, or null |
| Class year | Overlaps my eligibility, or empty |
| Sponsorship | Not a hard exclusion |
| Kind | In my active interest set |
| Freshness | `last_seen_at` within 14 days |

Output is `rule_score` from 0 to 100 and a pass or fail. Failures are never
sent to the model.

### Pass 2, LLM ranking

Survivors only, batched. Returns per opportunity:

- `llm_score`, 0 to 100
- `reasoning`, two sentences maximum
- `blockers`, stated requirements I demonstrably do not meet

Cache on `(opportunity_id, prompt_version)`. Never rescore an unchanged row.

### Blockers

A blocker is a requirement the posting states that `profile_facts` does not
support at `strength = 'demonstrated'`. Blockers are surfaced, not buried in
a low score. A posting can score 80 and still have one blocker, and that is
the most useful thing the system can tell me.

## Resume review

Three groups, computed differently. Do not let the model do the work that
code can do.

### Group A, structural checks (no LLM, weight 20)

| Check | Threshold |
| --- | --- |
| Page count | 1 for intern applications |
| Bullets per role | 3 to 6 |
| Bullets over two lines | 0 |
| Bullets starting with an action verb | 100 percent |
| Parse test | Full text recoverable from the PDF, nothing trapped in tables, columns, headers or images |
| Date coverage | No unexplained gaps, reverse chronological |

The parse test is the highest value check here and the cheapest. Run the PDF
through the parser and diff against the intended content.

### Group B, requirement coverage (LLM, weight 45)

Extract the posting into atomic requirements, each tagged `required` or
`preferred`. For each, decide whether the resume shows evidence and quote the
exact bullet as proof.

```
score = (2 * required_met + preferred_met) / (2 * required_total + preferred_total) * 100
```

A requirement counted as met with no quoted proof is a failed extraction, not
a pass. Reject the row.

### Group C, term match (mostly deterministic, weight 25)

ATS matching is literal. Extract technologies and noun phrases from the
posting, check exact and near-exact presence in the resume text. Split misses
into two buckets:

- **`suggested_additions`**: terms backed by a `profile_facts` row at
  `strength = 'demonstrated'` that the resume simply is not saying. Safe to add.
- **`unsupported_gaps`**: terms with no supporting fact, or supported only at
  `coursework` or `exposure` strength. Never suggested as additions. These are
  study targets.

The system must never suggest adding a term it cannot ground. That is the
single rule that keeps this tool honest in an interview.

### Group D, quantification (weight 10)

Percentage of bullets containing a concrete number. Target 50 percent or
higher. Report the bullets missing one rather than a bare percentage.

### Composite

```
total = 0.45 * coverage + 0.25 * term_match + 0.20 * structure + 0.10 * quantification
```

Store every subscore. The total alone tells you nothing about what to change.

## Rubrics

One per role family, versioned. `criteria` is JSON holding the weights above
plus family-specific expectations. Author them from public sources: company
career-site resume guidance, published intern resume templates, the
r/EngineeringResumes wiki.

Bump the version when a rubric changes. Old reviews keep pointing at the old
rubric so score history stays comparable.

Recalibrate after outcomes. A rejection at resume screen on a posting that
scored 90 means the rubric is wrong, and that feedback loop is worth more
than any borrowed dataset.

## What this deliberately does not do

It does not compare against resumes of people who were hired. That dataset
does not exist in accessible form, scraping profiles for it violates terms of
service, and the sample would be too small and too biased to learn from. The
rubric library plus my own outcome history is the honest substitute.
