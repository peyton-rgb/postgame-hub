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
//                     and import the latest video + 3–10 best photos (same storage + media
//                     row shape as /api/drive/import). The video's cover and
//                     the photo are chosen by AI (covers.ts): the athlete
//                     clearly visible, ideally with the product. Time-boxed;
//                     the worker re-invokes itself until every athlete has
//                     been tried.
//
// Never touches a campaign that already has athletes (already built).
// ─────────────────────────────────────────────────────────────

import crypto from "crypto";
import { createServiceSupabase } from "@/lib/supabase";
import { normLoose } from "@/lib/admin-campaigns";
import {
  buildSettings,
  computeHiddenHeroes,
  fetchTrackerCsv,
  parseTrackerAthletes,
  toTipTapHtml,
} from "@/lib/recap-intake";
import {
  getCampaignDriveMedia,
  getDriveClient,
  getDriveThumbnail,
  listAllMediaInAthleteFolder,
  type DriveFile,
} from "@/lib/google-drive";
import { readTrackerContentFolders } from "@/lib/slack-recap/content-links";
import { buildStoragePath, downloadAndUpload, removeUpload } from "@/lib/drive-import";
import { extractDriveFolderId } from "@/lib/drive-url";
import type { BuildSummary } from "@/lib/slack-recap/views";
import {
  chooseCover,
  coverFrame,
  dHash,
  frameCandidates,
  hashDistance,
  localVideo,
  NEAR_DUPLICATE_BITS,
  smallJpeg,
  type Candidate,
} from "@/lib/slack-recap/covers";

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
  /** The top-level review message (Preview · Publish · Request changes). */
  review_ts?: string;
  /** Video media ids the "covers" re-pick has already handled. */
  covers_done?: string[];
  /** Athlete ids the content phase has already tried (imported OR no match). */
  content_tried?: string[];
  /** Drive folder id pasted into the request — the fallback place to look for content. */
  content_folder_id?: string | null;
  /** athlete id → that athlete's content folder, read once from the tracker's
   *  "Content Folder" column links. Preferred over folder-name matching. */
  athlete_folders?: Record<string, string>;
  /** Last time a build chunk saved progress. The resume sweeper restarts a
   *  "building" request whose heartbeat has gone quiet. */
  heartbeat_at?: string;
  /** Which worker run currently owns this build. Only the owner may import
   *  content or post the review; any other run stops at its next check. */
  run_id?: string;
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

  // The pasted folder is only where THIS request's content comes from. It's
  // kept on the request (settings.recap_request.content_folder_id) and never
  // written to drive_folder_id / drive_content_folder_id — those are the
  // campaign's own Drive folders, set at provisioning and relied on by the
  // admin handoff, folder repair and the tracker flow. Overwriting
  // drive_folder_id pointed Brooks Ghost Max 4's campaign folder at the
  // requester's personal folder on 2026-11-16.
  const folderId = extractDriveFolderId(input.folderUrl);
  const prevRequest = (settings as Record<string, any>).recap_request || {};
  (settings as Record<string, any>).recap_request = { ...prevRequest, content_folder_id: folderId };
  const { error: upErr } = await supabase
    .from("campaign_recaps")
    .update({ tracker_url: input.trackerUrl, settings, status: "draft" })
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

/** Photos shown to the AI per athlete (after near-duplicates are dropped). */
const MAX_PHOTO_CANDIDATES = 16;
/** Photos fingerprinted per athlete to find near-duplicates (Drive thumbnail each). */
const MAX_PHOTOS_SCANNED = 40;

const MEDIA_BUCKET = "campaign-media";

async function uploadJpeg(supabase: any, storagePath: string, buf: Buffer): Promise<string> {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buf, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw new Error("cover upload failed: " + error.message);
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl as string;
}

/** Newest first by Drive createdTime — "the latest version of their video". */
function newestFirst(a: DriveFile, b: DriveFile): number {
  return (Date.parse(b.createdTime || "") || 0) - (Date.parse(a.createdTime || "") || 0);
}

/**
 * Import one athlete's content per the recap rule: the latest video plus 3–10
 * of their best photos, no near-duplicates. Photos are fingerprinted and
 * near-identical shots dropped before the AI sees them; the AI then ranks the
 * rest and picks the video's cover. Returns how many media rows were created.
 */
