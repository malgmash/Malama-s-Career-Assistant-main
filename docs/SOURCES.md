# Sources

## Policy

Only ingest from sources that publish structured data or explicitly permit
automated access. No headless browsers against job portals. No scraping
LinkedIn, Indeed, Glassdoor, or any site whose terms prohibit it.

This is not caution for its own sake. Anti-bot systems make those sources
unreliable, and account bans on real job platforms cost more than the data is
worth.

Respect `robots.txt`. Send a descriptive user agent with a contact address.
Rate limit per host. Back off on 429 and 5xx.

## Adapter contract

Every source implements the same interface. Adding a source means adding one
file, never touching the worker.

```ts
// lib/sources/types.ts

export type RawPosting = {
  externalId: string;
  payload: unknown;
};

export type NormalizedOpportunity = {
  kind: 'internship' | 'newgrad' | 'hackathon' | 'scholarship' | 'fellowship';
  title: string;
  org: string;
  location: string | null;
  remote: 'onsite' | 'hybrid' | 'remote' | 'unknown';
  url: string;
  description: string | null;
  deadline: string | null;        // ISO date or null. Never inferred.
  classYears: string[];
  sponsorship: 'yes' | 'no' | 'unknown';
  tags: string[];
};

export interface Adapter {
  kind: string;
  fetch(config: Record<string, unknown>): Promise<RawPosting[]>;
  normalize(raw: RawPosting): Promise<NormalizedOpportunity>;
}
```

`fetch` does network work and nothing else. `normalize` does no network work
and may call the LLM only for unstructured fields.

## Source registry

| Source | Kind | Access | Notes |
| --- | --- | --- | --- |
| Greenhouse boards | `greenhouse` | Public JSON per company board | One config entry per company slug |
| Lever postings | `lever` | Public JSON per company | Same pattern as Greenhouse |
| Ashby job boards | `ashby` | Public JSON per company | Add after the first two work |
| Simplify internship list | `github_json` | Raw file on GitHub | High volume, updates constantly |
| MALG Opportunity Dropbox | `malg_dropbox` | Raw file on GitHub | Object-with-`opportunities` feed in this repo (`data/malg-dropbox-feed.json`). `conference` maps to kind `hackathon` plus a `conference` tag (the opportunity kind enum is closed). Deadline is set only when `deadlineLabel` is already an ISO date; prose labels stay null. |
| MLH season list | `github_json` | Published season data | Hackathons |
| Devpost | `rss` | Public feeds | Hackathons, noisy |
| Scholarship feeds | `rss` | Varies | Start with two, expand slowly |

Company slugs for Greenhouse and Lever live in `sources.config`, not in code.
Adding a target company is a database insert, not a deploy.

## Ingestion rules

1. Hash the payload. Skip if `(source_id, content_hash)` already exists.
2. Insert into `raw_postings` before doing anything else.
3. Normalize in a separate pass so a normalization bug never loses data.
4. On adapter failure, log to `sources.last_error` and continue to the next
   source. One bad adapter never aborts the run.
5. Update `opportunities.last_seen_at` on every sighting. A row not seen for
   14 days moves to `status = 'stale'`.

## Adding a source

1. Write the adapter in `lib/sources/<kind>.ts`.
2. Add a fixture in `lib/sources/__fixtures__/<kind>.json` captured from a
   real response.
3. Register the kind in the adapter map.
4. Insert the source row with its config.
5. Run once against the fixture, then once live, then enable the schedule.
