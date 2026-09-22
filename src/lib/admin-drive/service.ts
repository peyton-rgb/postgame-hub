// ============================================================
// Shared plumbing for /api/admin-drive/* — auth, the typed client, logging.
//
// Impure by design (env, network, database). Everything that DECIDES anything
// lives in ./contract.ts, which is pure and tested; this file only carries
// those decisions to Postgres.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/database.types";
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

/**
 * agent_runs.triggered_by is NOT NULL and a foreign key to auth.users, so a
 * machine caller still needs a human to hang the run on. Same fallback the
 * other unattended jobs use.
 */
async function resolveActor(db: AdminDriveDb): Promise<string | null> {
  const email = process.env.SLACK_FALLBACK_EMAIL;
  if (!email) return null;
  const { data } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}

export type RunLog = {
  endpoint: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: "complete" | "failed";
  startedAt: number;
  errorMessage?: string;
};

/**
 * Log the run under its own name.
 *
 * NOT reused from 'admin_sync', which is already standing in for five separate
 * nightly jobs and is only tellable apart by input_payload.source. Migration
 * 071 adds 'admin_drive_service' so these writes say what they are.
 *
 * A failed log never fails the request: the handoff already succeeded, and
 * turning a bookkeeping error into a 500 would make the admin retry a write
 * that landed. It is reported loudly instead.
 */
export async function logRun(db: AdminDriveDb, run: RunLog): Promise<void> {
  const actorId = await resolveActor(db);
  if (!actorId) {
    console.warn("[admin-drive] no actor to attribute the run to — skipping agent_runs insert");
    return;
  }
  const { error } = await db.from("agent_runs").insert({
    agent_name: "admin_drive_service",
    triggered_by: actorId,
    input_payload: { endpoint: run.endpoint, ...run.input } as Json,
    output_payload: run.output as Json,
    model: "none",
    status: run.status,
    duration_ms: Date.now() - run.startedAt,
    error_message: run.errorMessage ?? null,
  });
  if (error) console.error("[admin-drive] agent_runs insert failed:", error.message);
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
