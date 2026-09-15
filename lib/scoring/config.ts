// Standing personal preferences for the match engine (docs/SCORING.md).
// Single-user app (CLAUDE.md) — these are facts about Malama's own search,
// not per-tenant config, so they live here as code rather than a database
// table. Change this file directly when the search criteria change.

// Bump on any change to prompts/rank.vN's wording, schema or model, per
// docs/PROMPTS.md. Lives here (not rank.ts) because rank.ts pulls in
// node:fs and the Anthropic SDK, neither safe to import from the
// client-side ranked feed page, which only needs this string.
export const RANK_PROMPT_VERSION = 'rank.v1';

// Pass 1 (rules.ts) only filters on this. "newgrad" is intentionally
// excluded — not an active interest right now.
export const ACTIVE_INTEREST_KINDS = ['internship', 'hackathon', 'scholarship', 'fellowship'] as const;

// A rule_score-eligible opportunity not re-seen in this many days is
// considered stale (docs/SOURCES.md ingestion rule 5 already flips
// opportunities.status to 'stale' at the same threshold).
export const FRESHNESS_DAYS = 14;

// Copied verbatim into prompts/rank.v1.md's instructions. Everything past
// this point is free-text judgment (field relevance, class-year targeting,
// region/travel reimbursement), which is why it's the LLM's job in Pass 2,
// not a SQL rule in Pass 1 — see the plan discussion in-session.
export const MATCH_CRITERIA_TEXT = `
Hard requirements, checked against the posting text below. If a posting
violates one, set eligible to false and explain which one in reasoning.

All kinds:
- Must not exclude international students. Explicit U.S.-citizenship or
  permanent-residency requirements are disqualifying. Silence on the topic
  is not disqualifying.

Internships:
- Open to undergraduate / bachelor's-level students. Postings restricted to
  graduate/PhD only are disqualifying.
- Field must be software engineering, IT, systems, backend or frontend or
  fullstack development, product management, or data analysis/science.
  Unrelated fields (e.g. quant trading, hardware engineering, sales) are
  disqualifying.
- Must target Summer 2027 (postings phrased as targeting "Class of 2029"
  commonly mean this same Summer 2027 cohort), or state no specific
  graduation-date restriction. A posting clearly targeting a different
  summer or a different graduation class is disqualifying.
- Application must still be open as of the posting text.

Hackathons, workshops, summits and conferences:
- Registration must still be open and the event must not have already
  happened.
- Events located in North Carolina, South Carolina, Virginia, or Georgia
  are eligible regardless of travel reimbursement — note in reasoning
  whether the posting mentions travel reimbursement.
- Events outside those four states are eligible only if the posting text
  states or implies travel reimbursement/stipend is offered. If reimbursement
  is not mentioned, treat it as not offered, never assume it.

Fellowships, student ambassadorships, and scholarships:
- Must be open to international students (same rule as above).
`.trim();
