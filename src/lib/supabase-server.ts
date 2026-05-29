// ============================================================
// Server Supabase Clients — for API routes and server components
//
// createServerSupabase()  — uses anon key, respects RLS
// createServiceSupabase() — uses service role key, bypasses RLS
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cookie-aware server client. Reads the logged-in user's session from the
// browser's auth cookies so API routes can tell WHO is making the request.
//
// The old version used a plain anon client with NO cookie handling, so every
// auth-protected route saw "no user" and returned 401 — which is why the
// intake queue (and other dashboards) silently showed nothing, and why the
// "Tag with AI" action couldn't run from the browser.
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Route handlers only need to READ the session for auth checks,
        // so set/remove are safe no-ops here.
        set() {},
        remove() {},
      },
    }
  );
}

export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
