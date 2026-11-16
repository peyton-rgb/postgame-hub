// src/lib/slack-recap/tracker.ts
// ─────────────────────────────────────────────────────────────
// "Get a v2 performance tracker" — the Slack flow behind the channel bookmark.
//
// An employee picks a brand and campaign; the Hub makes sure that campaign has
// a v2 Performance Tracker and hands them the link. Three cases:
//
//   none    → copy the v2 template into the campaign folder
//   v2      → nothing to make, just return the existing tracker
//   old     → the campaign has a pre-v2 tracker (the nightly sweep copied the
//             old template until 2026-11-16). Rename that file
//             "… (old layout)" so the name is free, then copy a fresh v2 one.
//             The old file is never deleted or edited — only renamed.
//
// The tracker sits loose in the campaign folder and is named
// "{Campaign} {Brand} '{YY} Performance Tracker" — the same name the nightly
// sweep uses (lib/drive-provision.ts), so the two never make duplicates.
// ─────────────────────────────────────────────────────────────

import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-auth";
import { copyFile, findFileByName, getDriveClient } from "@/lib/google-drive";
import { campaignYear, performanceTrackerName, V2_TRACKER_TEMPLATE_ID } from "@/lib/drive-provision";
import { createServiceSupabase } from "@/lib/supabase";

export type TrackerKind = "none" | "v2" | "old" | "no_folder";

export interface TrackerStatus {
  kind: TrackerKind;
  /** The campaign's current tracker, when it has one. */
  trackerId?: string;
  trackerUrl?: string;
  folderId?: string;
}

export interface TrackerResult {
  /** "created" = a new v2 copy was made; "existing" = it already had one. */
  outcome: "created" | "existing";
  trackerId: string;
  trackerUrl: string;
  trackerName: string;
  folderId: string;
  /** Set when an old-layout tracker was renamed out of the way. */
  renamedOld?: string;
}

export function sheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export function folderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

/**
 * Is this sheet a v2 tracker? v2 is the layout that starts every post group
 * with a "Post Date" column (row 2 of the first tab). Any read failure counts
 * as "not v2", so the caller makes a fresh copy rather than handing out a
 * link it couldn't check.
 */
export async function isV2Tracker(sheetId: string): Promise<boolean> {
  try {
    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "A2:L2" });
    const headers = ((res.data.values?.[0] ?? []) as string[]).map((h) => String(h).trim().toLowerCase());
    return headers.includes("post date");
  } catch (e: any) {
    console.warn(`[slack-tracker] couldn't read ${sheetId}:`, e?.message || e);
    return false;
  }
}

async function loadCampaign(recapId: string) {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("campaign_recaps")
    .select("id, name, admin_name, brand_id, client_name, admin_created_on, created_at, drive_folder_id, tracker_sheet_id")
    .eq("id", recapId)
    .maybeSingle();
  if (error || !data) throw new Error(`campaign not found (${error?.message || recapId})`);
  return data as {
    id: string;
    name: string;
    admin_name: string | null;
    brand_id: string | null;
    client_name: string | null;
    admin_created_on: string | null;
    created_at: string;
    drive_folder_id: string | null;
    tracker_sheet_id: string | null;
  };
}

/** What the form shows under the campaign pick. Read-only. */
export async function getTrackerStatus(recapId: string): Promise<TrackerStatus> {
  const c = await loadCampaign(recapId);
  if (!c.drive_folder_id) return { kind: "no_folder" };
  if (!c.tracker_sheet_id) return { kind: "none", folderId: c.drive_folder_id };
  const v2 = await isV2Tracker(c.tracker_sheet_id);
  return {
    kind: v2 ? "v2" : "old",
    trackerId: c.tracker_sheet_id,
    trackerUrl: sheetUrl(c.tracker_sheet_id),
    folderId: c.drive_folder_id,
  };
}

/** Make sure the campaign has a v2 tracker; return it. */
export async function ensureV2Tracker(recapId: string): Promise<TrackerResult> {
  const supabase = createServiceSupabase();
  const c = await loadCampaign(recapId);
  const folderId = c.drive_folder_id;
  if (!folderId) {
    throw new Error("this campaign has no Drive folder yet (it gets one when it's created in the admin)");
  }

  // Already a v2 tracker on file → hand it back, make nothing.
  if (c.tracker_sheet_id && (await isV2Tracker(c.tracker_sheet_id))) {
    const drive = getDriveClient();
    const meta = await drive.files
      .get({ fileId: c.tracker_sheet_id, fields: "name", supportsAllDrives: true })
      .catch(() => null);
    return {
      outcome: "existing",
      trackerId: c.tracker_sheet_id,
      trackerUrl: sheetUrl(c.tracker_sheet_id),
      trackerName: meta?.data?.name || "Performance Tracker",
      folderId,
    };
  }

  let brandName = (c.client_name || "").trim();
  if (c.brand_id) {
    const { data: b } = await supabase.from("brands").select("name").eq("id", c.brand_id).maybeSingle();
    if ((b as any)?.name) brandName = String((b as any).name).trim();
  }
  if (!brandName) throw new Error("this campaign has no brand");

  const year = campaignYear({
    id: c.id,
    name: c.name,
    brand_id: c.brand_id,
    admin_created_on: c.admin_created_on,
    created_at: c.created_at,
  });
  const trackerName = performanceTrackerName(c.name, brandName, year);

  // A same-named file already in the folder: adopt it if it's v2 (a retry, or
  // someone made it by hand); if it's the old layout, rename it out of the way.
  let renamedOld: string | undefined;
  const sameName = await findFileByName(trackerName, folderId);
  if (sameName) {
    if (await isV2Tracker(sameName.id)) {
      await saveTracker(recapId, sameName.id);
      return { outcome: "existing", trackerId: sameName.id, trackerUrl: sheetUrl(sameName.id), trackerName, folderId };
    }
    renamedOld = `${trackerName} (old layout)`;
    await getDriveClient().files.update({
      fileId: sameName.id,
      supportsAllDrives: true,
      requestBody: { name: renamedOld },
    });
  }

  const copy = await copyFile(V2_TRACKER_TEMPLATE_ID, trackerName, folderId);
  await saveTracker(recapId, copy.id);
  return { outcome: "created", trackerId: copy.id, trackerUrl: sheetUrl(copy.id), trackerName, folderId, renamedOld };
}

async function saveTracker(recapId: string, sheetId: string) {
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("campaign_recaps")
    .update({ tracker_sheet_id: sheetId, tracker_url: sheetUrl(sheetId) })
    .eq("id", recapId);
  if (error) throw new Error(`could not save the tracker on the campaign: ${error.message}`);
}
