'use client';

import { useEffect, useState } from 'react';
import { createAnonClient } from '@/lib/db/publicClient';
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
    { label: 'Conferences, summits & workshops', rows: conferences },
    { label: 'Hackathons', rows: hackathons },
    { label: 'Internships', rows: internships },
    { label: 'Fellowships & student ambassadorships', rows: fellowships },
    { label: 'Scholarships', rows: scholarships },
  ];
}

function CategoryTable({ category }: { category: Category }) {
  if (category.rows.length === 0) return null;

  return (
    <section>
      <h2>{category.label}</h2>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Org</th>
            <th>Location</th>
            <th>Deadline</th>
            <th>Fit score</th>
            <th>Reasoning</th>
            <th>Blockers</th>
          </tr>
        </thead>
        <tbody>
          {category.rows.map((row) => {
            const match = row.matches[0];
            return (
              <tr key={row.id}>
                <td><a href={row.url}>{row.title}</a></td>
                <td>{row.org}</td>
                <td>{row.location ?? '—'}</td>
                <td>{row.deadline ?? '—'}</td>
                <td>{match?.llm_score ?? '—'}</td>
                <td>{match?.reasoning ?? '—'}</td>
                <td>{match?.blockers.length ? match.blockers.join('; ') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default function OpportunitiesPage() {
  const [rows, setRows] = useState<MatchedOpportunityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    createAnonClient()
      .from('opportunities')
      .select(
        'id, kind, title, org, location, deadline, url, tags, status, matches!inner(llm_score, reasoning, blockers, eligible, prompt_version)',
      )
      .eq('matches.prompt_version', RANK_PROMPT_VERSION)
      .eq('matches.eligible', true)
      .order('llm_score', { foreignTable: 'matches', ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setRows((data ?? []) as unknown as MatchedOpportunityRow[]);
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
    <main>
      <h1>Opportunities</h1>
      {!hasAny && <p>No ranked opportunities yet.</p>}
      {categories.map((category) => (
        <CategoryTable key={category.label} category={category} />
      ))}
    </main>
  );
}
