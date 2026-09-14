// src/app/api/recap/[id]/refresh-from-tracker/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/recap/[id]/refresh-from-tracker
//
// Staff-only. Re-imports athlete data and recomputes hero metric overrides
// from the campaign's linked Google Sheet (tracker_sheet_id), using the
// same CSV-parse path recap-intake uses at creation time.
//
// Merge rules (same as the editor's existing importFromTracker):
//   • Existing athlete by name → update identity + metrics, preserve their
//     media links
//   • New athlete in sheet    → insert fresh
//   • Athlete in DB but gone from sheet → delete (and their media)
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
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const supabase = createServiceSupabase();
  const { id } = params;

  // ── Load the campaign ─────────────────────────────────────────
  const { data: recap, error: recapError } = await supabase
    .from("campaign_recaps")
    .select("id, tracker_sheet_id, tracker_url, settings")
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

  // Athletes in DB but no longer in the sheet → delete (and their media)
  const toDeleteIds = (existingAthletes ?? [])
    .filter((a) => !matchedExistingIds.has(a.id))
    .map((a) => a.id);

  if (toDeleteIds.length > 0) {
    await supabase.from("media").delete().in("athlete_id", toDeleteIds);
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
  const { error: settingsError } = await supabase
    .from("campaign_recaps")
    .update({
      metric_overrides: heroValues,
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
    ok: true,
    athletesUpdated: toUpdate.length,
    athletesInserted: toInsert.length,
    athletesDeleted: toDeleteIds.length,
    hiddenHeroes: hidden,
    heroValues,
  });
}
