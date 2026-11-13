// ============================================================
// GET|POST /api/sync/inspo-sheet — bring the Muse sheet into the Inspo library.
//
// Muse logs every reference sent to the "Postgame creative" Instagram DM
// channel in the "Postgame Inspo Library" Google Sheet and saves the file to
// Drive when Instagram allows it. This route copies those rows into
// inspo_items so the library, vibe search and the moodboard agent can see them.
//
// A sheet row and a Hub row are the same reference when their Instagram
// shortcode matches (see instagramCode). That gives two jobs:
//
//   mode=new     (default) rows in the sheet with no Hub row → insert one,
//                copying the Drive file into the inspo-media bucket.
//   mode=enrich  rows already in the Hub (the May–June import) → add Muse's
//                description and tags. Fill-only: nothing a person or the
//                earlier pipeline wrote is overwritten, except a description
//                that is still the raw Instagram caption.
//
// DRY RUN BY DEFAULT. Without apply=1 nothing is written — the response is a
// report of what would happen, including whether Google lets this deployment
// read the sheet and the Drive files. Writes need apply=1.
//
//   ?limit=5        how many rows to process this call (max 20)
//   ?code=DehH4…    only the row with this Instagram shortcode (smoke test)
//   ?apply=1        actually write
//
// Callers: a signed-in staff member, or Vercel cron via CRON_SECRET (cron
// always applies). The cron entry is NOT registered in vercel.json yet — this
// ships manual-only until a one-row test has been checked by a person.
//
// Never deletes library rows and never touches the sheet or Drive (read-only on
// both). The one removal it makes is of files it stored itself in the same call
// when that row's insert then fails.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubStaff } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { getGoogleAuth } from "@/lib/google-auth";
import { getDriveClient } from "@/lib/google-drive";
import { buildEmbeddingInput, generateEmbedding } from "@/lib/services/embeddings";
import {
  aspectFormat,
  INSPO_SHEET_ID,
  INSPO_SHEET_RANGE,
  driveFileId,
  extensionFor,
  instagramCode,
  museFields,
  parseMuseSheet,
  type MuseRow,
} from "@/lib/inspo-sheet-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
/** Stop starting new rows after this long, leaving room to finish the current one. */
const TIME_BUDGET_MS = 220_000;
/** A function holds the whole file in memory while copying it; larger files are skipped, not crashed on. */
const MAX_FILE_BYTES = 150 * 1024 * 1024;
/** The earlier import signed its links for about ten years; match it so old and new rows behave the same. */
const SIGNED_URL_SECONDS = 10 * 365 * 24 * 60 * 60;
const MEDIA_BUCKET = "inspo-media";
const THUMB_BUCKET = "inspo-thumbnails";

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured means no cron caller, in every environment.
  return !!secret && (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The embedding vibe search compares against (embedding_v2). Same model and
 * size as the query side in /api/search, with the document task type.
 */
async function generateDocumentEmbeddingV2(text: string): Promise<number[]> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GOOGLE_AI_API_KEY as string,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: 1536,
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini embeddings ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.embedding.values;
}

/** Both embeddings for a row. A failure here is reported, never fatal — the row is still useful without them. */
async function embeddingsFor(fields: Record<string, unknown>): Promise<{
  update: Record<string, string>;
  errors: string[];
}> {
  const input = buildEmbeddingInput(fields);
  const update: Record<string, string> = {};
  const errors: string[] = [];
  if (!input.trim()) return { update, errors: ["nothing to embed"] };
  try {
    update.embedding = JSON.stringify(await generateEmbedding(input));
  } catch (err) {
    errors.push(`embedding: ${message(err)}`);
  }
  try {
    update.embedding_v2 = JSON.stringify(await generateDocumentEmbeddingV2(input));
  } catch (err) {
    errors.push(`embedding_v2: ${message(err)}`);
  }
  return { update, errors };
}

