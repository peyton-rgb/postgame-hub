// src/app/api/submit/[token]/route.ts
// ─────────────────────────────────────────────────────────────
// PUBLIC athlete content submission — NO session required.
//
//   GET  /api/submit/[token]  → resolve the submission link to a
//                               campaign name + upload requirements.
//   POST /api/submit/[token]  → { action: "init" | "finalize" }
//
//   action "init":     validate the submitter, find-or-create the Drive
//                      folder (Content / Lastname_Firstname), and mint one
//                      Google Drive *resumable upload session* per file.
//                      The browser PUTs bytes straight to Google — they
//                      never pass through this function, so a 100–300MB
//                      campus-wifi video doesn't hit Vercel's 4.5MB body
//                      cap. Numbering continues from what's already in the
//                      folder (merge on repeat submission, never overwrite).
//
//   action "finalize": called once per file after its bytes land in Drive.
//                      Verifies the file really sits in the athlete's
//                      folder, converts HEIC→JPG server-side, inserts a
//                      tier3_submissions row (pending_review), and pings
//                      /api/tier3/process — exactly what the Google-Form
//                      Apps Script (tier3_ingestion.gs) does today.
//
// Reuses getDriveClient()/getGoogleAuth() — the same refresh-token Drive
// path the staff routes use — but WITHOUT their auth guard. This is the
// only PUBLIC Drive writer, so the token must stay unguessable and the
// per-submission caps (from submission_links) must be enforced here.
//
// "Tier 3" is internal language: it must never appear in anything this
// endpoint returns to a caller.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { createServiceSupabase } from "@/lib/supabase";
import { getDriveClient, ensureFolder } from "@/lib/google-drive";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Helpers ───────────────────────────────────────────────────

interface SubmissionLink {
  token: string;
  campaign_id: string;
  active: boolean;
  min_photos: number;
  min_videos: number;
  max_files: number;
  expires_at: string | null;
}

async function resolveLink(token: string): Promise<SubmissionLink | null> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("submission_links")
    .select("token, campaign_id, active, min_photos, min_videos, max_files, expires_at")
    .eq("token", token)
    .single();
  return (data as SubmissionLink) ?? null;
}

/** Reason a link can't be used — null means it's good to go. */
function linkBlockedReason(link: SubmissionLink | null): { status: number; error: string } | null {
  if (!link) return { status: 404, error: "This upload link isn't valid." };
  if (!link.active) return { status: 403, error: "This upload link is closed." };
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return { status: 410, error: "This upload link has expired." };
  }
  return null;
}

/** Drive-folder-safe name: keep letters/numbers/space/_-, collapse whitespace. */
function sanitizeSegment(s: string): string {
  return String(s ?? "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same, but no spaces — used inside filenames so the trailing _NN stays parseable. */
function compactSegment(s: string): string {
  return sanitizeSegment(s).replace(/\s+/g, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const IMAGE_RE = /^image\//i;
const VIDEO_RE = /^video\//i;
const HEIC_RE = /(heic|heif)/i;

function extFor(name: string, mimeType: string): string {
  const m = String(name ?? "").match(/\.[A-Za-z0-9]{1,5}$/);
  if (m) return m[0].toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
  };
  return map[String(mimeType ?? "").toLowerCase()] ?? "";
}

/** Highest existing _NN index for `base` in the folder, so we can continue. */
async function nextFileIndex(folderId: string, base: string): Promise<number> {
  const drive = getDriveClient();
  const re = new RegExp("^" + escapeRegExp(base) + "_(\\d+)");
  let max = 0;
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
      fields: "nextPageToken, files(name)",
      pageSize: 1000,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      const hit = f.name?.match(re);
      if (hit) max = Math.max(max, parseInt(hit[1], 10));
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return max + 1;
}

/** Create a Drive resumable upload session and return its session URL. */
async function mintResumableSession(
  accessToken: string,
  meta: { name: string; parents: string[]; mimeType: string; size?: number }
): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": meta.mimeType || "application/octet-stream",
        ...(meta.size ? { "X-Upload-Content-Length": String(meta.size) } : {}),
      },
      body: JSON.stringify({ name: meta.name, parents: meta.parents, mimeType: meta.mimeType }),
    }
  );
  if (!res.ok) {
    throw new Error(`Drive session init failed (${res.status}): ${await res.text()}`);
  }
  const loc = res.headers.get("location");
  if (!loc) throw new Error("Drive did not return an upload session URL");
  return loc;
}

