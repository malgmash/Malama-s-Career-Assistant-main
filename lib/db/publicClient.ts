'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser-safe client. Uses the public anon key only — never the
// service-role key. RLS on the anon role is scoped per-table (see
// supabase/migrations/003_anon_read_opportunities.sql); this client can
// only do what those policies allow.
//
// Singleton, not a fresh client per call. Every page called this on every
// fetch and every button click, which meant a new internal auth listener
// (GoTrueClient) on every call — Supabase warns loudly about this
// ("multiple GoTrueClient instances... undefined behavior") because they
// all fight over the same session storage key, and it can mean a request
// silently goes out on a stale or wrong session instead of the real one.
let client: SupabaseClient | null = null;

export function createAnonClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set',
    );
  }
  client = createClient(url, anonKey);
  return client;
}
