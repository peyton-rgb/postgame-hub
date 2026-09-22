// scripts/cvs-populate-09-roster.ts
// ─────────────────────────────────────────────────────────────
// Brief 09 Phase 1 — import rosters for the CVS campaigns that have a
// (brief-07-corrected) tracker_url but no athletes. Report:
// docs/briefs/runs/cvs-populate-09.md
//
// Same shape as brief 08's roster import: the reusable tracker read
// (fetchTrackerCsv + parseTrackerAthletes) rather than parsing sheets again,
// idempotent on (campaign_id, name), with backoff for the 429 and the transient
// token/network failures Google's CSV export returns under load.
//
// Media stays 0 on these rows — that is expected and fine. A tab that yields no
// named rows is reported, never imported.
//
// Run:
//   npx tsx --env-file=.env.local scripts/cvs-populate-09-roster.ts          # dry run
//   npx tsx --env-file=.env.local scripts/cvs-populate-09-roster.ts --apply  # writes
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { fetchTrackerCsv, parseTrackerAthletes } from "@/lib/recap-intake";

const APPLY = process.argv.includes("--apply");

const TARGETS: { id: string; label: string }[] = [
  { id: "aa58fc27-bc14-4a83-ae0a-22a65ff9bbfb", label: "Epic Sale Fall 2025" },
  { id: "bc69f05d-e2ea-4474-a3a3-2eab37b7f558", label: "Immunization" },
  { id: "66217b58-246a-406f-bbf5-d71153b3d45f", label: "Store Brands Gifting - Phase 1" },
  { id: "e9b28abd-4c23-4581-9641-aa06fcfe89d5", label: "CVS Well Market Gifting" },
  { id: "64a0c424-ab38-4c5c-bcc5-c5d9a3fd387c", label: "CVS Affiliate" },
  { id: "c7ca8480-63a2-49fe-af38-adb5dcc9410c", label: "CVS Holiday Affiliate Phase 1" },
  { id: "55b10516-a243-4c38-af3e-e280d867f60f", label: "CVS Event Apprarance & Content" },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry the 429s and the transient token/socket failures the export endpoint throws under load. */
async function fetchWithBackoff(url: string, attempts = 6) {
  let res = await fetchTrackerCsv(url);
  for (let i = 1; i < attempts && !res.ok && /HTTP 429|HTTP 5\d\d|fetch error/i.test(res.reason ?? ""); i++) {
    const wait = 5000 * i;
    console.log(`   … ${res.reason}; retrying in ${wait / 1000}s (${i}/${attempts - 1})`);
    await sleep(wait);
    res = await fetchTrackerCsv(url);
  }
  return res;
}

(async () => {
  console.log(APPLY ? "*** APPLY MODE — writing to Supabase ***" : "*** DRY RUN — no writes. Pass --apply to write. ***");
  let inserted = 0, skipped = 0, failed = 0;
  const notRosters: string[] = [];
  let first = true;

  for (const t of TARGETS) {
    if (!first) await sleep(2000);
    first = false;

    const { data: row, error } = await supabase
      .from("campaign_recaps").select("id,name,tracker_url").eq("id", t.id).single();
    if (error || !row) { console.log(`\n✗ ${t.label}: row not found`); failed++; continue; }

    console.log(`\n── ${row.name}`);
    if (!row.tracker_url) { console.log("   ✗ no tracker_url — skipped"); failed++; continue; }

    const res = await fetchWithBackoff(row.tracker_url);
    if (!res.ok) { console.log(`   ✗ tracker fetch failed: ${res.reason}`); failed++; continue; }

    let parsed;
    try { parsed = parseTrackerAthletes(res.csv!); }
    catch (e: any) { console.log(`   ✗ tracker parse threw: ${e.message}`); failed++; continue; }

    const rows = parsed.map((a) => ({ ...a, name: a.name.trim() })).filter((a) => a.name);

    // A tab with no named rows is not a roster. Report, never import.
    if (!rows.length) {
      console.log(`   ⚠ tab parsed ${parsed.length} rows but none had a name — NOT a roster, skipped`);
      notRosters.push(row.name); continue;
    }

    const { data: existing, error: eErr } = await supabase
      .from("athletes").select("name").eq("campaign_id", t.id);
    if (eErr) { console.log(`   ✗ existing lookup failed: ${eErr.message}`); failed++; continue; }
    const have = new Set((existing ?? []).map((a: any) => norm(a.name)));

    const seen = new Set<string>();
    const fresh = rows.filter((a) => {
      const k = norm(a.name);
      if (have.has(k) || seen.has(k)) return false;
      seen.add(k); return true;
    });
    const dup = rows.length - fresh.length;

    console.log(`   gid=${res.gid ?? "none"}  parsed=${parsed.length}  named=${rows.length}  existing=${have.size}`);
    console.log(`   ${APPLY ? "inserting" : "would insert"}: ${fresh.length}   skipping: ${dup}`);
    if (fresh.length) console.log(`   first: ${fresh.slice(0, 4).map((a) => a.name).join(" · ")}`);

    if (APPLY && fresh.length) {
      // Chunked — some of these tabs carry 600+ athletes.
      let done = 0;
      for (let i = 0; i < fresh.length; i += 200) {
        const chunk = fresh.slice(i, i + 200).map((a) => ({ ...a, campaign_id: t.id }));
        const { error: iErr, count } = await supabase.from("athletes").insert(chunk, { count: "exact" });
        if (iErr) { console.log(`   ✗ insert failed at row ${i}: ${iErr.message}`); failed++; break; }
        done += count ?? chunk.length;
      }
      console.log(`   ✓ inserted ${done}`);
    }
    inserted += fresh.length; skipped += dup;
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`TOTAL  ${APPLY ? "inserted" : "would insert"}: ${inserted}   skipped: ${skipped}   failed: ${failed}`);
  if (notRosters.length) console.log(`Not rosters (reported, not imported): ${notRosters.join(", ")}`);
  if (failed) process.exit(1);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
