'use client';

import { useEffect, useState } from 'react';
import { createAnonClient } from '@/lib/db/publicClient';

type OpportunityRow = {
  id: string;
  title: string;
  org: string;
  location: string | null;
  deadline: string | null;
  url: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
};

export default function OpportunitiesPage() {
  const [rows, setRows] = useState<OpportunityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    createAnonClient()
      .from('opportunities')
      .select('id, title, org, location, deadline, url, status, first_seen_at, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setRows(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <main><p>Failed to load opportunities: {error}</p></main>;
  if (!rows) return <main><p>Loading...</p></main>;

  return (
    <main>
      <h1>Opportunities</h1>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Org</th>
            <th>Location</th>
            <th>Deadline</th>
            <th>Status</th>
            <th>First seen</th>
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><a href={row.url}>{row.title}</a></td>
              <td>{row.org}</td>
              <td>{row.location ?? '—'}</td>
              <td>{row.deadline ?? '—'}</td>
              <td>{row.status}</td>
              <td>{row.first_seen_at}</td>
              <td>{row.last_seen_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
