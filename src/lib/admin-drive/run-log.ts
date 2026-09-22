// ============================================================
// Writing agent_runs for the admin Drive endpoints.
//
// SEPARATE FROM service.ts ON PURPOSE. Logging a run has nothing to do with
// HTTP, and service.ts imports next/server, which cannot be resolved by the
// plain `node --test` runner this repo uses. Keeping the two apart is what lets
// the rule below be driven by a real test instead of asserted in a comment —
// and the rule is here precisely because a comment failed to hold it before.
// ============================================================

import type { Json } from "@/lib/database.types";
import type { AdminDriveDb } from "./service";

export type RunLog = {
  endpoint: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: "complete" | "failed";
  startedAt: number;
  errorMessage?: string;
};

/**
 * Best-effort attribution: which human to hang an unattended run on.
 *
 * Returns null freely. agent_runs.triggered_by is NULLABLE (verified against
 * the live schema; recap_readiness, tier3_scorer, health_check, auto_editor and
 * suggestions have all been logging with a null actor for months), so failing
 * to resolve one is a missing NICE-TO-HAVE, not a reason to skip the log.
 *
 * An earlier version of this file claimed the column was NOT NULL and used that
 * to justify returning early. It is not, and the generated types said so all
 * along — the claim came from a comment, not from the schema.
 */
async function resolveActor(db: AdminDriveDb): Promise<string | null> {
  const email = process.env.SLACK_FALLBACK_EMAIL;
  if (!email) return null;
  const { data } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}

/**
 * Log the run under its own name.
 *
 * NOT reused from 'admin_sync', which is already standing in for five separate
 * nightly jobs and is only tellable apart by input_payload.source. Migration
 * 071 adds 'admin_drive_service' so these writes say what they are.
 *
 * THE INSERT IS NEVER SKIPPED. Attribution is attempted, and a run nobody can
 * be named for is logged unattributed rather than not logged — `triggered_by`
 * is nullable and other agents already use it that way.
 *
 * This used to return early when no actor resolved, which tied whether these
 * endpoints were observable at all to SLACK_FALLBACK_EMAIL, a variable about
 * notification config that has nothing to do with them. Unset it and the
 * endpoints kept working and recorded nothing — an unobservable write path,
 * which is the same swallow this codebase has spent the week removing. A
 * missing actor now costs one column, not the whole row.
 *
 * A failed log never fails the request: the handoff already succeeded, and
 * turning a bookkeeping error into a 500 would make the admin retry a write
 * that landed. It is reported loudly instead.
 */
export async function logRun(db: AdminDriveDb, run: RunLog): Promise<void> {
  const actorId = await resolveActor(db);
  if (!actorId) {
    // Information, not a gate. The insert below happens either way.
    console.warn(
      "[admin-drive] no actor resolved — logging this run unattributed (triggered_by null)",
    );
  }

  const { error } = await db.from("agent_runs").insert({
    ...buildAgentRunRow(run, actorId),
    input_payload: { endpoint: run.endpoint, ...run.input } as Json,
    output_payload: run.output as Json,
  });
  if (error) console.error("[admin-drive] agent_runs insert failed:", error.message);
}

// ── The agent_runs row ───────────────────────────────────────────────────────

/** The parts of a run that do not depend on a database or a clock. */
export type RunFacts = {
  status: "complete" | "failed";
  startedAt: number;
  errorMessage?: string;
};

/**
 * Build the agent_runs row for a run, attributed or not.
 *
 * ALWAYS RETURNS A ROW. There is no "no actor, no log" case, and that is the
 * point: this function exists so the rule can be pinned by a test rather than
 * living as an absent early-return that nothing checks. `triggered_by` is
 * nullable, so an unattributable run is logged with a null actor — losing the
 * name of a person is worth far less than losing the record that the write
 * happened at all.
 */
export function buildAgentRunRow(facts: RunFacts, actorId: string | null, now = Date.now()) {
  return {
    agent_name: "admin_drive_service" as const,
    triggered_by: actorId,
    model: "none",
    status: facts.status,
    duration_ms: now - facts.startedAt,
    error_message: facts.errorMessage ?? null,
  };
}
