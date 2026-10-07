// ============================================================
// Supabase Clients
//
// Exports:
//   createBrowserSupabase  — new Blueprint v2 pages use this
//   createPlainSupabase    — older pre-existing pages use this
//   createLiveSupabase     — public pages that must never show stale rows
//   createServiceSupabase  — API routes that need admin access
// ============================================================

import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// --- Used by new Blueprint v2 dashboard pages ---
// IMPORTANT: this uses @supabase/ssr's cookie-based browser client so the
// session is stored in COOKIES — the exact same place the Next.js
// middleware (src/middleware.ts) reads from. That keeps login, the
// dashboard data reads, and Sign Out all in sync. (The previous version
// stored the session in localStorage, which the cookie-based middleware
// could not see — so data requests went out as "logged out" and only
// published rows came back.)
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// --- Used by older pre-existing pages (press, case-studies, bts, pitch, recap, etc.) ---
export function createPlainSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// --- Used by public pages that must always show the current rows (run of show) ---
// Same anon client as createPlainSupabase, but every request is sent with
// cache: "no-store". Without it Next stores the Supabase responses in its Data
// Cache, which on Vercel outlives deployments — `dynamic = "force-dynamic"` on
// the page was not enough to stop it (PR #294).
export function createLiveSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}

// --- Used by API routes that need full admin/service-role access ---
// The service role key bypasses Row Level Security (RLS),
// so this should ONLY be used in server-side API routes, never in browser code.
export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
