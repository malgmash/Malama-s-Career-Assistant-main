# normalize.v1

Status: deterministic implementation only. No model call in this version.

**In:** one raw payload, plus the source kind.
**Out:** `NormalizedOpportunity` from `lib/sources/types.ts`.
**May not invent:** deadlines, URLs, org names, class years, sponsorship
status. Copy or null.

## Per-source implementation

`github_json` (Simplify internship list): implemented as a pure function in
`lib/sources/github_json.ts`'s `normalize()`. Every `NormalizedOpportunity`
field this source can populate maps directly from a discrete JSON key —
there is no free text to extract from, so this version makes no Anthropic
API call. See `docs/PROMPTS.md` for the general slot contract.

## When to bump to v2

The first source whose raw payload includes unstructured text needing
interpretation (e.g. a Greenhouse/Lever HTML job description, expected in
Phase 2) is what should trigger writing an actual model-backed
implementation for this slot. Bump the version per source kind as needed;
`github_json`'s deterministic v1 does not need to change just because
another source kind gains a v2.
