'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createAnonClient } from '@/lib/db/publicClient';
import { RANK_PROMPT_VERSION } from '@/lib/scoring/config';

// Matches docs/DATA-MODEL.md's applications.stage — plain text, no DB check
// constraint, but this is the fixed lifecycle the UI offers.
const STAGES = ['interested', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn'] as const;

type TrackedApplication = {
  id: string;
  stage: string;
  applied_at: string | null;
  notes: string | null;
  opportunity_id: string;
  opportunities: { title: string; org: string; url: string; deadline: string | null } | null;
};

type TrackableOpportunity = {
  id: string;
  title: string;
  org: string;
  url: string;
};

export default function ApplicationsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [applications, setApplications] = useState<TrackedApplication[] | null>(null);
  const [trackable, setTrackable] = useState<TrackableOpportunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Pure fetch, no setState — callable both from the initial-load effect
  // (inline, per the react-hooks set-state-in-effect rule) and from
  // mutation handlers below (as a plain async call, which the rule doesn't
  // restrict).
  const fetchData = useCallback(async (): Promise<{
    applications: TrackedApplication[];
    trackable: TrackableOpportunity[];
  }> => {
    const client = createAnonClient();

    const [{ data: apps, error: appsError }, { data: eligible, error: eligibleError }] = await Promise.all([
      client
        .from('applications')
        .select('id, stage, applied_at, notes, opportunity_id, opportunities(title, org, url, deadline)')
        .order('created_at', { ascending: false }),
      client
        .from('opportunities')
        .select('id, title, org, url, matches!inner(eligible, prompt_version)')
        .eq('matches.prompt_version', RANK_PROMPT_VERSION)
        .eq('matches.eligible', true),
    ]);

    if (appsError) throw appsError;
    if (eligibleError) throw eligibleError;

    const trackedIds = new Set((apps ?? []).map((a) => a.opportunity_id));
    return {
      applications: (apps ?? []) as unknown as TrackedApplication[],
      trackable: ((eligible ?? []) as unknown as TrackableOpportunity[]).filter((o) => !trackedIds.has(o.id)),
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchData();
      setApplications(result.applications);
      setTrackable(result.trackable);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchData]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchData();
        if (!cancelled) {
          setApplications(result.applications);
          setTrackable(result.trackable);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, fetchData]);

  async function addApplication(opportunityId: string) {
    const client = createAnonClient();
    const { data: inserted, error: insertError } = await client
      .from('applications')
      .insert({ opportunity_id: opportunityId, stage: 'interested' })
      .select('id')
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await client.from('app_events').insert({
      application_id: inserted.id,
      kind: 'stage_change',
      payload: { to: 'interested' },
    });
    await refresh();
  }

  async function changeStage(application: TrackedApplication, newStage: string) {
    const client = createAnonClient();
    const { error: updateError } = await client
      .from('applications')
      .update({ stage: newStage })
      .eq('id', application.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await client.from('app_events').insert({
      application_id: application.id,
      kind: 'stage_change',
      payload: { from: application.stage, to: newStage },
    });
    await refresh();
  }

  async function saveNotes(application: TrackedApplication, notes: string) {
    const client = createAnonClient();
    const { error: updateError } = await client
      .from('applications')
      .update({ notes })
      .eq('id', application.id);
    if (updateError) setError(updateError.message);
  }

  if (!checkedAuth) return <main><p>Loading...</p></main>;

  if (!session) {
    return (
      <main>
        <h1>Applications</h1>
        <p>You need to be logged in to view your application tracker. <a href="/login">Log in</a></p>
      </main>
    );
  }

  return (
    <main>
      <h1>Applications</h1>
      {error && <p>Error: {error}</p>}

      <section>
        <h2>Tracked</h2>
        {!applications || applications.length === 0 ? (
          <p>Nothing tracked yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Org</th>
                <th>Deadline</th>
                <th>Stage</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td><a href={app.opportunities?.url}>{app.opportunities?.title}</a></td>
                  <td>{app.opportunities?.org}</td>
                  <td>{app.opportunities?.deadline ?? '—'}</td>
                  <td>
                    <select value={app.stage} onChange={(e) => changeStage(app, e.target.value)}>
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <textarea
                      defaultValue={app.notes ?? ''}
                      onBlur={(e) => saveNotes(app, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Add from ranked feed</h2>
        {!trackable || trackable.length === 0 ? (
          <p>Nothing eligible left to add.</p>
        ) : (
          <ul>
            {trackable.map((o) => (
              <li key={o.id}>
                <a href={o.url}>{o.title}</a> — {o.org}{' '}
                <button onClick={() => addApplication(o.id)}>Track</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