async function importAthleteContent(
  supabase: any,
  recapId: string,
  brand: string,
  athlete: { id: string; name: string },
  files: DriveFile[],
): Promise<number> {
  const ok = files.filter((f) => sizeOf(f) <= MAX_AUTO_IMPORT_BYTES);
  const video = ok.filter((f) => f.mimeType.startsWith("video/")).sort(newestFirst)[0];
  const allPhotos = ok.filter((f) => f.mimeType.startsWith("image/")).sort(newestFirst).slice(0, MAX_PHOTOS_SCANNED);
  if (!video && allPhotos.length === 0) return 0;

  let created = 0;
  let videoUpload: { publicUrl: string; storagePath: string } | null = null;
  let local: { path: string; cleanup: () => Promise<void> } | null = null;
  const candidates: Candidate[] = [];
  const photoMeta = new Map<string, { file: DriveFile; hash: string | null }>();

  try {
    if (video) {
      videoUpload = await downloadAndUpload(supabase, {
        fileId: video.id,
        fileName: video.name,
        storagePath: buildStoragePath(recapId, athlete.id, video.name),
      });
      try {
        local = await localVideo(videoUpload.publicUrl);
        candidates.push(...(await frameCandidates(local.path)));
      } catch (e: any) {
        console.warn(`[slack-recap] stills failed for ${athlete.name}:`, e?.message || e);
      }
    }

    // Fingerprint photos; keep one of each near-duplicate group.
    const keptHashes: string[] = [];
    for (const p of allPhotos) {
      if (photoMeta.size >= MAX_PHOTO_CANDIDATES) break;
      const thumb = await getDriveThumbnail(p.id);
      const small = thumb ? await smallJpeg(thumb) : null;
      if (!small) continue;
      const hash = await dHash(small);
      if (hash && keptHashes.some((h) => hashDistance(h, hash) <= NEAR_DUPLICATE_BITS)) continue;
      if (hash) keptHashes.push(hash);
      photoMeta.set(p.id, { file: p, hash });
      candidates.push({ kind: "photo", key: p.id, small });
    }

    const choice =
      candidates.length > 1
        ? await chooseCover(athlete.name.trim(), brand, candidates)
        : {
            cover: 0,
            photo: candidates[0]?.kind === "photo" ? 0 : null,
            photos: candidates[0]?.kind === "photo" ? [0] : [],
            judged: false,
          };

    // The athlete's photos, best first. sort_order: video 0, photos 1..n.
    const pickedIds = choice.photos
      .map((i) => candidates[i])
      .filter((c): c is Extract<Candidate, { kind: "photo" }> => c?.kind === "photo")
      .map((c) => c.key);
    const photoUrls = new Map<string, string>();
    let order = 1;
    for (const id of pickedIds) {
      const meta = photoMeta.get(id);
      if (!meta) continue;
      const storagePath = buildStoragePath(recapId, athlete.id, meta.file.name);
      try {
        const up = await downloadAndUpload(supabase, { fileId: id, fileName: meta.file.name, storagePath });
        const { error } = await supabase.from("media").insert({
          campaign_id: recapId,
          athlete_id: athlete.id,
          type: "image",
          file_url: up.publicUrl,
          thumbnail_url: up.publicUrl,
          is_video_thumbnail: false,
          drive_file_id: id,
          sort_order: order,
          phash: meta.hash,
        });
        if (error) {
          await removeUpload(supabase, storagePath);
          console.error(`[slack-recap] photo insert failed for ${athlete.name}:`, error.message);
        } else {
          photoUrls.set(id, up.publicUrl);
          created++;
          order++;
        }
      } catch (e: any) {
        console.error(`[slack-recap] photo import failed for ${athlete.name}:`, e?.message || e);
      }
    }
    const firstPhotoUrl = pickedIds.map((id) => photoUrls.get(id)).find(Boolean) ?? null;

    if (video && videoUpload) {
      // The video's cover: a full-size still at the chosen moment, or the
      // chosen photo. Null only if nothing at all could be produced.
      let thumbnailUrl: string | null = null;
      const c = candidates[choice.cover];
      try {
        if (c?.kind === "frame" && local) {
          thumbnailUrl = await uploadJpeg(
            supabase,
            buildStoragePath(recapId, athlete.id, `cover-${video.name}.jpg`),
            await coverFrame(local.path, c.t),
          );
        } else if (c?.kind === "photo") {
          if (photoUrls.has(c.key)) thumbnailUrl = photoUrls.get(c.key)!;
          else {
            const thumb = await getDriveThumbnail(c.key);
            if (thumb) {
              const sharp = (await import("sharp")).default;
              const jpg = await sharp(thumb).rotate().resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
              thumbnailUrl = await uploadJpeg(supabase, buildStoragePath(recapId, athlete.id, `cover-${video.name}.jpg`), jpg);
            }
          }
        }
      } catch (e: any) {
        console.warn(`[slack-recap] cover save failed for ${athlete.name}:`, e?.message || e);
      }
      if (!thumbnailUrl) thumbnailUrl = firstPhotoUrl;

      const { error } = await supabase.from("media").insert({
        campaign_id: recapId,
        athlete_id: athlete.id,
        type: "video",
        file_url: videoUpload.publicUrl,
        thumbnail_url: thumbnailUrl,
        is_video_thumbnail: false,
        drive_file_id: video.id,
        sort_order: 0,
      });
      if (error) {
        await removeUpload(supabase, videoUpload.storagePath);
        console.error(`[slack-recap] video insert failed for ${athlete.name}:`, error.message);
      } else {
        created++;
      }
    }
  } catch (e: any) {
    console.error(`[slack-recap] import failed for ${athlete.name}:`, e?.message || e);
  } finally {
    await local?.cleanup().catch(() => {});
  }
  return created;
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
  /** True when this run lost ownership to a newer one and stopped early. */
  stopped?: boolean;
}

