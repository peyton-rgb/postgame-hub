// scripts/rescore-submissions.ts
// ─────────────────────────────────────────────────────────────
// Re-score specific tier3_submissions rows by id.
//
// Scoring normally only ever fires from the upload path
// (/api/submit/[token] -> /api/tier3/process), so there is no way to re-run it
// on a row that already exists. This is that way.
//
// It does NOT reimplement scoring. It POSTs to /api/tier3/process, so there
// stays exactly one scorer — a second copy of that logic would drift from the
// route within a release or two, and the whole point of the last fix was that
// a wrong score is worse than no score.
//
// Run (against a local server pointed at the real database):
//   npm start &                                                  # or: npm run dev
//   npx tsx --env-file=.env.local scripts/rescore-submissions.ts --id <uuid>            # dry run
//   npx tsx --env-file=.env.local scripts/rescore-submissions.ts --id <uuid> --execute  # writes
//
// DRY RUN IS THE DEFAULT. Nothing is scored or written without --execute.
//
// There is deliberately no "score everything" / "score all failed" mode. Ids
// must be listed explicitly. A re-score overwrites whatever is on the row, and
// a flag that can sweep a whole table is a flag that eventually sweeps a whole
// table by accident.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");

function flagValues(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1]) out.push(args[i + 1]);
  }
  return out;
}

function flagValue(name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

// Localhost by default: the script should never reach a deployed environment
// unless someone typed the URL out.
const BASE_URL = flagValue("--base-url", "http://localhost:3000").replace(/\/$/, "");
const IDS = flagValues("--id");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const SELECT =
  "id, athlete_name, file_name, asset_type, mime_type, status, drive_thumbnail_url, " +
  "score_composite, score_composition, score_lighting, score_subject, " +
  "score_brand_visibility, score_hook, tags, scoring_model, scoring_error";

function fmt(row: any): string {
  const hook = row.score_hook === null ? "null" : row.score_hook;
  return (
    `composition=${row.score_composition} lighting=${row.score_lighting} ` +
    `subject=${row.score_subject} brand_visibility=${row.score_brand_visibility} hook=${hook}`
  );
}

async function main() {
  if (!IDS.length) {
    console.error(
      "\nNo ids given. Pass one --id <uuid> per submission:\n" +
        "  npx tsx --env-file=.env.local scripts/rescore-submissions.ts --id <uuid> [--id <uuid> ...]\n"
    );
    process.exit(1);
  }

  const bad = IDS.filter((id) => !UUID_RE.test(id));
  if (bad.length) {
    console.error(`\nNot valid uuids: ${bad.join(", ")}\n`);
    process.exit(1);
  }

  // Cast: the generated Database types predate migration 030, so they have no
  // scoring_error and the select string degrades to GenericStringError. Same
  // `any` treatment the other scripts in here use.
  const { data: rowsRaw, error } = await db
    .from("tier3_submissions")
    .select(SELECT)
    .in("id", IDS);
  if (error) throw new Error(error.message);
  const rows = (rowsRaw ?? []) as any[];

  console.log(`\n${EXECUTE ? "EXECUTE" : "DRY RUN"} — ${IDS.length} id(s) requested, ${rows.length} found`);
  console.log(`target: ${BASE_URL}/api/tier3/process\n`);

  const missing = IDS.filter((id) => !rows.some((r: any) => r.id === id));
  for (const id of missing) console.log(`  MISSING  ${id} — no such submission`);

  const targets: any[] = [];
  for (const row of rows) {
    const isVideo = (row.mime_type ?? "").startsWith("video/") || row.asset_type === "video";
    const label = `${row.athlete_name} — ${row.file_name} [${isVideo ? "VIDEO" : "PHOTO"}]`;

    // The route itself skips anything not pending_review, so say so here rather
    // than letting it come back as a silent no-op.
    if (row.status !== "pending_review") {
      console.log(`  SKIP     ${label}\n             status is '${row.status}', not 'pending_review' — the route will refuse it`);
      continue;
    }
    if (!row.drive_thumbnail_url) {
      console.log(`  SKIP     ${label}\n             no drive_thumbnail_url — nothing to score`);
      continue;
    }
    console.log(`  WILL SCORE  ${label}\n                ${row.id}`);
    targets.push({ ...row, isVideo, label });
  }

  console.log(`\nSUMMARY: ${targets.length} to score, ${rows.length - targets.length} skipped, ${missing.length} missing.`);

  if (!EXECUTE) {
    console.log("\nDRY RUN — nothing was scored or written. Re-run with --execute to apply.\n");
    return;
  }

  console.log("\n\nSCORING\n" + "=".repeat(78));
  for (const t of targets) {
    try {
      const res = await fetch(`${BASE_URL}/api/tier3/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: t.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.log(`  FAIL  ${t.label}\n          HTTP ${res.status} ${JSON.stringify(body)}`);
        continue;
      }

      // Read the row back rather than trusting the response — the point of this
      // exercise is what actually landed in the database.
      const { data: afterRaw } = await db
        .from("tier3_submissions")
        .select(SELECT)
        .eq("id", t.id)
        .single();
      const after = afterRaw as any;

      if (after?.status === "scored") {
        console.log(`  OK    ${t.label}`);
        console.log(`          composite = ${after.score_composite}`);
        console.log(`          ${fmt(after)}`);
        console.log(`          tags = ${JSON.stringify(after.tags)}`);
        console.log(`          model = ${after.scoring_model}`);
        if (t.isVideo && after.score_hook !== null) {
          console.log(`          WARNING: video has a non-null score_hook — expected null`);
        }
      } else {
        console.log(`  FAILED SCORING  ${t.label}`);
        console.log(`          status = ${after?.status}`);
        console.log(`          scoring_error = ${after?.scoring_error}`);
      }
    } catch (e: any) {
      console.log(`  FAIL  ${t.label}\n          ${e?.message}`);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
