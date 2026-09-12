// Adapter contract. See docs/SOURCES.md — this is a fixed interface, not a
// per-source design surface. Adding a source means adding one file that
// implements Adapter, never touching this file or the worker.

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
  deadline: string | null; // ISO date or null. Never inferred.
  classYears: string[];
  sponsorship: 'yes' | 'no' | 'unknown';
  tags: string[];
};

// docs/SOURCES.md's Adapter.normalize returns NormalizedOpportunity directly.
// This wraps it to add two signals no source-neutral field can carry: a
// source's own moderation flag (skip — never create/update an opportunity
// row) and a source's own open/closed fact (status — distinct from a
// normalization failure, which is a thrown error, left for retry).
export type NormalizeResult =
  | { kind: 'ok'; opportunity: NormalizedOpportunity; status?: 'open' | 'closed' }
  | { kind: 'skip' };

export interface Adapter {
  kind: string;
  fetch(config: Record<string, unknown>): Promise<RawPosting[]>;
  normalize(raw: RawPosting): Promise<NormalizeResult>;
}