// ── One worker at a time ──────────────────────────────────────────────────────
// A build runs as a chain of ~3-minute chunks. A restart (resume sweeper or a
// manual resume) can start a second chain while the first is still alive, and
// both would import the same athletes. Each fresh chain claims the build with
// a new run_id; chunks pass that id along; before every athlete (and before
// posting the review) a run checks it still owns the build, and stops if a
// newer run has taken over. Newest claim wins.

export async function claimRun(recapId: string): Promise<string> {
  const runId = crypto.randomUUID();
  await writeRequestState(recapId, { run_id: runId, heartbeat_at: new Date().toISOString() });
  return runId;
}

/** True if `runId` still owns the build; refreshes the heartbeat when it does. */
export async function ownsRun(recapId: string, runId: string): Promise<boolean> {
  const { state } = await readRequestState(recapId);
  if (!state || state.run_id !== runId) return false;
  await writeRequestState(recapId, { heartbeat_at: new Date().toISOString() });
  return true;
}

/**
 * Import content for athletes that have none, until `deadline` (epoch ms).
 * `alreadyTried` athletes are skipped so repeated runs make progress.
 */
export async function runContentPhase(
  recapId: string,
  alreadyTried: string[],
  deadline: number,
  stillOwner?: () => Promise<boolean>,
): Promise<ContentPhaseResult> {
  const supabase = createServiceSupabase();
  const tried = new Set(alreadyTried);
  let imported = 0;

  const { data: row } = await supabase
    .from("campaign_recaps")
    .select("settings, drive_folder_id, client_name, tracker_url")
    .eq("id", recapId)
    .single();
  const reqState = ((row as any)?.settings?.recap_request || {}) as Partial<RecapRequestState>;
  // The folder pasted into the request; older requests (before 2026-11-16)
  // saved it into drive_folder_id, so fall back to that.
  const folderId = (reqState.content_folder_id || (row as any)?.drive_folder_id) as string | null;
  const brand = ((row as any)?.client_name as string | null) || "";

  const [{ data: athletes }, { data: media }] = await Promise.all([
    supabase.from("athletes").select("id, name").eq("campaign_id", recapId),
    supabase.from("media").select("athlete_id").eq("campaign_id", recapId),
  ]);
  const allAthletes = (athletes as { id: string; name: string }[]) || [];
  const hasMedia = new Set(((media as any[]) || []).map((m) => m.athlete_id).filter(Boolean));
  const todo = allAthletes.filter((a) => !hasMedia.has(a.id) && !tried.has(a.id));
  if (todo.length === 0) return { done: true, imported, tried: Array.from(tried) };

  // Each athlete's own folder, from the tracker's Content Folder links. Read
  // once per build and kept on the request so later chunks skip the Sheets call.
  let athleteFolders = reqState.athlete_folders;
  if (!athleteFolders) {
    const byName = await readTrackerContentFolders((row as any)?.tracker_url);
    athleteFolders = {};
    for (const a of allAthletes) {
      const f = byName.get(normLoose(a.name));
      if (f) athleteFolders[a.id] = f;
    }
    await writeRequestState(recapId, { athlete_folders: athleteFolders });
  }

  if (!folderId && Object.keys(athleteFolders).length === 0) return { done: true, imported, tried: Array.from(tried) };

  // Folder-name fallback for athletes the tracker doesn't link. Listed lazily:
  // when every athlete has a tracker link, the pasted folder is never scanned.
  let drive: Awaited<ReturnType<typeof getCampaignDriveMedia>> | null = null;
  const fallbackFiles = async (name: string): Promise<DriveFile[] | null> => {
    if (!folderId) return null;
    if (!drive) drive = await getCampaignDriveMedia(folderId);
    const folder = drive.athletes.find((f) => folderMatches(f.folderName, name));
    return folder ? folder.files : null;
  };
  const driveClient = getDriveClient();

  for (const athlete of todo) {
    if (Date.now() > deadline) return { done: false, imported, tried: Array.from(tried) };
    if (stillOwner && !(await stillOwner())) return { done: false, imported, tried: Array.from(tried), stopped: true };
    tried.add(athlete.id);
    // Belt and braces: never import for an athlete who already has content
    // (another run may have done them since this chunk's list was made).
    const { count: existing } = await supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", recapId)
      .eq("athlete_id", athlete.id);
    if ((existing || 0) > 0) continue;
    const linked = athleteFolders[athlete.id];
    let files: DriveFile[] | null = null;
    if (linked) {
      try {
        files = await listAllMediaInAthleteFolder(driveClient, linked);
      } catch (e: any) {
        console.warn(`[slack-recap] couldn't open ${athlete.name}'s linked folder ${linked}:`, e?.message || e);
      }
    }
    if (!files || files.length === 0) files = await fallbackFiles(athlete.name);
    if (!files || files.length === 0) continue;
    imported += await importAthleteContent(supabase, recapId, brand, athlete, files);
  }
  return { done: true, imported, tried: Array.from(tried) };
}

