// ============================================================
// Browser Supabase Client — for 'use client' pages
//
// Creates a Supabase client that runs in the browser.
// Uses the public anon key (safe to expose client-side).
// ============================================================

// ============================================================
// Browser Supabase Client — for 'use client' pages
//
// Creates Supabase clients that run in the browser.
// Uses the public anon key (safe to expose client-side).
//
// Exports:
//   createBrowserSupabase  — new Blueprint v2 pages use this
//   createPlainSupabase    — older pre-existing pages use this
//   createServiceSupabase  — API routes that need admin access
// ============================================================

import { createClient } from '@supabase/supabase-js';

// --- Used by new Blueprint v2 dashboard pages ---
// Configured to store auth sessions in cookies (not just localStorage)
// so the Next.js middleware can check if a user is logged in.
export function createBrowserSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // flowType 'pkce' is the recommended secure flow for browser apps
        flowType: 'pkce',
        // Store session in cookies so middleware can read it server-side
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // Automatically refresh the session before it expires
        autoRefreshToken: true,
        // Persist the session between page loads
        persistSession: true,
        // Detect session from URL (for magic links, OAuth callbacks)
        detectSessionInUrl: true,
      },
    }
  );
}

// --- Used by older pre-existing pages (press, case-studies, bts, pitch, recap, etc.) ---
export function createPlainSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
