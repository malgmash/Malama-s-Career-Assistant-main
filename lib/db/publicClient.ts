'use client';

import { createClient } from '@supabase/supabase-js';

// Browser-safe client. Uses the public anon key only — never the
// service-role key. RLS on the anon role is scoped per-table (see
// supabase/migrations/003_anon_read_opportunities.sql); this client can
// only do what those policies allow.
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set',
    );
  }
  return createClient(url, anonKey);
}