export interface CoversPhaseResult {
  done: boolean;
  handled: string[];
  updated: number;
}

/**
 * Re-pick covers for an already-built recap's videos (the "covers" phase).
 * Candidates are stills from the video plus the athlete's photos already in
 * the recap. Only thumbnail_url changes — no media is added or removed.
 */
export async function runCoversPhase(recapId: string, alreadyDone: string[], deadline: number): Promise<CoversPhaseResult> {
  const supabase = createServiceSupabase();
  const handled = new Set(alreadyDone);
  let updated = 0;

  const [{ data: recap }, { data: media }, { data: athletes }] = await Promise.all([
    supabase.from("campaign_recaps").select("client_name").eq("id", recapId).single(),
    supabase.from("media").select("id, athlete_id, type, file_url").eq("campaign_id", recapId),
    supabase.from("athletes").select("id, name").eq("campaign_id", recapId),
  ]);
  const brand = ((recap as any)?.client_name as string) || "";
  const rows = (media as any[]) || [];
  const names = new Map(((athletes as any[]) || []).map((a) => [a.id, String(a.name || "").trim()]));
  const videos = rows.filter((m) => m.type === "video" && m.file_url && !handled.has(m.id));

  for (const v of videos) {
    if (Date.now() > deadline) return { done: false, handled: Array.from(handled), updated };
    handled.add(v.id);
    const name = names.get(v.athlete_id) || "the athlete";
    let local: { path: string; cleanup: () => Promise<void> } | null = null;
    try {
      const candidates: Candidate[] = [];
      local = await localVideo(v.file_url);
      candidates.push(...(await frameCandidates(local.path)));
      const photos = rows.filter((m) => m.type === "image" && m.athlete_id && m.athlete_id === v.athlete_id).slice(0, 4);
      for (const p of photos) {
        const res = await fetch(p.file_url, { cache: "no-store" }).catch(() => null);
        const small = res?.ok ? await smallJpeg(Buffer.from(await res.arrayBuffer())) : null;
        if (small) candidates.push({ kind: "photo", key: p.file_url, small });
      }
      if (candidates.length === 0) continue;
      const choice = candidates.length > 1 ? await chooseCover(name, brand, candidates) : { cover: 0, photo: null, judged: false };
      const c = candidates[choice.cover];
      const thumbnailUrl =
        c.kind === "photo"
          ? c.key
          : await uploadJpeg(supabase, buildStoragePath(recapId, v.athlete_id || "collab", `cover-${v.id}.jpg`), await coverFrame(local.path, c.t));
      const { error } = await supabase.from("media").update({ thumbnail_url: thumbnailUrl }).eq("id", v.id);
      if (error) console.error(`[slack-recap] cover update failed for ${name}:`, error.message);
      else updated++;
    } catch (e: any) {
      console.error(`[slack-recap] cover re-pick failed for ${name}:`, e?.message || e);
    } finally {
      await local?.cleanup().catch(() => {});
    }
  }
  return { done: true, handled: Array.from(handled), updated };
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
