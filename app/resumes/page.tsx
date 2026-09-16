'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createAnonClient } from '@/lib/db/publicClient';

const ROLE_FAMILIES = ['swe_intern'] as const; // only rubric that exists so far

type ResumeRow = {
  id: string;
  label: string;
  role_family: string | null;
  created_at: string;
};

type TrackedOpportunity = {
  opportunity_id: string;
  opportunities: { title: string; org: string } | null;
};

type ReviewRow = {
  id: string;
  total_score: number;
  subscores: { coverage: number; term_match: number; structure: number; quantification: number };
  findings: {
    coverage: Array<{ requirementId: number; met: boolean; proof: string | null }>;
    requirements: Array<{ text: string; kind: string; category: string }>;
    termMatch: { suggestedAdditions: string[]; unsupportedGaps: string[] };
    structure: { nonActionVerbBullets: string[]; overLongBulletCount: number; pageCountOk: boolean };
    quantification: { bulletsMissingNumbers: string[]; quantifiedBulletPercent: number };
  };
  created_at: string;
  resumes: { label: string } | null;
  opportunities: { title: string; org: string } | null;
};

export default function ResumesPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [resumes, setResumes] = useState<ResumeRow[] | null>(null);
  const [tracked, setTracked] = useState<TrackedOpportunity[] | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const client = createAnonClient();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckedAuth(true);
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    const client = createAnonClient();
    const [{ data: resumeRows, error: resumesError }, { data: appRows, error: appsError }, { data: reviewRows, error: reviewsError }] =
      await Promise.all([
        client.from('resumes').select('id, label, role_family, created_at').order('created_at', { ascending: false }),
        client.from('applications').select('opportunity_id, opportunities(title, org)'),
        client
          .from('reviews')
          .select('id, total_score, subscores, findings, created_at, resumes(label), opportunities(title, org)')
          .order('created_at', { ascending: false }),
      ]);
    if (resumesError) throw resumesError;
    if (appsError) throw appsError;
    if (reviewsError) throw reviewsError;
    setResumes((resumeRows ?? []) as unknown as ResumeRow[]);
    setTracked((appRows ?? []) as unknown as TrackedOpportunity[]);
    setReviews((reviewRows ?? []) as unknown as ReviewRow[]);
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        await fetchData();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, fetchData]);

  async function refresh() {
    try {
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    const client = createAnonClient();
    const storagePath = `${crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await client.storage.from('resumes').upload(storagePath, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await client
      .from('resumes')
      .insert({ label, storage_path: storagePath, role_family: ROLE_FAMILIES[0] });
    if (insertError) {
      setError(insertError.message);
      setUploading(false);
      return;
    }

    setLabel('');
    setFile(null);
    setUploading(false);
    await refresh();
  }

  async function requestReview(resumeId: string, opportunityId: string) {
    const client = createAnonClient();
    const { error: insertError } = await client
      .from('review_requests')
      .insert({ resume_id: resumeId, opportunity_id: opportunityId });
    if (insertError) setError(insertError.message);
  }

  if (!checkedAuth) return <main><p>Loading...</p></main>;

  if (!session) {
    return (
      <main>
        <h1>Resumes</h1>
        <p>You need to be logged in. <a href="/login">Log in</a></p>
      </main>
    );
  }

  return (
    <main>
      <h1>Resumes</h1>
      {error && <p>Error: {error}</p>}

      <section>
        <h2>Upload a resume</h2>
        <form onSubmit={handleUpload}>
          <label>
            Label
            <input type="text" required value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <input
            type="file"
            accept="application/pdf"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
        </form>
      </section>

      <section>
        <h2>Your resumes</h2>
        {!resumes || resumes.length === 0 ? (
          <p>Nothing uploaded yet.</p>
        ) : (
          <ul>
            {resumes.map((resume) => (
              <li key={resume.id}>
                {resume.label} ({resume.role_family ?? 'no role family'})
                {' — request review against: '}
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) requestReview(resume.id, e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="" disabled>Choose a tracked application</option>
                  {(tracked ?? []).map((t) => (
                    <option key={t.opportunity_id} value={t.opportunity_id}>
                      {t.opportunities?.title} — {t.opportunities?.org}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
        <p>
          Requesting a review just queues it — run <code>npm run review:once</code> (or the GitHub
          Action&apos;s Run workflow button) to actually compute it.
        </p>
      </section>

      <section>
        <h2>Reviews</h2>
        {!reviews || reviews.length === 0 ? (
          <p>No completed reviews yet.</p>
        ) : (
          reviews.map((review) => (
            <article key={review.id}>
              <h3>
                {review.resumes?.label} vs {review.opportunities?.title} ({review.opportunities?.org}) —{' '}
                {review.total_score}/100
              </h3>
              <ul>
                <li>Coverage: {review.subscores.coverage}</li>
                <li>Term match: {review.subscores.term_match}</li>
                <li>Structure: {review.subscores.structure}</li>
                <li>Quantification: {review.subscores.quantification}</li>
              </ul>
              <p>Missing requirements:</p>
              <ul>
                {review.findings.requirements
                  .map((req, id) => ({ req, covered: review.findings.coverage.find((c) => c.requirementId === id) }))
                  .filter((r) => !r.covered?.met)
                  .map((r, i) => <li key={i}>{r.req.text} ({r.req.kind})</li>)}
              </ul>
              {review.findings.termMatch.suggestedAdditions.length > 0 && (
                <p>Safe to add (you have this, resume doesn&apos;t say it): {review.findings.termMatch.suggestedAdditions.join(', ')}</p>
              )}
              {review.findings.termMatch.unsupportedGaps.length > 0 && (
                <p>Real gaps (no backing fact): {review.findings.termMatch.unsupportedGaps.join(', ')}</p>
              )}
              {review.findings.structure.nonActionVerbBullets.length > 0 && (
                <p>Bullets not starting with an action verb: {review.findings.structure.nonActionVerbBullets.length}</p>
              )}
              {review.findings.quantification.bulletsMissingNumbers.length > 0 && (
                <p>Bullets missing a number ({review.findings.quantification.quantifiedBulletPercent}% quantified overall)</p>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
