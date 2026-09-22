// ============================================================
// Shared plumbing for /api/admin-drive/* — auth, the typed client, logging.
//
// Impure by design (env, network, database). Everything that DECIDES anything
// lives in ./contract.ts, which is pure and tested; this file only carries
// those decisions to Postgres.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./db-types";

/**
 * Service-role client, typed, and pinned to `cache: 'no-store'`.
 *
 * `createClient<Database>` (supabase-js) types correctly. `createServerClient`
 * (@supabase/ssr 0.5.2) does NOT — it imports a path that supabase-js 2.115
 * does not ship, and every row type in the file collapses to `never`. These
 * endpoints use the plain client, so the row types here are real.
 *
 * no-store for the same reason createLiveServiceSupabase exists: Next patches
 * global fetch and caches PostgREST GETs in a file-backed Data Cache that
 * `export const dynamic = 'force-dynamic'` does not defeat. Every read in these
 * routes decides something — whether an id conflicts, whether a campaign exists
 * yet — and a cached read would decide it on stale data: a 409 against an id
 * that was already reconciled, or a 202 parking a handoff for a campaign that
 * arrived an hour ago.
 */
export function adminDriveDb() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
}

export type AdminDriveDb = ReturnType<typeof adminDriveDb>;

// Re-exported so the routes keep importing everything from one place. The
// implementation lives in ./run-log, which deliberately does not import
// next/server — see the note there.
export { logRun, type RunLog } from "./run-log";

/**
 * 404, not 401.
 *
 * An unauthenticated caller learns nothing about whether these routes exist.
 * They accept writes from outside the Hub's own session boundary, so the fact
 * of them is not worth confirming to someone who cannot use them.
 */
export const NOT_FOUND = NextResponse.json({ error: "Not found" }, { status: 404 });

/**
 * Fail CLOSED. A missing secret is a locked door, not an open one.
 *
 * Deliberately unlike cronAuthorized() in /api/sync/*, which falls back to
 * "allowed" when NODE_ENV !== production so local dev can run it. That
 * trade-off is defensible for a cron that reconciles read-only data from a
 * system we control. It is not defensible here: this endpoint takes ids from
 * off-box and writes them onto brands and campaigns. There is no environment
 * in which an absent secret should mean yes.
 */
export function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_DRIVE_SERVICE_SECRET;
  if (!secret) return false;
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

/** Parse a JSON body without letting a malformed one throw a 500. */
export async function readJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
