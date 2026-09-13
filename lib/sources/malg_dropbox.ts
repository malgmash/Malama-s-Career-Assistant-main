import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Adapter, NormalizeResult, NormalizedOpportunity, RawPosting } from './types';

// Adapter for the MALG Opportunity Dropbox feed published as a JSON object
// with an `opportunities` array (not a bare Simplify array). See
// data/malg-dropbox-feed.json and supabase/migrations/005_seed_malg_dropbox_source.sql.
// Config shape: { url: string } — http(s) like other GitHub sources, or a
// local filesystem path / file:// URL for fixture runs.

const USER_AGENT =
  'malama-career-assistant/0.1 (+https://github.com/malgmash/Malama-s-Career-Assistant-main)';

const KIND_MAP = {
  internship: 'internship',
  hackathon: 'hackathon',
  // NormalizedOpportunity / opportunities.kind cannot grow without a
  // schema change. Conferences stay visible as hackathon + a conference tag.
  conference: 'hackathon',
} as const;

type FeedKind = keyof typeof KIND_MAP;

type DropboxListing = {
  kind: string;
  title: string;
  organization: string;
  url: string;
  description?: string;
  locations?: string[];
  deadlineLabel?: string;
  tags?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDropboxListing(value: unknown): value is DropboxListing {
  if (!isRecord(value)) return false;
  return (
    typeof value.kind === 'string' &&
    typeof value.title === 'string' &&
    typeof value.organization === 'string' &&
    typeof value.url === 'string'
  );
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function loadFeedJson(url: string): Promise<unknown> {
  if (isHttpUrl(url)) {
    const response = await globalThis.fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`malg_dropbox adapter: fetch failed with ${response.status}`);
    }
    return response.json();
  }

  const path = url.startsWith('file://') ? fileURLToPath(url) : url;
  const text = await readFile(path, 'utf8');
  return JSON.parse(text) as unknown;
}

function stableExternalId(item: DropboxListing): string {
  const basis = item.url.trim() || [item.kind, item.title, item.organization].join('\0');
  return createHash('sha256').update(basis).digest('hex');
}

// Only a standalone ISO calendar date (optionally followed by a time) counts.
// Prose labels like "October 23, 2026" or "10/30/2026" stay null.
function isoDeadline(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/.exec(value.trim());
  if (!match) return null;

  const isoDate = match[1];
  const [year, month, day] = isoDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return isoDate;
}

function locationText(locations: unknown): string | null {
  if (!Array.isArray(locations) || locations.length === 0) return null;
  const parts = locations.filter((loc): loc is string => typeof loc === 'string' && loc.length > 0);
  return parts.length > 0 ? parts.join('; ') : null;
}

function remoteFromLocations(locations: unknown): NormalizedOpportunity['remote'] {
  if (!Array.isArray(locations) || locations.length === 0) return 'unknown';
  const parts = locations.filter((loc): loc is string => typeof loc === 'string' && loc.length > 0);
  if (parts.length === 0) return 'unknown';
  return parts.every((loc) => /^remote/i.test(loc)) ? 'remote' : 'unknown';
}

function copiedTags(item: DropboxListing): string[] {
  const tags = Array.isArray(item.tags)
    ? item.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
    : [];
  if (item.kind === 'conference' && !tags.includes('conference')) {
    return [...tags, 'conference'];
  }
  return tags;
}

export const malgDropboxAdapter: Adapter = {
  kind: 'malg_dropbox',

  async fetch(config: Record<string, unknown>): Promise<RawPosting[]> {
    const url = config.url;
    if (typeof url !== 'string' || url.length === 0) {
      throw new Error('malg_dropbox adapter: config.url is required');
    }

    const data: unknown = await loadFeedJson(url);
    if (Array.isArray(data)) {
      throw new Error(
        'malg_dropbox adapter: expected an object with an opportunities array, not a top-level array',
      );
    }
    if (!isRecord(data) || !Array.isArray(data.opportunities)) {
      throw new Error('malg_dropbox adapter: expected an object with an opportunities array');
    }

    return data.opportunities.filter(isDropboxListing).map((item) => ({
      externalId: stableExternalId(item),
      payload: item,
    }));
  },

  async normalize(raw: RawPosting): Promise<NormalizeResult> {
    if (!isDropboxListing(raw.payload)) {
      return { kind: 'skip' };
    }

    const item = raw.payload;
    const mappedKind = KIND_MAP[item.kind as FeedKind];
    if (!mappedKind || item.title.trim() === '' || item.organization.trim() === '' || item.url.trim() === '') {
      return { kind: 'skip' };
    }

    return {
      kind: 'ok',
      opportunity: {
        kind: mappedKind,
        title: item.title,
        org: item.organization,
        location: locationText(item.locations),
        remote: remoteFromLocations(item.locations),
        url: item.url,
        description:
          typeof item.description === 'string' && item.description.length > 0
            ? item.description
            : null,
        deadline: isoDeadline(item.deadlineLabel),
        classYears: [],
        sponsorship: 'unknown',
        tags: copiedTags(item),
      },
    };
  },
};
