// src/app/api/drive/import/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/import
// Body: { fileId, fileName, athleteId, recapId }
//
// Downloads a file from Google Drive and uploads it to
// Supabase storage. Inserts a media record matching the
// existing media table schema.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Auth helpers ──────────────────────────────────────────────

function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  });
  return google.drive({ version: "v3", auth: oauth2Client });
}

/** Must match `storage.buckets` / client uploads in dashboard (see migration.sql). */
const MEDIA_BUCKET = "campaign-media";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Filename sanitization ─────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileName, athleteId, recapId } = body;

    if (!fileId || !fileName || !athleteId || !recapId) {
      return NextResponse.json(
        { error: "Missing required fields: fileId, fileName, athleteId, recapId" },
        { status: 400 }
      );
    }

    // ── 1. Get file metadata from Drive ──
    const drive = getDriveClient();
    const meta = await drive.files.get({
      fileId,
      fields: "name, mimeType, size",
    });

    const mimeType = meta.data.mimeType ?? "application/octet-stream";
    const isVideo = mimeType.startsWith("video/");

    // ── 2. Download the file bytes ──
    const fileResponse = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const fileBuffer = Buffer.from(fileResponse.data as ArrayBuffer);

    // ── 3. Upload to Supabase storage ──
    const supabase = getSupabaseAdmin();
    const safeName = sanitizeFileName(fileName);
    const storagePath = `${recapId}/${athleteId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[drive/import] Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload to Supabase: " + uploadError.message },
        { status: 500 }
      );
    }

    // ── 4. Get public URL ──
    const {
      data: { publicUrl },
    } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

    // ── 5. Insert media record (matching actual schema) ──
    const mediaRecord = {
      campaign_id: recapId,
      athlete_id: athleteId,
      type: isVideo ? "video" : "image",
      file_url: publicUrl,
      thumbnail_url: isVideo ? null : publicUrl,
      is_video_thumbnail: false,
    };

    const { data: insertedMedia, error: insertError } = await supabase
      .from("media")
      .insert(mediaRecord)
      .select()
      .single();

    if (insertError) {
      console.error("[drive/import] Insert error:", insertError);
      // Roll back the storage upload on failure
      await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to create media record: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      media: insertedMedia,
    });
  } catch (error: any) {
    console.error("[drive/import] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import file" },
      { status: 500 }
    );
  }
}
