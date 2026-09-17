'use client';

import { useEffect, useState } from 'react';
import { createAnonClient } from '@/lib/db/publicClient';
import { fetchAllPages } from '@/lib/db/pagination';
import { RANK_PROMPT_VERSION } from '@/lib/scoring/config';

type MatchedOpportunityRow = {
  id: string;
  kind: string;
  title: string;
  org: string;
  location: string | null;
  deadline: string | null;
  url: string;
  tags: string[];
  status: string;
  matches: Array<{
    llm_score: number;
    reasoning: string;
    blockers: string[];
  }>;
};

type Category = {
  label: string;
  rows: MatchedOpportunityRow[];
};

// User-confirmed list, drawn from her own past tailored-resume filenames
// plus two she named directly (Uber, Netflix) — not a guessed "big tech"
// list. Matched as a case-insensitive substring of `org`, since org values
// are often verbose ("Enact Holdings (Genworth majority-owned)").
const PRIORITY_COMPANIES = [
  'amazon', 'apple', 'boeing', 'citadel', 'coca-cola', 'coca cola', 'databricks',
  'datadog', 'five rings', 'hp', 'ibm', 'intuit', 'jpmorgan', 'jp morgan',
  'microsoft', 'nvidia', 'notion', 'openai', 'open ai', 'paypal', 'roblox',
  'western digital', 'google', 'adobe', 'uber', 'netflix',
];

function isPriorityCompany(org: string): boolean {
  const normalized = org.toLowerCase();
  return PRIORITY_COMPANIES.some((company) => normalized.includes(company));
}

// Priority-company rows first (own relative rank order preserved within
// that group), then everything else by rank — rank alone still decides
// order within each group, per "the rest use the rank."
function sortWithPriority(rows: MatchedOpportunityRow[]): MatchedOpportunityRow[] {
  return [...rows].sort((a, b) => {
    const aPriority = isPriorityCompany(a.org) ? 0 : 1;
    const bPriority = isPriorityCompany(b.org) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (b.matches[0]?.llm_score ?? 0) - (a.matches[0]?.llm_score ?? 0);
  });
}

// Matches the five categories requested for the ranked feed. `conference`
// is stored as kind='hackathon' plus a 'conference' tag (see
// lib/sources/malg_dropbox.ts), so it's split out by tag, not a distinct
// kind — the opportunities.kind enum is closed per docs/DATA-MODEL.md.
function categorize(rows: MatchedOpportunityRow[]): Category[] {
  const conferences = rows.filter((r) => r.kind === 'hackathon' && r.tags.includes('conference'));
  const hackathons = rows.filter((r) => r.kind === 'hackathon' && !r.tags.includes('conference'));
  const internships = rows.filter((r) => r.kind === 'internship');
  const fellowships = rows.filter((r) => r.kind === 'fellowship');
  const scholarships = rows.filter((r) => r.kind === 'scholarship');

  return [
    { label: 'Conferences, summits & workshops', rows: sortWithPriority(conferences) },
    { label: 'Hackathons', rows: sortWithPriority(hackathons) },
    { label: 'Internships', rows: sortWithPriority(internships) },
    { label: 'Fellowships & student ambassadorships', rows: sortWithPriority(fellowships) },
    { label: 'Scholarships', rows: sortWithPriority(scholarships) },
  ];
}

// Cycled by card index for visual variety in place of per-opportunity
// photos, which the source data doesn't provide.
const HEADER_COLORS = ['#3b2f5e', '#0f3d5c', '#1a1a1a', '#5c1a2e', '#12463d', '#3a2a17'];

function OpportunityCard({ row, colorIndex }: { row: MatchedOpportunityRow; colorIndex: number }) {
  const match = row.matches[0];
  const priority = isPriorityCompany(row.org);
  return (
    <a className="card" href={row.url} target="_blank" rel="noreferrer">
      <div className="card-header" style={{ background: HEADER_COLORS[colorIndex % HEADER_COLORS.length] }}>
        {priority && <span className="card-badge">Priority</span>}
        <span className="card-org">{row.org}</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{row.title}</h3>
        {match?.reasoning && <p className="card-desc">{match.reasoning}</p>}
        <div className="card-meta">
          {row.deadline && <span>Deadline {row.deadline}</span>}
          {typeof match?.llm_score === 'number' && <span>Fit {match.llm_score}/100</span>}
        </div>
      </div>
    </a>
  );
}

function CategorySection({ category, colorOffset }: { category: Category; colorOffset: number }) {
  if (category.rows.length === 0) return null;

  return (
    <section className="category-container">
      <h2>{category.label}</h2>
      <div className="grid">
        {category.rows.map((row, i) => (
          <OpportunityCard key={row.id} row={row} colorIndex={colorOffset + i} />
        ))}
      </div>
    </section>
  );
}

export default function OpportunitiesPage() {
  const [rows, setRows] = useState<MatchedOpportunityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const client = createAnonClient();

    // Paginated per lib/db/pagination.ts — confirmed the hard way that the
    // eligible-matches set had already grown past Supabase's 1000-row
    // default cap, which was silently dropping real opportunities from
    // this exact query before this fix.
    fetchAllPages<MatchedOpportunityRow>((from, to) =>
      client
        .from('opportunities')
        .select(
          'id, kind, title, org, location, deadline, url, tags, status, matches!inner(llm_score, reasoning, blockers, eligible, prompt_version)',
        )
        .eq('matches.prompt_version', RANK_PROMPT_VERSION)
        .eq('matches.eligible', true)
        .order('llm_score', { foreignTable: 'matches', ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: MatchedOpportunityRow[] | null; error: unknown }>,
    )
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <main><p>Failed to load opportunities: {error}</p></main>;
  if (!rows) return <main><p>Loading...</p></main>;

  const categories = categorize(rows);
  const hasAny = categories.some((c) => c.rows.length > 0);

  return (
    <main className="page">
      <h1>Opportunities</h1>
      {!hasAny && <p>No ranked opportunities yet.</p>}
      {categories.map((category, i) => (
        <CategorySection key={category.label} category={category} colorOffset={i * 3} />
      ))}

      <style jsx>{`
        .page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 16px 64px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .category-container {
          margin-top: 32px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 16px;
          background: #fafafa;
          padding: 24px;
        }
        .category-container h2 {
          font-size: 1.25rem;
          margin: 0 0 16px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
        }
      `}</style>
      <style jsx global>{`
        .card {
          display: block;
          border-radius: 12px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: #fff;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
        }
        .card-header {
          height: 110px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px 16px;
        }
        .card-badge {
          background: rgba(255, 255, 255, 0.9);
          color: #1a1a1a;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .card-org {
          color: #fff;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          opacity: 0.9;
        }
        .card-body {
          padding: 16px;
        }
        .card-title {
          font-size: 1rem;
          font-weight: 700;
          margin: 0 0 8px;
          line-height: 1.3;
        }
        .card-desc {
          font-size: 0.875rem;
          color: #444;
          margin: 0 0 12px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-meta {
          display: flex;
          gap: 12px;
          font-size: 0.75rem;
          color: #777;
        }
      `}</style>
    </main>
  );
}
