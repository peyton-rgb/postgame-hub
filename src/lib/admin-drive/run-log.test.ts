// ============================================================
// The one rule this file exists to pin: THE agent_runs INSERT IS NEVER SKIPPED.
//
// It used to be. logRun returned early when no actor could be resolved, which
// made observability of these endpoints depend on SLACK_FALLBACK_EMAIL — an
// unrelated notification setting. Unset it and the endpoints ran fine and
// recorded nothing. A live smoke test caught the silence; the schema showed the
// justification ("triggered_by is NOT NULL") was simply untrue.
//
// A comment cannot hold that fixed, so these tests drive the real logRun with a
// stub database and assert the insert happened.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";

import { buildAgentRunRow, logRun, type RunLog } from "./run-log.ts";

/** Records what logRun tried to insert. `actor` decides what profiles returns. */
function stubDb(actor: string | null, insertError: { message: string } | null = null) {
  const inserts: Record<string, unknown>[] = [];
  const db = {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: actor ? { id: actor } : null }) }) }),
        };
      }
      if (table === "agent_runs") {
        return {
          insert: async (row: Record<string, unknown>) => {
            inserts.push(row);
            return { error: insertError };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { db, inserts };
}

const RUN: RunLog = {
  endpoint: "brand",
  input: { admin_account_id: "133" },
  output: { written: ["drive_parent_folder_id"] },
  status: "complete",
  startedAt: Date.now() - 50,
};

/** Silence the expected warning so a passing run reads clean. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = original;
  }
}

test("the insert STILL HAPPENS when no actor resolves", async () => {
  const { db, inserts } = stubDb(null);
  await quietly(() => logRun(db as never, RUN));

  assert.equal(inserts.length, 1, "a run with no actor must still be logged");
  assert.equal(inserts[0].triggered_by, null, "logged unattributed, not skipped");
  assert.equal(inserts[0].agent_name, "admin_drive_service");
});

test("SLACK_FALLBACK_EMAIL being unset does not silence the log", async () => {
  const before = process.env.SLACK_FALLBACK_EMAIL;
  try {
    delete process.env.SLACK_FALLBACK_EMAIL;
    const { db, inserts } = stubDb("unused-because-the-var-is-unset");
    await quietly(() => logRun(db as never, RUN));
    // The whole point: observability must not hinge on notification config.
    assert.equal(inserts.length, 1, "an unrelated Slack var must not gate agent_runs");
    assert.equal(inserts[0].triggered_by, null);
  } finally {
    if (before === undefined) delete process.env.SLACK_FALLBACK_EMAIL;
    else process.env.SLACK_FALLBACK_EMAIL = before;
  }
});

test("an actor is still attributed when one resolves", async () => {
  const before = process.env.SLACK_FALLBACK_EMAIL;
  try {
    process.env.SLACK_FALLBACK_EMAIL = "someone@example.com";
    const { db, inserts } = stubDb("actor-uuid-1");
    await logRun(db as never, RUN);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].triggered_by, "actor-uuid-1", "attribution still works");
  } finally {
    if (before === undefined) delete process.env.SLACK_FALLBACK_EMAIL;
    else process.env.SLACK_FALLBACK_EMAIL = before;
  }
});

test("a failed run is logged too, with its error", async () => {
  const { db, inserts } = stubDb(null);
  await quietly(() =>
    logRun(db as never, { ...RUN, status: "failed", errorMessage: "brand_not_mapped" }),
  );
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].status, "failed");
  assert.equal(inserts[0].error_message, "brand_not_mapped");
});

test("a failed INSERT is reported, never thrown — the handoff already landed", async () => {
  const { db, inserts } = stubDb("actor-uuid-1", { message: "boom" });
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    // Must not reject: the write this is logging already succeeded, and a 500
    // here would make the admin retry a handoff that landed.
    await logRun(db as never, RUN);
  } finally {
    console.error = original;
  }
  assert.equal(inserts.length, 1);
  assert.equal(errors.length, 1, "a failed log is reported loudly, not swallowed");
});

// ── The builder, directly ────────────────────────────────────────────────────

test("buildAgentRunRow always returns a row, actor or not", () => {
  const withActor = buildAgentRunRow({ status: "complete", startedAt: 0 }, "a", 100);
  const without = buildAgentRunRow({ status: "complete", startedAt: 0 }, null, 100);

  assert.ok(withActor, "a row is always produced");
  assert.ok(without, "including when nobody can be named for it");
  assert.equal(withActor.triggered_by, "a");
  assert.equal(without.triggered_by, null);
  assert.equal(without.duration_ms, 100);
  assert.equal(without.agent_name, "admin_drive_service");
});
