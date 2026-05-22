// ============================================================
// Server Supabase Clients — for API routes and server components
//
// createServerSupabase()  — uses anon key, respects RLS
// createServiceSupabase() — uses service role key, bypasses RLS
// ============================================================

import { createClient } from '@supabase/supabase-js';

export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
