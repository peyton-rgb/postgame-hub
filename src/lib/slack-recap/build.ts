// src/lib/slack-recap/build.ts
// ─────────────────────────────────────────────────────────────
// The automatic recap build behind "Request a recap".
//
// Every admin campaign already has a campaign_recaps row (the daily admin sync
// creates it). "Building" fills that row in — it never creates a second one:
//
//   phase "data"    → save tracker + folder links, import athletes from the
//                     tracker, set takeaways + hidden heroes (same helpers the
//                     10-minute recap-intake job uses)
//   phase "content" → for each athlete without media, find their Drive folder
//                     and import one video + one image (same storage + media
//                     row shape as /api/drive/import). Time-boxed; the worker
//                     re-invokes itself until every athlete has been tried.
//
// Never touches a campaign that already has athletes (already built).
// ─────────────────────────────────────────────────────────────

import { createServiceSupabase } from "@/lib/supabase";
import { normLoose } from "@/lib/admin-campaigns";
import {
  buildSettings,
  computeHiddenHeroes,
  fetchTrackerCsv,
  parseTrackerAthletes,
  toTipTapHtml,
} from "@/lib/recap-intake";
import { getCampaignDriveMedia, type DriveFile } from "@/lib/google-drive";
import { buildStoragePath, downloadAndUpload, removeUpload } from "@/lib/drive-import";
import { extractDriveFolderId } from "@/lib/drive-url";
import type { BuildSummary } from "@/lib/slack-recap/views";

/** Files bigger than this are skipped by the automatic import (serverless memory/time). */
const MAX_AUTO_IMPORT_BYTES = 150 * 1024 * 1024;

export interface RecapRequestState {
  status: "building" | "review" | "published" | "failed";
  requested_by: string; // Slack user id
  requested_at: string;
  due?: string;
  takeaways: string;
  notes?: string;
  dm_channel?: string;
  dm_ts?: string;
  channel_ts?: string;
  /** Athlete ids the content phase has already tried (imported OR no match). */
  content_tried?: string[];
  summary?: BuildSummary;
  published_by?: string;
  published_at?: string;
  error?: string;
}

// ── Link checks (shown inline in the form) ────────────────────────────────────

export function trackerLinkError(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === "drive.google.com") return "That's a Drive link. Paste the Google Sheets link here.";
    if (u.hostname !== "docs.google.com" || !u.pathname.startsWith("/spreadsheets/")) {
      return "Paste a Google Sheets link (docs.google.com/spreadsheets/…).";
    }
    return null;
  } catch {
    return "That doesn't look like a link.";
  }
}

export function folderLinkError(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === "docs.google.com") return "That's a Sheets link. Paste the Google Drive folder link here.";
    if (!extractDriveFolderId(url.trim())) return "Paste a Google Drive folder link (drive.google.com/drive/folders/…).";
    return null;
  } catch {
    return "That doesn't look like a link.";
  }
}

// ── State helpers (kept in settings.recap_request — no new table) ─────────────

export async function readRequestState(recapId: string): Promise<{ settings: any; state: RecapRequestState | null }> {
  const supabase = createServiceSupabase();
  const { data } = await supabase.from("campaign_recaps").select("settings").eq("id", recapId).maybeSingle();
  const settings = ((data as any)?.settings as Record<string, any>) || {};
  return { settings, state: (settings.recap_request as RecapRequestState) || null };
}

export async function writeRequestState(recapId: string, patch: Partial<RecapRequestState>): Promise<RecapRequestState> {
  const supabase = createServiceSupabase();
  const { settings, state } = await readRequestState(recapId);
  const next = { ...(state || {}), ...patch } as RecapRequestState;
  const { error } = await supabase
    .from("campaign_recaps")
    .update({ settings: { ...settings, recap_request: next } })
    .eq("id", recapId);
  if (error) throw new Error(`could not save request state: ${error.message}`);
  return next;
}

// ── Phase 1: data ─────────────────────────────────────────────────────────────

export interface DataPhaseInput {
  recapId: string;
  trackerUrl: string;
  folderUrl: string;
  takeaways: string;
}

