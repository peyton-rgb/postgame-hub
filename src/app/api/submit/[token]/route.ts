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
  deliverables: number | null;
  brief_url: string | null;
}

async function resolveLink(token: string): Promise<SubmissionLink | null> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("submission_links")
    .select(
      "token, campaign_id, active, min_photos, min_videos, max_files, expires_at, deliverables, brief_url"
    )
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

/** Compact, title-cased name token for filenames — letters/numbers only, so
 *  the trailing _NN stays parseable ("o'brien" → "OBrien", "peyton" → "Peyton"). */
function fileNamePart(s: string): string {
  return titleCase(cleanNamePart(s)).replace(/[^\p{L}\p{N}]/gu, "");
}

/** Title-case a name, capitalizing after start / space / hyphen / apostrophe
 *  ("o'brien" → "O'Brien", "mary-jane" → "Mary-Jane"). */
function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

/** A name part cleaned for a Drive folder name: keep letters, numbers, spaces,
 *  apostrophes and hyphens; drop characters Drive dislikes (/ \ : * ? " < > |). */
function cleanNamePart(s: string): string {
  return String(s ?? "")
    .replace(/[^\p{L}\p{N} '’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Athlete folder name, e.g. "Peyton Jula's Content" — title-cased,
 *  possessive, Drive-safe, regardless of how the athlete typed their name. */
function athleteFolderName(first: string, last: string): string {
  const full = `${titleCase(cleanNamePart(first))} ${titleCase(cleanNamePart(last))}`.trim();
  return `${full || "Athlete"}'s Content`;
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

// submission_links.campaign_id FKs to campaign_recaps — NOT brand_campaigns.
// Reading the wrong table returned null for every token, which is what made
// this endpoint report "Your Campaign" with no brand on a perfectly good link.
async function loadCampaign(campaignId: string) {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("campaign_recaps")
    .select("id, name, drive_folder_id, brand_id, client_name")
    .eq("id", campaignId)
    .single();
  if (!data) return null;

  const row = data as {
    id: string;
    name: string | null;
    drive_folder_id: string | null;
    brand_id: string | null;
    client_name: string | null;
  };
  return {
    id: row.id,
    name: row.name,
    drive_folder_id: row.drive_folder_id,
    brand_id: row.brand_id,
    // brand_id is nullable at the DB level (0 null across 611 recaps today, but
    // nothing enforces it), so this fallback is dormant rather than dead.
    // client_name is populated on all 611 and matches brands.name on 609, which
    // makes it the best stand-in when brand_id is absent.
    brand: row.client_name, // display fallback only when brand_id is null.
                            // Free text — never use as a brand identifier.
  };
}

// Postgame's own brand row.
//
// The variant names on this row are counterintuitive and describe the INK, not
// the background they belong on:
//   logo_primary_url = white wordmark + orange plus
//   logo_light_url   = all white
//   logo_dark_url    = black wordmark + orange plus
//
// The form is now a DARK page (#07070A), so the header mark is
// logo_primary_url — white lettering with the orange plus. logo_dark_url is the
// black-ink mark and would disappear against the header; it was correct only
// while this page had an off-white ground.
const POSTGAME_BRAND_ID = "7a0e28e9-d62f-427d-a207-cd22596fcf50";

// Athlete-facing branding for the page header + campaign name. Two steps, no
// UUID-sniffing of the text column:
//   brand_id set  → name = brands.name, client logo = logo_light_url, falling
//                   back to logo_primary_url
//   brand_id null → name = campaign_recaps.client_name (plain text), no logo
//
// Light-first for the CLIENT mark specifically because many client logos are
// dark ink on transparent and vanish on black; 85 of 130 brands have a light
// variant. The 38 brands with neither variant return null and the page renders
// the brand name instead — a real path, not an edge case.
async function loadBranding(
  campaign: { brand_id: string | null; brand: string | null } | null
): Promise<{ brandName: string | null; postgameLogoUrl: string | null; clientLogoUrl: string | null }> {
  const supabase = createServiceSupabase();
  const ids = [POSTGAME_BRAND_ID];
  if (campaign?.brand_id) ids.push(campaign.brand_id);

  const { data } = await supabase
    .from("brands")
    .select("id, name, logo_primary_url, logo_light_url, logo_dark_url")
    .in("id", ids);

  const rows = (data ?? []) as Array<{
    id: string;
    name: string | null;
    logo_primary_url: string | null;
    logo_light_url: string | null;
    logo_dark_url: string | null;
  }>;
  const pg = rows.find((r) => r.id === POSTGAME_BRAND_ID);
  const client = campaign?.brand_id ? rows.find((r) => r.id === campaign.brand_id) : null;

  return {
    postgameLogoUrl: pg?.logo_primary_url ?? null,
    clientLogoUrl: client?.logo_light_url ?? client?.logo_primary_url ?? null,
    brandName: client?.name ?? campaign?.brand ?? null,
  };
}

// ── GET: resolve link → athlete-facing config ─────────────────

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const link = await resolveLink(params.token);
  const blocked = linkBlockedReason(link);
  if (blocked) {
    // The dead-link screen still shows the Postgame mark, so return it here.
    const { postgameLogoUrl } = await loadBranding(null);
    return NextResponse.json({ error: blocked.error, postgameLogoUrl }, { status: blocked.status });
  }

  const campaign = await loadCampaign(link!.campaign_id);
  const branding = await loadBranding(campaign);
  return NextResponse.json({
    campaignName: campaign?.name ?? "Your Campaign",
    brandName: branding.brandName,
    minPhotos: link!.min_photos,
    minVideos: link!.min_videos,
    maxFiles: link!.max_files,
    postgameLogoUrl: branding.postgameLogoUrl,
    clientLogoUrl: branding.clientLogoUrl,
    // Settings the athlete-facing form needs. Null is meaningful in all three:
    // no brief link, no stated deliverable count, no expiry — the form omits
    // each rather than rendering a dead link or an empty line.
    briefUrl: link!.brief_url,
    deliverables: link!.deliverables,
    expiresAt: link!.expires_at,
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
  // Lowercased to agree with submissions.ig_handle. Both columns hold the same
  // handle for the same submission, and the match key is only a key if the two
  // copies cannot disagree on case. Folder and file naming use first/last, so
  // nothing in Drive changes shape because of this.
  const ig = String(body?.igHandle ?? "").trim().replace(/^@+/, "").toLowerCase();
  const school = String(body?.school ?? "").trim();

  // A videographer is not asked for the athlete's school, phone or email — they
  // are filing someone else's content and don't reliably know any of it. The
  // database already models this: submissions.school is nullable and
  // submissions_athlete_contact_check demands the three contact columns only
  // when submitter_type = 'athlete'. Requiring school here regardless would
  // reject every videographer upload at init, before a byte reaches Drive.
  const isVideographer = String(body?.submitterType ?? "athlete").trim() === "videographer";

  if (!first || !last || !ig || (!isVideographer && !school)) {
    return NextResponse.json(
      {
        error: isVideographer
          ? "The athlete's first name, last name and Instagram handle are all required."
          : "First name, last name, Instagram handle, and school are all required.",
      },
      { status: 400 }
    );
  }

  const who: Submitter = { first, last, ig, school };
  if (body?.action === "init") return handleInit(req, link!, who, body);
  if (body?.action === "finalize") return handleFinalize(req, link!, who, body);
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

type Submitter = { first: string; last: string; ig: string; school: string };

/** tier3_submissions.file_class — which upload zone a file came through.
 *  'edit' = the finished cut, 'raw' = original camera footage. NULL for every
 *  athlete-path file and everything uploaded before this shipped, which is what
 *  the column's CHECK allows. Anything unrecognised normalises to null rather
 *  than failing the upload. */
function normalizeFileClass(v: unknown): "edit" | "raw" | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "edit" || s === "raw" ? s : null;
}

async function handleInit(req: NextRequest, link: SubmissionLink, who: Submitter, body: any) {
  const files: Array<{
    clientId?: string;
    name?: string;
    mimeType?: string;
    size?: number;
    fileClass?: string;
  }> = Array.isArray(body?.files) ? body.files : [];

  if (files.length === 0) {
    return NextResponse.json({ error: "Add at least one file." }, { status: 400 });
  }
  if (files.length > link.max_files) {
    return NextResponse.json(
      { error: `You can upload up to ${link.max_files} files.` },
      { status: 400 }
    );
  }

  // Only the edited files count toward the minimums. Raw camera footage is
  // collected alongside them but is not deliverable content — without this
  // split a videographer could satisfy "3 photos and 1 video" with four raw
  // stills and nothing usable. NULL still counts, so the athlete path, which
  // has one zone and sends no fileClass, behaves exactly as it always has.
  const counted = files.filter((f) => normalizeFileClass(f.fileClass) !== "raw");
  const photos = counted.filter((f) => IMAGE_RE.test(f.mimeType ?? "") || HEIC_RE.test(f.name ?? "")).length;
  const videos = counted.filter((f) => VIDEO_RE.test(f.mimeType ?? "")).length;
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
  const folderLabel = athleteFolderName(who.first, who.last);
  const athlete = await ensureFolder(folderLabel, content.id);

  const fileBase = `${fileNamePart(who.first)}_${fileNamePart(who.last)}`;
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
  const folderLabel = athleteFolderName(who.first, who.last);
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
    // Nullable, and null is the honest value on a videographer submission where
    // the school was never asked for — "" would read as a known-empty school.
    school: who.school || null,
    ig_handle: who.ig,
    file_class: normalizeFileClass(body?.fileClass),
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
