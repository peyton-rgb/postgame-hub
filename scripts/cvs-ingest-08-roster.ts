// scripts/cvs-ingest-08-roster.ts
// ─────────────────────────────────────────────────────────────
// Brief 08 Phase 1 step 2 — import the roster from each campaign's tracker tab
// into `athletes`. Report: docs/briefs/runs/cvs-ingest-08.md
//
// Reuses the existing tracker read rather than parsing sheets again:
//   fetchTrackerCsv + parseTrackerAthletes  (@/lib/recap-intake)
// which is the same path the recap editor's CSV import and the Slack intake use.
//
// Idempotent on (campaign_id, name): existing athletes for a campaign are loaded
// first and any parsed row whose normalised name already exists is skipped, so a
// re-run inserts nothing.
//
// Bloomington CFP Event is a special case, approved by Peyton. Its "CFP Event"
// tab is an event-planning sheet, not a roster, and the parser bleeds the
// "Indiana" column into the name. The prefix is stripped for that campaign only;
// handle/school/followers stay empty because the tab genuinely has none.
//
// Run:
//   npx tsx --env-file=.env.local scripts/cvs-ingest-08-roster.ts            # dry run
//   npx tsx --env-file=.env.local scripts/cvs-ingest-08-roster.ts --apply    # writes
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { fetchTrackerCsv, parseTrackerAthletes } from "@/lib/recap-intake";

const APPLY = process.argv.includes("--apply");

/** Campaigns whose athletes count is 0 and whose tracker tab is a real roster. */
const TARGETS: { id: string; label: string; stripPrefix?: RegExp }[] = [
  { id: "43319346-4a04-4123-9df0-fc1b96e134ab", label: "Bloomington CFP Event", stripPrefix: /^Indiana\s+/i },
  { id: "f2223120-0c9f-433a-91c0-a932a55c1162", label: "CVS June" },
  { id: "66fb2d1f-2942-4cc6-991b-3ed940b52732", label: "Epic Beauty + Unaltered Beauty" },
  { id: "165332db-856d-4a1a-a85d-6b1663577a7e", label: "Extra Extra Big Deals January" },
  { id: "ec697283-d195-43ac-9644-f8e26421f5cd", label: "Valentine's Day" },
  { id: "a4bcd17b-2d43-47bc-b9ac-73fe439f1298", label: "PNW Content" },
  { id: "565012d0-4d3c-4203-a20c-07a043f7a833", label: "Community Captains" },
  { id: "c6fc9c9d-c010-4c1b-809c-6b7cecaa38f7", label: "Fall ExtraCare x Epic" },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetchTrackerCsv, retried on the 429 the CSV export endpoint returns under load. */
async function fetchWithBackoff(url: string, attempts = 5) {
  let res = await fetchTrackerCsv(url);
  for (let i = 1; i < attempts && !res.ok && /HTTP 429|HTTP 5\d\d/.test(res.reason ?? ""); i++) {
    const wait = 4000 * i;
    console.log(`   … ${res.reason}; retrying in ${wait / 1000}s (${i}/${attempts - 1})`);
    await sleep(wait);
    res = await fetchTrackerCsv(url);
  }
  return res;
}

(async () => {
  console.log(APPLY ? "*** APPLY MODE — writing to Supabase ***" : "*** DRY RUN — no writes. Pass --apply to write. ***");
  let totalInserted = 0, totalSkipped = 0, failed = 0;

  let first = true;
  for (const t of TARGETS) {
    if (!first) await sleep(1500);
    first = false;
    const { data: row, error: rErr } = await supabase
      .from("campaign_recaps").select("id,name,tracker_url").eq("id", t.id).single();
    if (rErr || !row) { console.log(`\n✗ ${t.label}: row not found`); failed++; continue; }

    console.log(`\n── ${row.name}`);
    if (!row.tracker_url) { console.log("   ✗ no tracker_url — skipped"); failed++; continue; }

    // Google's CSV export rate-limits (HTTP 429) when several tabs are pulled in
    // quick succession. Back off and retry rather than losing the campaign.
    const res = await fetchWithBackoff(row.tracker_url);
    if (!res.ok) { console.log(`   ✗ tracker fetch failed: ${res.reason}`); failed++; continue; }

    let parsed;
    try { parsed = parseTrackerAthletes(res.csv!); }
    catch (e: any) { console.log(`   ✗ tracker parse threw: ${e.message}`); failed++; continue; }

    // Clean + drop unnamed rows.
    let rows = parsed
      .map((a) => ({ ...a, name: (t.stripPrefix ? a.name.replace(t.stripPrefix, "") : a.name).trim() }))
      .filter((a) => a.name);

    // Idempotency: (campaign_id, name).
    const { data: existing, error: eErr } = await supabase
      .from("athletes").select("name").eq("campaign_id", t.id);
    if (eErr) { console.log(`   ✗ existing-athlete lookup failed: ${eErr.message}`); failed++; continue; }
    const have = new Set((existing ?? []).map((a: any) => norm(a.name)));

    // Also de-dup within the tab itself — several tabs repeat a name across tiers.
    const seen = new Set<string>();
    const fresh = rows.filter((a) => {
      const k = norm(a.name);
      if (have.has(k) || seen.has(k)) return false;
      seen.add(k); return true;
    });
    const skipped = rows.length - fresh.length;

    console.log(`   tab gid=${res.gid ?? "none"}  parsed=${parsed.length}  named=${rows.length}  existing=${have.size}`);
    console.log(`   ${APPLY ? "inserting" : "would insert"}: ${fresh.length}   skipping (already present or dup in tab): ${skipped}`);
    if (fresh.length) console.log(`   first: ${fresh.slice(0, 4).map((a) => a.name).join(" · ")}`);
    if (t.stripPrefix) console.log(`   note: stripped /${t.stripPrefix.source}/ from every name (approved)`);

    if (APPLY && fresh.length) {
      const payload = fresh.map((a) => ({ ...a, campaign_id: t.id }));
      const { error: iErr, count } = await supabase.from("athletes").insert(payload, { count: "exact" });
      if (iErr) { console.log(`   ✗ insert failed: ${iErr.message}`); failed++; continue; }
      console.log(`   ✓ inserted ${count ?? fresh.length}`);
    }
    totalInserted += fresh.length; totalSkipped += skipped;
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`TOTAL  ${APPLY ? "inserted" : "would insert"}: ${totalInserted}   skipped: ${totalSkipped}   failed campaigns: ${failed}`);
  if (failed) process.exit(1);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
