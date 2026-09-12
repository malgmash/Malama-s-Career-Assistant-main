import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-side only. This holds the service-role key, which bypasses RLS.
// Never import this module from a client component — use the public anon
// client (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) there
// instead. See CLAUDE.md non-negotiable #5.
if (typeof window !== 'undefined') {
  throw new Error('lib/db/client.ts must never be imported in the browser');
}

let cached: SupabaseClient | null = null;

export function createServiceRoleClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the service-role client',
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