interface DriveMeta {
  id: string;
  name: string | null;
  mimeType: string | null;
  size: number | null;
  thumbnailLink: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

async function driveMeta(fileId: string): Promise<DriveMeta> {
  const res = await getDriveClient().files.get({
    fileId,
    supportsAllDrives: true,
    fields:
      "id,name,mimeType,size,thumbnailLink,videoMediaMetadata(durationMillis,width,height),imageMediaMetadata(width,height)",
  });
  const millis = Number(res.data.videoMediaMetadata?.durationMillis);
  return {
    id: fileId,
    name: res.data.name ?? null,
    mimeType: res.data.mimeType ?? null,
    size: res.data.size ? Number(res.data.size) : null,
    thumbnailLink: res.data.thumbnailLink ?? null,
    durationSeconds: Number.isFinite(millis) && millis > 0 ? Math.round(millis / 1000) : null,
    width: res.data.videoMediaMetadata?.width ?? res.data.imageMediaMetadata?.width ?? null,
    height: res.data.videoMediaMetadata?.height ?? res.data.imageMediaMetadata?.height ?? null,
  };
}

async function signedUrl(supabase: SupabaseClient, bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(`sign ${bucket}/${path}: ${error?.message || "no url"}`);
  return data.signedUrl;
}

interface MediaResult {
  columns: Record<string, unknown>;
  fetchStatus: string;
  /** Objects this call put in storage, so a failed insert can take them back out. */
  stored?: { bucket: string; path: string }[];
  thumbnailBytes?: number;
}

/**
 * Copy a row's Drive file (and a still for it) into storage. Returns the
 * columns to set plus a fetch_status in the vocabulary the earlier import
 * used: "fetched", or "failed:<why>". Never throws — a row without its file
 * is still worth having, with the Instagram link as the way to watch it.
 */
async function copyMedia(
  supabase: SupabaseClient,
  itemId: string,
  fileId: string
): Promise<MediaResult> {
  let meta: DriveMeta;
  try {
    meta = await driveMeta(fileId);
  } catch (err) {
    return { columns: { drive_file_id: fileId }, fetchStatus: `failed:drive ${message(err)}`.slice(0, 200) };
  }
  if (meta.size && meta.size > MAX_FILE_BYTES) {
    return { columns: { drive_file_id: fileId }, fetchStatus: "failed:file too large" };
  }

  const columns: Record<string, unknown> = {
    drive_file_id: fileId,
    mime_type: meta.mimeType,
    file_size_bytes: meta.size,
    duration_seconds: meta.durationSeconds,
    format: aspectFormat(meta.width, meta.height),
  };

  try {
    const res = await getDriveClient().files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    const body = Buffer.from(res.data as ArrayBuffer);
    const path = `instagram/${itemId}.${extensionFor(meta.mimeType, meta.name)}`;
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, body, { contentType: meta.mimeType || "application/octet-stream", upsert: true });
    if (error) throw new Error(error.message);
    columns.file_url = await signedUrl(supabase, MEDIA_BUCKET, path);
    const stored = [{ bucket: MEDIA_BUCKET, path }];

    // A still for the grid. Drive makes one for videos and images alike; ask
    // for a larger size than its default 220px. An image with no Drive
    // thumbnail is its own still.
    let still: Buffer | null = null;
    if (meta.thumbnailLink) {
      const token = await getGoogleAuth().getAccessToken();
      // The link ends in a size suffix such as "=s220"; some carry extra flags
      // after it. Swap whatever is there for a 1080px request.
      const large = /=[swh]\d+[^/=]*$/.test(meta.thumbnailLink)
        ? meta.thumbnailLink.replace(/=[swh]\d+[^/=]*$/, "=s1080")
        : meta.thumbnailLink;
      const thumb = await fetch(large, {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      if (thumb.ok) still = Buffer.from(await thumb.arrayBuffer());
    }
    if (!still && meta.mimeType?.startsWith("image/") && body.length < 10 * 1024 * 1024) still = body;
    if (still) {
      const thumbPath = `${itemId}.jpg`;
      const up = await supabase.storage
        .from(THUMB_BUCKET)
        .upload(thumbPath, still, { contentType: "image/jpeg", upsert: true });
      if (!up.error) {
        columns.thumbnail_url = await signedUrl(supabase, THUMB_BUCKET, thumbPath);
        stored.push({ bucket: THUMB_BUCKET, path: thumbPath });
      }
    }
    return { columns, fetchStatus: "fetched", stored, thumbnailBytes: still?.length };
  } catch (err) {
    return { columns, fetchStatus: `failed:${message(err)}`.slice(0, 200) };
  }
}

function hasTags(group: unknown): boolean {
  if (!group || typeof group !== "object") return false;
  return Object.values(group as Record<string, unknown>).some((v) => Array.isArray(v) && v.length > 0);
}

async function run(req: NextRequest) {
  const viaCron = cronAuthorized(req);
  if (!viaCron) {
    const staff = await getHubStaff();
    if (!staff.ok) {
      return NextResponse.json(
        { error: staff.reason === "anon" ? "Not signed in" : "Not authorized" },
        { status: staff.reason === "anon" ? 401 : 403 }
      );
    }
  }

  const params = new URL(req.url).searchParams;
  const apply = viaCron || params.get("apply") === "1";
  const mode = params.get("mode") === "enrich" ? "enrich" : "new";
  const onlyCode = params.get("code")?.trim() || null;
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "", 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const started = Date.now();

  // ---- Read the sheet ----
  let sheetValues: string[][];
  try {
    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: INSPO_SHEET_ID,
      range: INSPO_SHEET_RANGE,
    });
    sheetValues = (res.data.values as string[][]) || [];
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not read the Muse sheet",
        detail: message(err),
        hint: "The Google account behind GOOGLE_REFRESH_TOKEN needs view access to the Postgame Inspo Library sheet.",
      },
      { status: 502 }
    );
  }
  const parsed = parseMuseSheet(sheetValues);
  if (parsed.missingHeaders.length) {
    return NextResponse.json(
      { error: `Sheet is missing column(s): ${parsed.missingHeaders.join(", ")}` },
      { status: 422 }
    );
  }

  // ---- What the Hub already has ----
  const supabase = createLiveServiceSupabase();
  const { data: existing, error: existingError } = await supabase
    .from("inspo_items")
    .select("id, live_url")
    .eq("source", "inspo")
    .not("live_url", "is", null)
    .range(0, 9999);
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  const hubByCode = new Map<string, string>();
  for (const row of existing || []) {
    const code = instagramCode(row.live_url as string);
    if (code && !hubByCode.has(code)) hubByCode.set(code, row.id as string);
  }

  const missing = parsed.rows.filter((r) => !hubByCode.has(r.code));
  const matched = parsed.rows.filter((r) => hubByCode.has(r.code));
  const pool = (mode === "new" ? missing : matched).filter((r) => !onlyCode || r.code === onlyCode);

  const summary = {
    mode,
    applied: apply,
    sheet_rows: parsed.rows.length,
    sheet_rows_skipped: parsed.skipped,
    already_in_hub: matched.length,
    not_in_hub: missing.length,
    not_in_hub_with_drive_file: missing.filter((r) => driveFileId(r.driveFile)).length,
  };

  if (onlyCode && pool.length === 0) {
    return NextResponse.json({
      ...summary,
      note:
        mode === "new"
          ? `${onlyCode} is ${hubByCode.has(onlyCode) ? "already in the Hub" : "not in the sheet"}.`
          : `${onlyCode} is not a row that exists in both the sheet and the Hub.`,
      results: [],
    });
  }

  const results: Record<string, unknown>[] = [];

  // ================= mode=new =================
  if (mode === "new") {
    for (const row of pool.slice(0, limit)) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      const fields = museFields(row);
      const fileId = driveFileId(row.driveFile);
      const base = {
        sheet_row: row.sheetRow,
        code: row.code,
        link: row.link,
        handle: row.handle,
        description: fields.visual_description,
        search_phrases: fields.search_phrases.length,
      };

      if (!apply) {
        // Prove the Drive file is readable from here without copying it.
        let drive: Record<string, unknown> | string = "no Drive file on this row";
        if (fileId) {
          try {
            const meta = await driveMeta(fileId);
            drive = {
              readable: true,
              name: meta.name,
              type: meta.mimeType,
              megabytes: meta.size ? +(meta.size / 1048576).toFixed(1) : null,
              has_thumbnail: !!meta.thumbnailLink,
            };
          } catch (err) {
            drive = { readable: false, error: message(err) };
          }
        }
        results.push({ ...base, would: "insert", drive });
        continue;
      }

      // Re-check right before writing: a second run started in the meantime
      // must not create a twin, and there is no unique index to stop it.
      const { data: twin } = await supabase
        .from("inspo_items")
        .select("id")
        .eq("source", "inspo")
        .ilike("live_url", `%/${row.code}%`)
        .limit(1);
      if (twin && twin.length) {
        results.push({ ...base, outcome: "skipped: appeared in the Hub during this run", id: twin[0].id });
        continue;
      }

      const id = randomUUID();
      let media: MediaResult = { columns: {}, fetchStatus: "no-drive-file" };
      if (fileId) media = await copyMedia(supabase, id, fileId);

      const insert = {
        id,
        content_type: "inspo_external",
        source: "inspo",
        platform: "instagram",
        live_url: row.link,
        tagging_status: "complete",
        triage_status: "pending",
        fetch_status: media.fetchStatus,
        ...fields,
        ...media.columns,
      };
      const { error: insertError } = await supabase.from("inspo_items").insert(insert);
      if (insertError) {
        // The row did not land, so its files would be orphans nothing points
        // at. Take back exactly what this call stored — never anything else.
        const removed: string[] = [];
        for (const obj of media.stored || []) {
          const { error: removeError } = await supabase.storage.from(obj.bucket).remove([obj.path]);
          if (!removeError) removed.push(`${obj.bucket}/${obj.path}`);
        }
        results.push({ ...base, outcome: `failed: ${insertError.message}`, files_removed: removed });
        continue;
      }

      const emb = await embeddingsFor(insert);
      if (Object.keys(emb.update).length) {
        const { error: embError } = await supabase.from("inspo_items").update(emb.update).eq("id", id);
        if (embError) emb.errors.push(`saving embeddings: ${embError.message}`);
      }

      results.push({
        ...base,
        outcome: "inserted",
        id,
        fetch_status: media.fetchStatus,
        has_file: !!media.columns.file_url,
        has_thumbnail: !!media.columns.thumbnail_url,
        thumbnail_kb: media.thumbnailBytes ? Math.round(media.thumbnailBytes / 1024) : null,
        format: media.columns.format ?? null,
        embeddings: Object.keys(emb.update),
        warnings: emb.errors,
      });
    }
  }

  // ================= mode=enrich =================
  if (mode === "enrich") {
    let handled = 0;
    for (const row of pool) {
      if (handled >= limit || Date.now() - started > TIME_BUDGET_MS) break;
      const id = hubByCode.get(row.code)!;
      const { data: current, error: readError } = await supabase
        .from("inspo_items")
        .select(
          "id, visual_description, search_phrases, context_tags, pro_tags, social_tags, brief_fit, mood_tags, shot_type, sport, school"
        )
        .eq("id", id)
        .single();
      if (readError || !current) {
        results.push({ code: row.code, id, outcome: `failed: ${readError?.message || "row not found"}` });
        handled++;
        continue;
      }

      const ctx = (current.context_tags || {}) as Record<string, unknown>;
      // Already carries Muse's fields — done on an earlier run. Skipped
      // without counting against the limit so repeated calls make progress.
      if (ctx.muse_date_saved !== undefined || ctx.muse_hook !== undefined) continue;
      handled++;

      const fields = museFields(row);
      const caption = typeof ctx.ig_caption === "string" ? ctx.ig_caption.trim() : null;
      const currentDescription = (current.visual_description as string | null)?.trim() || null;
      // Replace the description only when it is empty or still the raw
      // caption the import copied in. Anything else was written on purpose.
      const descriptionIsCaption = !currentDescription || (caption !== null && currentDescription === caption);

      const mergedPhrases = Array.from(
        new Map(
          [...((current.search_phrases as string[] | null) || []), ...fields.search_phrases].map((p) => [
            p.toLowerCase(),
            p,
          ])
        ).values()
      );

      const update: Record<string, unknown> = {
        // Existing keys win; Muse only adds what is not there.
        context_tags: { ...fields.context_tags, ...ctx },
        search_phrases: mergedPhrases,
      };
      if (descriptionIsCaption && fields.visual_description) update.visual_description = fields.visual_description;
      if (!hasTags(current.pro_tags)) update.pro_tags = fields.pro_tags;
      if (!hasTags(current.social_tags)) update.social_tags = fields.social_tags;
      if (!((current.brief_fit as string[] | null) || []).length) update.brief_fit = fields.brief_fit;
      if (!Array.isArray(current.mood_tags) || current.mood_tags.length === 0) update.mood_tags = fields.mood_tags;
      if (!current.shot_type && fields.shot_type) update.shot_type = fields.shot_type;

      const report = {
        sheet_row: row.sheetRow,
        code: row.code,
        id,
        description_before: currentDescription,
        description_after: (update.visual_description as string | undefined) ?? currentDescription,
        search_phrases_before: ((current.search_phrases as string[] | null) || []).length,
        search_phrases_after: mergedPhrases.length,
        fields_changed: Object.keys(update),
      };

      if (!apply) {
        results.push({ ...report, would: "update" });
        continue;
      }

      const emb = await embeddingsFor({ ...current, ...update });
      const { error: updateError } = await supabase
        .from("inspo_items")
        .update({ ...update, ...emb.update })
        .eq("id", id);
      results.push({
        ...report,
        outcome: updateError ? `failed: ${updateError.message}` : "updated",
        embeddings: Object.keys(emb.update),
        warnings: emb.errors,
      });
    }
  }

  return NextResponse.json({
    ...summary,
    processed: results.length,
    seconds: Math.round((Date.now() - started) / 1000),
    results,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