async function loadCampaign(campaignId: string) {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("brand_campaigns")
    .select("id, name, drive_folder_id")
    .eq("id", campaignId)
    .single();
  return data as { id: string; name: string | null; drive_folder_id: string | null } | null;
}

// ── GET: resolve link → athlete-facing config ─────────────────

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const link = await resolveLink(params.token);
  const blocked = linkBlockedReason(link);
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  const campaign = await loadCampaign(link!.campaign_id);
  return NextResponse.json({
    campaignName: campaign?.name ?? "Your Campaign",
    minPhotos: link!.min_photos,
    minVideos: link!.min_videos,
    maxFiles: link!.max_files,
  });
}

// ── PUT: relay one resumable chunk to Drive (same-origin, dodges CORS) ──
//
// The browser CAN'T PUT straight to Google's resumable session URL — those
// responses carry no Access-Control-Allow-Origin, so a cross-origin PUT is
// blocked. Instead the browser streams each chunk to THIS same-origin
// endpoint, which relays it to the session URL server-side (servers have no
// CORS constraint). Chunks stay ≤4MB to fit under Vercel's ~4.5MB body cap;
// the resumable session at Google holds the cross-request state.
//
// Headers:
//   x-goog-session : the Drive resumable session URL returned by `init`
//   x-goog-range   : Content-Range, e.g. "bytes 0-4194303/300000000"
//                    ("bytes */300000000" with an empty body = offset probe)

const DRIVE_UPLOAD_PREFIX = "https://www.googleapis.com/upload/drive/";

export async function PUT(req: NextRequest, { params }: { params: { token: string } }) {
  const link = await resolveLink(params.token);
  const blocked = linkBlockedReason(link);
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  const sessionUrl = req.headers.get("x-goog-session") ?? "";
  const range = req.headers.get("x-goog-range") ?? "";
  // SSRF guard: this endpoint is public, so only ever relay to a real Drive
  // upload session — never an arbitrary caller-supplied host.
  if (!sessionUrl.startsWith(DRIVE_UPLOAD_PREFIX)) {
    return NextResponse.json({ error: "Invalid upload session." }, { status: 400 });
  }
  if (!/^bytes /.test(range)) {
    return NextResponse.json({ error: "Missing chunk range." }, { status: 400 });
  }

  const buf = Buffer.from(await req.arrayBuffer());
  const isProbe = /^bytes \*\//.test(range); // "bytes */total" → status probe, no body

  let gRes: Response;
  try {
    gRes = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Range": range },
      body: isProbe ? undefined : buf,
    });
  } catch (e) {
    console.error("[submit] chunk relay fetch failed:", e);
    return NextResponse.json({ error: "Upload relay failed." }, { status: 502 });
  }

  if (gRes.status === 200 || gRes.status === 201) {
    const file = await gRes.json().catch(() => ({} as any));
    return NextResponse.json({ done: true, fileId: file.id ?? null });
  }
  if (gRes.status === 308) {
    const r = gRes.headers.get("Range");
    const m = r?.match(/bytes=0-(\d+)/);
    return NextResponse.json({ done: false, rangeEnd: m ? parseInt(m[1], 10) : null });
  }

  const text = await gRes.text().catch(() => "");
  console.error("[submit] chunk relay error:", gRes.status, text.slice(0, 300));
  return NextResponse.json({ error: `Drive rejected the chunk (${gRes.status}).` }, { status: 502 });
}

