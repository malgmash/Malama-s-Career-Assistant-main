'use client';

import { useEffect, useState } from 'react';
import { createAnonClient } from '@/lib/db/publicClient';

type Digest = {
  id: string;
  computed_at: string;
  new_count: number;
  closing_soon_count: number;
  summary: string;
  details: {
    new: string[];
    closingSoon: string[];
    blockerClusters: Array<{ term: string; count: number }>;
  };
};

export default function DigestPage() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    createAnonClient()
      .from('digests')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
        } else {
          setDigest(data as unknown as Digest | null);
        }
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <main><p>Failed to load digest: {error}</p></main>;
  if (!loaded) return <main><p>Loading...</p></main>;

  return (
    <main>
      <h1>Weekly digest</h1>
      {!digest ? (
        <p>No digest computed yet.</p>
      ) : (
        <>
          <p>As of {digest.computed_at}</p>
          <p>{digest.summary}</p>

          <section>
            <h2>New this week ({digest.new_count})</h2>
            {digest.details.new.length === 0 ? (
              <p>Nothing new.</p>
            ) : (
              <ul>{digest.details.new.map((line, i) => <li key={i}>{line}</li>)}</ul>
            )}
          </section>

          <section>
            <h2>Closing soon ({digest.closing_soon_count})</h2>
            {digest.details.closingSoon.length === 0 ? (
              <p>Nothing closing soon.</p>
            ) : (
              <ul>{digest.details.closingSoon.map((line, i) => <li key={i}>{line}</li>)}</ul>
            )}
          </section>

          <section>
            <h2>Recurring blockers</h2>
            {digest.details.blockerClusters.length === 0 ? (
              <p>No recurring blockers.</p>
            ) : (
              <ul>
                {digest.details.blockerClusters.map((c) => (
                  <li key={c.term}>{c.term} — {c.count}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
