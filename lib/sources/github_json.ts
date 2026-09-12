import type { Adapter, NormalizeResult, RawPosting } from './types';

// Adapter for a source published as a single JSON array file on GitHub.
// Today's only user is the Simplify internship list — see
// supabase/migrations/002_seed_simplify_source.sql for its config row.
// Config shape: { url: string }.

const USER_AGENT =
  'malama-career-assistant/0.1 (+https://github.com/malgmash/Malama-s-Career-Assistant-main)';

// Fields observed on a Simplify listings.json entry. Only what normalize()
// reads is declared; anything else is carried through in RawPosting.payload
// untouched.
type SimplifyListing = {
  id: string;
  company_name: string;
  title: string;
  url: string;
  locations: string[];
  active: boolean;
  is_visible: boolean;
  sponsorship: string;
  category: string;
  degrees: string[];
};

function isSimplifyListing(value: unknown): value is SimplifyListing {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.title === 'string';
}

// Observed values in the live feed: 'Other', 'Offers Sponsorship',
// 'Does Not Offer Sponsorship', 'U.S. Citizenship is Required'. Only the
// two unambiguous ones are mapped; everything else (including citizenship
// requirements, which is a distinct fact from sponsorship) falls to
// 'unknown' rather than being guessed at.
const SPONSORSHIP_MAP: Record<string, 'yes' | 'no' | 'unknown'> = {
  'Does Not Offer Sponsorship': 'no',
  'Offers Sponsorship': 'yes',
};

function normalizeForDedupe(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export const githubJsonAdapter: Adapter = {
  kind: 'github_json',

  async fetch(config: Record<string, unknown>): Promise<RawPosting[]> {
    const url = config.url;
    if (typeof url !== 'string' || url.length === 0) {
      throw new Error('github_json adapter: config.url is required');
    }

    const response = await globalThis.fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`github_json adapter: fetch failed with ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('github_json adapter: expected a top-level JSON array');
    }

    return data.filter(isSimplifyListing).map((item) => ({
      externalId: item.id,
      payload: item,
    }));
  },

  async normalize(raw: RawPosting): Promise<NormalizeResult> {
    const item = raw.payload as SimplifyListing;

    if (item.is_visible === false) {
      return { kind: 'skip' };
    }

    const location =
      Array.isArray(item.locations) && item.locations.length > 0
        ? item.locations.join('; ')
        : null;

    const remote =
      Array.isArray(item.locations) &&
      item.locations.length > 0 &&
      item.locations.every((loc) => /^remote/i.test(loc))
        ? 'remote'
        : 'unknown';

    return {
      kind: 'ok',
      status: item.active === false ? 'closed' : 'open',
      opportunity: {
        kind: 'internship',
        title: item.title,
        org: item.company_name,
        location,
        remote,
        url: item.url,
        description: null,
        deadline: null,
        classYears: Array.isArray(item.degrees) ? item.degrees : [],
        sponsorship: SPONSORSHIP_MAP[item.sponsorship] ?? 'unknown',
        tags: item.category ? [item.category] : [],
      },
    };
  },
};

export { normalizeForDedupe };
