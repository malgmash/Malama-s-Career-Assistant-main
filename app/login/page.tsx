'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createAnonClient } from '@/lib/db/publicClient';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const client = createAnonClient();

    client.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: subscription } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const client = createAnonClient();
    const { error: signInError } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/login' },
    });

    if (signInError) {
      setStatus('error');
      setError(signInError.message);
      return;
    }
    setStatus('sent');
  }

  async function handleSignOut() {
    await createAnonClient().auth.signOut();
    setSession(null);
  }

  if (session) {
    return (
      <main>
        <h1>Signed in</h1>
        <p>Signed in as {session.user.email}.</p>
        <p><a href="/applications">Go to Applications</a></p>
        <button onClick={handleSignOut}>Sign out</button>
      </main>
    );
  }

  return (
    <main>
      <h1>Log in</h1>
      {status === 'sent' ? (
        <p>Check {email} for a sign-in link.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending...' : 'Send magic link'}
          </button>
          {error && <p>Error: {error}</p>}
        </form>
      )}
    </main>
  );
}
