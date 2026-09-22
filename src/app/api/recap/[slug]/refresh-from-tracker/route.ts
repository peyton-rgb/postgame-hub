// src/app/api/recap/[id]/refresh-from-tracker/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/recap/[id]/refresh-from-tracker
//
// Staff-only. Re-imports athlete data and recomputes hero metric overrides
// from the campaign's linked Google Sheet (tracker_sheet_id), using the
// same CSV-parse path recap-intake uses at creation time.
//
// Merge rules:
//   • Existing athlete by name → update identity + metrics, preserve their
//     media links
//   • New athlete in sheet    → insert fresh
//   • Athlete in DB but gone from sheet → REPORTED, and deleted only on an
//     explicit second call. See the guard below.
//
// ── THE GUARD ───────────────────────────────────────────────────
//
// This route used to delete every athlete the sheet did not name, and their
// media rows with them, on a single unconfirmed POST. Three things made that
// dangerous rather than merely blunt:
//
//   1. Athletes were matched by lower-cased name in a Map, so two athletes
//      sharing a normalised name collapsed onto one key — the loser was never
//      matched, and was therefore deleted. There are live campaigns with
//      duplicate names, and one with four athletes whose name is empty: they
//      all key to "" and would go together.
//   2. `media` rows were deleted outright. Media is CURATED — someone chose
//      those files and their order. The tracker has no opinion about it and
//      must not be able to destroy it.
//   3. A partial parse (wrong tab, missing gid) looks identical to "the sheet
//      no longer lists anyone", so a read failure could present as a mandate
//      to delete the whole roster.
//
// So: DRY RUN BY DEFAULT. A plain POST previews and writes nothing. Writing
// needs { apply: true }. Deleting needs { apply: true, confirmDeletions: true }
// AND a clean preview — and even then an athlete holding media is never
// deleted, and media itself is never deleted at all.
//
// Additionally recomputes and saves metric_overrides (the hero numbers shown
// on the recap page) and settings.hidden_heroes. The editor's own autosave
// uses buildSettingsPayload which spreads current DB settings, so saving
// hidden_heroes here is safe — the next editor save will carry them forward.
//
// Human-gated by design: no nightly cron. A staff member triggers this once
// they've finished updating the tracker sheet, so manual edits in the recap
// editor are never silently overwritten.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import {
  fetchTrackerCsv,
  parseTrackerAthletes,
  computeHiddenHeroes,
} from "@/lib/recap-intake";
import type { Athlete } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  // Anything other than a literal true is a preview. Defaulting a destructive
  // action to "write" is the wrong failure mode, and this one used to.
  const body = (await req.json().catch(() => ({}))) as { apply?: unknown; confirmDeletions?: unknown };
  const apply = body?.apply === true;
  const confirmDeletions = body?.confirmDeletions === true;

  const supabase = createServiceSupabase();
  const { slug: id } = params;

  // ── Load the campaign ─────────────────────────────────────────
  const { data: recap, error: recapError } = await supabase
    .from("campaign_recaps")
    .select("id, tracker_sheet_id, tracker_url, settings, metric_overrides")
    .eq("id", id)
    .maybeSingle();

  if (recapError) {
    return NextResponse.json({ error: `Campaign lookup failed: ${recapError.message}` }, { status: 500 });
  }
  if (!recap) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (!recap.tracker_sheet_id && !recap.tracker_url) {
    return NextResponse.json(
      { error: "This campaign has no linked tracker sheet yet." },
      { status: 422 }
    );
  }

  // ── Fetch + parse the tracker CSV ─────────────────────────────
  // tracker_url points at the Sheet; the fetchTrackerCsv helper exports it
  // as CSV using the same Google OAuth credentials used elsewhere.
  const trackerUrl = recap.tracker_url
    ?? `https://docs.google.com/spreadsheets/d/${recap.tracker_sheet_id}/edit`;

  const fetched = await fetchTrackerCsv(trackerUrl);
  if (!fetched.ok || !fetched.csv) {
    return NextResponse.json(
      { error: `Couldn't read the tracker sheet: ${fetched.reason ?? "unknown error"}` },
      { status: 502 }
    );
  }

  let parsedAthletes;
  try {
    parsedAthletes = parseTrackerAthletes(fetched.csv);
  } catch (e) {
    return NextResponse.json(
      { error: `Tracker parse failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 422 }
    );
  }

  if (parsedAthletes.length === 0) {
    return NextResponse.json(
      { error: "The tracker sheet has no athlete rows yet — nothing to import." },
      { status: 422 }
    );
  }

  // ── Load existing athletes for this recap ─────────────────────
  const { data: existingAthletes, error: existingError } = await supabase
    .from("athletes")
    .select("*")
    .eq("campaign_id", id)
    .order("sort_order");

  if (existingError) {
    return NextResponse.json(
      { error: `Existing athlete read failed: ${existingError.message}` },
      { status: 500 }
    );
  }

  // ── Merge: same logic as the editor's importFromTracker ──────
  const existingByName = new Map<string, Athlete>();
  for (const a of (existingAthletes ?? [])) {
    existingByName.set(a.name.toLowerCase().trim(), a);
  }

  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
  const toInsert: Record<string, unknown>[] = [];
  const matchedExistingIds = new Set<string>();

  for (let i = 0; i < parsedAthletes.length; i++) {
    const pa = parsedAthletes[i];
    const key = pa.name.toLowerCase().trim();
    const existing = existingByName.get(key);

    if (existing) {
      matchedExistingIds.add(existing.id);
      toUpdate.push({
        id: existing.id,
        data: {
          ig_handle: pa.ig_handle || existing.ig_handle || "",
          ig_followers: pa.ig_followers || existing.ig_followers || 0,
          school: pa.school || existing.school || "",
          sport: pa.sport || existing.sport || "",
          gender: pa.gender || existing.gender || "",
          notes: pa.notes || existing.notes || "",
          post_type: pa.post_type || existing.post_type || "IG Feed",
          post_url: pa.post_url || existing.post_url,
          metrics: pa.metrics || existing.metrics || {},
          sort_order: i,
        },
      });
    } else {
      toInsert.push({
        campaign_id: id,
        name: pa.name,
        ig_handle: pa.ig_handle || "",
        ig_followers: pa.ig_followers || 0,
        school: pa.school || "",
        sport: pa.sport || "",
        gender: pa.gender || "",
        notes: pa.notes || "",
        post_type: pa.post_type || "IG Feed",
        post_url: pa.post_url,
        metrics: pa.metrics || {},
        sort_order: i,
      });
    }
  }

  // ── Who the sheet did not account for ─────────────────────────
  const unmatched = (existingAthletes ?? []).filter((a) => !matchedExistingIds.has(a.id));

  // Media is curated — someone chose these files and their order. An athlete
  // holding any is never deletable by a refresh, and media rows are never
  // deleted here at all.
  const unmatchedIds = unmatched.map((a) => a.id);
  let mediaByAthlete = new Map<string, number>();
  if (unmatchedIds.length > 0) {
    const { data: mediaRows, error: mediaErr } = await supabase
      .from("media")
      .select("athlete_id")
      .in("athlete_id", unmatchedIds);
    if (mediaErr) {
      // Cannot prove what is curated, so nothing is deletable this run. Failing
      // closed is the only safe reading of "I don't know".
      return NextResponse.json(
        { error: `Could not check curated media, so no deletion is safe: ${mediaErr.message}` },
        { status: 500 }
      );
    }
    for (const m of (mediaRows ?? []) as Array<{ athlete_id: string | null }>) {
      if (m.athlete_id) mediaByAthlete.set(m.athlete_id, (mediaByAthlete.get(m.athlete_id) ?? 0) + 1);
    }
  }

  // Blockers: conditions under which NO deletion is trustworthy, because the
  // match that produced `unmatched` cannot be relied on.
  const blockers: string[] = [];
  const nameCounts = new Map<string, number>();
  for (const a of (existingAthletes ?? [])) {
    const key = (a.name ?? "").toLowerCase().trim();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const duplicateNames = Array.from(nameCounts.entries()).filter(([k, n]) => k !== "" && n > 1);
  const blankNames = nameCounts.get("") ?? 0;
  if (duplicateNames.length > 0) {
    blockers.push(
      `${duplicateNames.length} duplicate athlete name(s) — matching is by name, so a duplicate's twin cannot be told from someone the sheet dropped: ${duplicateNames.map(([k, n]) => `"${k}" x${n}`).join(", ")}`,
    );
  }
  if (blankNames > 0) {
    blockers.push(`${blankNames} athlete(s) with no name — they all match the same empty key`);
  }

  const deletable = unmatched.filter((a) => (mediaByAthlete.get(a.id) ?? 0) === 0);
  const protectedByMedia = unmatched.filter((a) => (mediaByAthlete.get(a.id) ?? 0) > 0);

  const preview = {
    campaignId: id,
    wouldUpdate: toUpdate.length,
    wouldInsert: toInsert.length,
    notInSheet: unmatched.map((a) => ({
      id: a.id,
      name: a.name,
      media: mediaByAthlete.get(a.id) ?? 0,
      deletable: (mediaByAthlete.get(a.id) ?? 0) === 0,
    })),
    deletable: deletable.length,
    protectedByMedia: protectedByMedia.length,
    blockers,
  };

  if (!apply) {
    return NextResponse.json({
      ...preview,
      applied: false,
      note:
        "Dry run — nothing was written. POST { apply: true } to write updates and inserts. " +
        "Deleting also needs { confirmDeletions: true } and no blockers.",
    });
  }

  // Deletion is the one operation that needs a second, explicit yes — and it is
  // refused outright while anything makes the match set untrustworthy.
  const mayDelete = confirmDeletions && blockers.length === 0;
  const toDeleteIds = mayDelete ? deletable.map((a) => a.id) : [];

  if (toDeleteIds.length > 0) {
    // Athletes only. Their media is curated and stays; an athlete with media is
    // not in this list at all.
    const { error: delError } = await supabase.from("athletes").delete().in("id", toDeleteIds);
    if (delError) {
      return NextResponse.json(
        { error: `Athlete delete failed: ${delError.message}` },
        { status: 500 }
      );
    }
  }

  for (const u of toUpdate) {
    const { error } = await supabase.from("athletes").update(u.data).eq("id", u.id);
    if (error) console.error(`[refresh-from-tracker] athlete update ${u.id} failed:`, error.message);
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("athletes").insert(toInsert);
    if (error) {
      return NextResponse.json(
        { error: `Athlete insert failed: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // ── Recompute hero metrics ────────────────────────────────────
  // Load the just-written athletes fresh so IDs and metrics are canonical.
  const { data: freshAthletes } = await supabase
    .from("athletes")
    .select("*")
    .eq("campaign_id", id)
    .order("sort_order");

  const athletesForStats = (freshAthletes ?? []) as unknown as Athlete[];
  const { hidden, heroValues } = computeHiddenHeroes(athletesForStats);

  // Merge hidden_heroes into existing settings without clobbering other
  // settings keys a staff member may have manually edited in the editor.
  const existingSettings = recap.settings ?? {};
  // Merge, do not replace. metric_overrides holds hero numbers a staff member
  // may have typed by hand in the editor; assigning the freshly computed object
  // wholesale silently destroyed any key the recomputation does not produce.
  // The settings line directly below has always spread — this now matches it.
  const existingOverrides = (recap.metric_overrides ?? {}) as Record<string, unknown>;
  const { error: settingsError } = await supabase
    .from("campaign_recaps")
    .update({
      metric_overrides: { ...existingOverrides, ...heroValues },
      settings: { ...existingSettings, hidden_heroes: hidden },
    })
    .eq("id", id);

  if (settingsError) {
    return NextResponse.json(
      { error: `Metric override save failed: ${settingsError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...preview,
    applied: true,
    ok: true,
    athletesUpdated: toUpdate.length,
    athletesInserted: toInsert.length,
    athletesDeleted: toDeleteIds.length,
    // Why nothing was deleted, when something was eligible.
    deletionsSkipped:
      toDeleteIds.length === 0 && unmatched.length > 0
        ? blockers.length > 0
          ? `refused: ${blockers.join("; ")}`
          : confirmDeletions
            ? "nothing deletable — every unmatched athlete holds curated media"
            : "not confirmed — re-send with confirmDeletions: true"
        : null,
    hiddenHeroes: hidden,
    heroValues,
  });
}