// ── POST: init | finalize ─────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const link = await resolveLink(params.token);
  const blocked = linkBlockedReason(link);
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  const first = String(body?.firstName ?? "").trim();
  const last = String(body?.lastName ?? "").trim();
  const ig = String(body?.igHandle ?? "").trim().replace(/^@+/, "");
  const school = String(body?.school ?? "").trim();
  if (!first || !last || !ig || !school) {
    return NextResponse.json(
      { error: "First name, last name, Instagram handle, and school are all required." },
      { status: 400 }
    );
  }

  if (body?.action === "init") return handleInit(req, link!, { first, last, ig, school }, body);
  if (body?.action === "finalize") return handleFinalize(req, link!, { first, last, ig, school }, body);
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

type Submitter = { first: string; last: string; ig: string; school: string };

async function handleInit(req: NextRequest, link: SubmissionLink, who: Submitter, body: any) {
  const files: Array<{ clientId?: string; name?: string; mimeType?: string; size?: number }> =
    Array.isArray(body?.files) ? body.files : [];

  if (files.length === 0) {
    return NextResponse.json({ error: "Add at least one file." }, { status: 400 });
  }
  if (files.length > link.max_files) {
    return NextResponse.json(
      { error: `You can upload up to ${link.max_files} files.` },
      { status: 400 }
    );
  }

  const photos = files.filter((f) => IMAGE_RE.test(f.mimeType ?? "") || HEIC_RE.test(f.name ?? "")).length;
  const videos = files.filter((f) => VIDEO_RE.test(f.mimeType ?? "")).length;
  if (photos < link.min_photos || videos < link.min_videos) {
    return NextResponse.json(
      {
        error: `Please include at least ${link.min_photos} photo${link.min_photos === 1 ? "" : "s"} and ${link.min_videos} video${link.min_videos === 1 ? "" : "s"}.`,
      },
      { status: 400 }
    );
  }

  const campaign = await loadCampaign(link.campaign_id);
  if (!campaign?.drive_folder_id) {
    return NextResponse.json(
      { error: "This campaign isn't ready to receive uploads yet. Please check back soon." },
      { status: 503 }
    );
  }

  // Content / Lastname_Firstname — both find-or-create so a repeat
  // submission merges into the existing folder instead of duplicating it.
  const content = await ensureFolder("Content", campaign.drive_folder_id);
  const folderLabel = `${sanitizeSegment(who.last)}_${sanitizeSegment(who.first)}`;
  const athlete = await ensureFolder(folderLabel, content.id);

  const fileBase = `${compactSegment(who.last)}_${compactSegment(who.first)}`;
  let index = await nextFileIndex(athlete.id, fileBase);

  const auth = getGoogleAuth();
  const accessToken = (await auth.getAccessToken()).token;
  if (!accessToken) {
    return NextResponse.json({ error: "Upload service is temporarily unavailable." }, { status: 503 });
  }

  const uploads: Array<{ clientId: string; driveName: string; sessionUrl: string }> = [];
  for (const f of files) {
    const mimeType = f.mimeType || "application/octet-stream";
    const driveName = `${fileBase}_${String(index).padStart(2, "0")}${extFor(f.name ?? "", mimeType)}`;
    const sessionUrl = await mintResumableSession(accessToken, {
      name: driveName,
      parents: [athlete.id],
      mimeType,
      size: typeof f.size === "number" ? f.size : undefined,
    });
    uploads.push({ clientId: String(f.clientId ?? driveName), driveName, sessionUrl });
    index++;
  }

  return NextResponse.json({ uploads });
}

