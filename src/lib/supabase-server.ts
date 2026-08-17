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

// ============================================================
// createActionSupabase() — cookie-WRITING client, for Server Actions
// that sign a user in or out.
//
// createServerSupabase() above deliberately no-ops set/remove because it
// is used from route handlers that only READ a session. That makes it
// silently useless for signInWithPassword: the call succeeds, returns a
// session, and then the cookie is thrown away, so the browser keeps
// whatever session it already had.
//
// That is not a cosmetic failure. Observed during the pilot rehearsal: a
// brand user completed signup in a browser that still held a STAFF
// session, the sign-in silently did not take, and they were redirected
// into /dashboard as the staff user. The account was created correctly —
// the session simply never changed hands.
//
// Only call this from a Server Action or Route Handler; cookies() is
// read-only during a page render and Next will throw.
// ============================================================
export function createActionSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
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

// ============================================================
// createLiveServiceSupabase() — service client that can NEVER serve a
// cached row.
//
// Next.js patches global fetch and stores GET responses in a
// file-backed Data Cache under .next/cache/fetch-cache. supabase-js
// goes through that fetch, so a PostgREST read gets cached like any
// other GET — and the cache is keyed on the REST URL, so it is not
// busted by reloading the page, by a cache-busting query param on the
// page, or even by restarting the server.
//
// `export const dynamic = 'force-dynamic'` on the route does NOT stop
// this. Verified on Next 14.2 against a real invite: the signup page
// kept serving a stale invited_email through repeated requests and a
// full process restart, with 9 entries sitting in fetch-cache.
//
// For anything that decides ACCESS that is a security bug, not a
// staleness annoyance: a revoked or expired invite would keep handing
// out a working signup page from cache. Reads that gate access must ask
// the database every time, so this client pins cache: 'no-store' at the
// fetch layer where no route-level config can forget it.
//
// Deliberately a SEPARATE export rather than a change to
// createServiceSupabase(): that one has 112 call sites and switching
// them all off the Data Cache in one go is a load decision for Peyton,
// not a side effect of this fix. See the PR notes.
// ============================================================
export function createLiveServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