export async function runDataPhase(input: DataPhaseInput): Promise<{ athletes: number; warnings: string[] }> {
  const supabase = createServiceSupabase();
  const warnings: string[] = [];

  const { data: row, error } = await supabase
    .from("campaign_recaps")
    .select("id, brand_id, settings, published")
    .eq("id", input.recapId)
    .single();
  if (error || !row) throw new Error(`campaign not found (${error?.message || input.recapId})`);
  const recap = row as any;
  if (recap.published) throw new Error("this recap is already published");

  const { count: existing } = await supabase
    .from("athletes")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", input.recapId);
  if ((existing ?? 0) > 0) throw new Error("a recap is already built for this campaign");

  // Brand (for the logo) straight from brand_id — no fuzzy matching needed.
  let brandMatch = { matched: false, brand_id: null as string | null, client_name: "", brand_logo_url: "" };
  if (recap.brand_id) {
    const { data: b } = await supabase.from("brands").select("id, name, logo_url").eq("id", recap.brand_id).maybeSingle();
    if (b) brandMatch = { matched: true, brand_id: (b as any).id, client_name: (b as any).name, brand_logo_url: (b as any).logo_url || "" };
  }

  // Tracker → athletes
  const tracker = await fetchTrackerCsv(input.trackerUrl);
  let athletes: ReturnType<typeof parseTrackerAthletes> = [];
  if (tracker.ok && tracker.csv) {
    try {
      athletes = parseTrackerAthletes(tracker.csv);
    } catch (e: any) {
      warnings.push(`Tracker couldn't be read (${String(e?.message || e)}).`);
    }
  } else {
    warnings.push(`Tracker couldn't be imported (${tracker.reason || "unknown reason"}). Check it's shared with the Hub.`);
  }
  if (tracker.ok && athletes.length === 0) warnings.push("The tracker has no athlete rows yet.");

  const { hidden } = computeHiddenHeroes(athletes);
  const built = buildSettings({ takeaways: input.takeaways }, brandMatch as any, hidden);
  const prior = (recap.settings as Record<string, any>) || {};
  const settings = {
    ...built,
    ...prior,
    // Always take the fresh takeaways, hero visibility and logo from this build.
    key_takeaways: toTipTapHtml(input.takeaways),
    hidden_heroes: hidden,
    brand_logo_url: built.brand_logo_url || prior.brand_logo_url || "",
    description: prior.description || built.description,
    visible_sections: prior.visible_sections || built.visible_sections,
  };

  const folderId = extractDriveFolderId(input.folderUrl);
  const { error: upErr } = await supabase
    .from("campaign_recaps")
    .update({ tracker_url: input.trackerUrl, drive_folder_id: folderId, settings, status: "draft" })
    .eq("id", input.recapId);
  if (upErr) throw new Error(`could not save the recap: ${upErr.message}`);

  if (athletes.length) {
    const rows = athletes.map((a) => ({ ...a, campaign_id: input.recapId }));
    const { error: aErr } = await supabase.from("athletes").insert(rows);
    if (aErr) throw new Error(`athlete import failed: ${aErr.message}`);
  }

  return { athletes: athletes.length, warnings };
}

// ── Phase 2: content ──────────────────────────────────────────────────────────

/**
 * DriveFile.size is human-readable ("12.3 MB", "1.2 GB" — see humanFileSize in
 * google-drive.ts), not bytes. Parse it back so the size cap actually works.
 * Unknown/unparseable sizes count as too big, so we never blindly pull a huge file.
 */