async function handleFinalize(req: NextRequest, link: SubmissionLink, who: Submitter, body: any) {
  const fileId = String(body?.fileId ?? "").trim();
  if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 });

  const campaign = await loadCampaign(link.campaign_id);
  if (!campaign?.drive_folder_id) {
    return NextResponse.json({ error: "Campaign folder unavailable." }, { status: 503 });
  }

  // Recompute the athlete folder id (idempotent) so we can prove the
  // uploaded file really landed there — this endpoint is public, so we
  // never trust a caller-supplied folder/parent.
  const content = await ensureFolder("Content", campaign.drive_folder_id);
  const folderLabel = `${sanitizeSegment(who.last)}_${sanitizeSegment(who.first)}`;
  const athlete = await ensureFolder(folderLabel, content.id);

  const drive = getDriveClient();
  let meta;
  try {
    meta = await drive.files.get({
      fileId,
      fields: "id, name, parents, mimeType, size",
      supportsAllDrives: true,
    });
  } catch {
    return NextResponse.json({ error: "Uploaded file not found." }, { status: 404 });
  }

  const parents = meta.data.parents ?? [];
  if (!parents.includes(athlete.id)) {
    return NextResponse.json({ error: "That file isn't in your submission folder." }, { status: 403 });
  }

  let finalId = meta.data.id!;
  let finalName = meta.data.name ?? "upload";
  let finalMime = meta.data.mimeType ?? "application/octet-stream";
  let finalSize: number | null = meta.data.size ? Number(meta.data.size) : null;

  // HEIC → JPG, server-side. The bytes went straight to Drive (bypassing
  // this function), so we convert AFTER the fact: download, transcode,
  // re-upload the JPG next to it, and trash the original HEIC.
  const isHeic = HEIC_RE.test(finalMime) || /\.(heic|heif)$/i.test(finalName);
  if (isHeic) {
    try {
      const dl = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      const input = Buffer.from(dl.data as ArrayBuffer);
      const heicConvert = (await import("heic-convert")).default as any;
      // heic-convert may return a Buffer or ArrayBuffer — normalize.
      const out: Buffer = Buffer.from(await heicConvert({ buffer: input, format: "JPEG", quality: 0.92 }));
      const jpgName = finalName.replace(/\.(heic|heif)$/i, "") + ".jpg";
      const created = await drive.files.create({
        supportsAllDrives: true,
        requestBody: { name: jpgName, parents: [athlete.id], mimeType: "image/jpeg" },
        media: { mimeType: "image/jpeg", body: Readable.from(out) },
        fields: "id, name, size",
      });
      await drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true });
      finalId = created.data.id ?? finalId;
      finalName = created.data.name ?? jpgName;
      finalMime = "image/jpeg";
      finalSize = created.data.size ? Number(created.data.size) : out.length;
    } catch (e) {
      // Conversion is best-effort — a failed transcode shouldn't lose the
      // submission. Keep the original HEIC and let staff handle it.
      console.error("[submit] HEIC conversion failed:", e);
    }
  }

  const assetType = IMAGE_RE.test(finalMime) ? "photo" : VIDEO_RE.test(finalMime) ? "video" : "unknown";

  // One row per file, mirroring tier3_ingestion.gs. form_response_id keys on
  // the final Drive file id so a retried finalize upserts instead of dupes.
  const row = {
    form_response_id: `submit:${finalId}`,
    submitted_at: new Date().toISOString(),
    campaign_id: link.campaign_id,
    athlete_name: `${who.first} ${who.last}`,
    athlete_email: null,
    school: who.school,
    ig_handle: who.ig,
    campaign_name: campaign.name ?? null,
    drive_file_id: finalId,
    drive_file_url: `https://drive.google.com/file/d/${finalId}/view`,
    drive_thumbnail_url: `https://drive.google.com/thumbnail?id=${finalId}&sz=w400`,
    file_name: finalName,
    mime_type: finalMime,
    file_size_bytes: finalSize,
    asset_type: assetType,
    status: "pending_review",
  };

  const supabase = createServiceSupabase();
  const { data: inserted, error } = await supabase
    .from("tier3_submissions")
    .upsert(row, { onConflict: "form_response_id" })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[submit] tier3_submissions insert failed:", error?.message);
    return NextResponse.json({ error: "Couldn't record your upload. Please try again." }, { status: 500 });
  }

  // Kick off matching + scoring, exactly like the Apps Script. Fire-and-
  // forget: a scoring hiccup must not fail the athlete's upload.
  try {
    const origin = new URL(req.url).origin;
    await fetch(`${origin}/api/tier3/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_id: inserted.id }),
    });
  } catch (e) {
    console.error("[submit] process trigger failed:", e);
  }

  return NextResponse.json({ ok: true, submissionId: inserted.id, fileId: finalId, fileName: finalName });
}