const UNIT_BYTES: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
function sizeOf(f: DriveFile): number {
  const m = /^\s*([\d.]+)\s*(B|KB|MB|GB|TB)\s*$/i.exec(f.size || "");
  if (!m) return Number.POSITIVE_INFINITY;
  const n = parseFloat(m[1]) * (UNIT_BYTES[m[2].toUpperCase()] ?? 1);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function pickFiles(files: DriveFile[]): DriveFile[] {
  const ok = files.filter((f) => sizeOf(f) <= MAX_AUTO_IMPORT_BYTES);
  const video = ok.find((f) => f.mimeType.startsWith("video/"));
  const image = ok.find((f) => f.mimeType.startsWith("image/"));
  return [video, image].filter(Boolean) as DriveFile[];
}

function folderMatches(folderName: string, athleteName: string): boolean {
  const f = normLoose(folderName);
  const a = normLoose(athleteName);
  if (!f || !a) return false;
  return f === a || f.includes(a) || a.includes(f);
}

export interface ContentPhaseResult {
  done: boolean;
  imported: number;
  tried: string[];
}

/**
 * Import content for athletes that have none, until `deadline` (epoch ms).
 * `alreadyTried` athletes are skipped so repeated runs make progress.
 */
export async function runContentPhase(recapId: string, alreadyTried: string[], deadline: number): Promise<ContentPhaseResult> {
  const supabase = createServiceSupabase();
  const tried = new Set(alreadyTried);
  let imported = 0;

  const { data: row } = await supabase.from("campaign_recaps").select("drive_folder_id").eq("id", recapId).single();
  const folderId = (row as any)?.drive_folder_id as string | null;
  if (!folderId) return { done: true, imported, tried: Array.from(tried) };

  const [{ data: athletes }, { data: media }] = await Promise.all([
    supabase.from("athletes").select("id, name").eq("campaign_id", recapId),
    supabase.from("media").select("athlete_id").eq("campaign_id", recapId),
  ]);
  const hasMedia = new Set(((media as any[]) || []).map((m) => m.athlete_id).filter(Boolean));
  const todo = ((athletes as { id: string; name: string }[]) || []).filter((a) => !hasMedia.has(a.id) && !tried.has(a.id));
  if (todo.length === 0) return { done: true, imported, tried: Array.from(tried) };

  const drive = await getCampaignDriveMedia(folderId);

  for (const athlete of todo) {
    if (Date.now() > deadline) return { done: false, imported, tried: Array.from(tried) };
    tried.add(athlete.id);
    const folder = drive.athletes.find((f) => folderMatches(f.folderName, athlete.name));
    if (!folder) continue;

    for (const file of pickFiles(folder.files)) {
      if (Date.now() > deadline) return { done: false, imported, tried: Array.from(tried) };
      const storagePath = buildStoragePath(recapId, athlete.id, file.name);
      try {
        const { publicUrl, isVideo } = await downloadAndUpload(supabase, { fileId: file.id, fileName: file.name, storagePath });
        const { error } = await supabase.from("media").insert({
          campaign_id: recapId,
          athlete_id: athlete.id,
          type: isVideo ? "video" : "image",
          file_url: publicUrl,
          thumbnail_url: isVideo ? null : publicUrl,
          is_video_thumbnail: false,
          drive_file_id: file.id,
        });
        if (error) {
          await removeUpload(supabase, storagePath);
          console.error(`[slack-recap] media insert failed for ${athlete.name}:`, error.message);
        } else {
          imported++;
        }
      } catch (e: any) {
        console.error(`[slack-recap] import failed for ${athlete.name} / ${file.name}:`, e?.message || e);
      }
    }
  }
  return { done: true, imported, tried: Array.from(tried) };
}

/** Final numbers for the review message. */
export async function summarize(recapId: string, extraWarnings: string[]): Promise<BuildSummary> {
  const supabase = createServiceSupabase();
  const [{ data: athletes }, { data: media }] = await Promise.all([
    supabase.from("athletes").select("id, name").eq("campaign_id", recapId),
    supabase.from("media").select("athlete_id").eq("campaign_id", recapId),
  ]);
  const list = (athletes as { id: string; name: string }[]) || [];
  const mediaRows = (media as any[]) || [];
  const withMedia = new Set(mediaRows.map((m) => m.athlete_id).filter(Boolean));
  return {
    athletes: list.length,
    mediaImported: mediaRows.length,
    missingContent: list.filter((a) => !withMedia.has(a.id)).map((a) => a.name.trim()),
    warnings: extraWarnings,
  };
}
