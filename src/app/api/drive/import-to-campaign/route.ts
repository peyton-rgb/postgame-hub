// src/app/api/drive/import-to-campaign/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/import-to-campaign
// Body: { fileId, fileName, mimeType, campaignId, athleteId }
//
// Downloads a single file from Google Drive, converts HEIC/RAW
// to JPEG if needed, uploads to Supabase storage at
// {campaignId}/{athleteId}/{timestamp}-{file}, and inserts a
// media row with drive_file_id and athlete_id set.
//
// Called once per file by DriveImportModal (client loops).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/google-drive";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MEDIA_BUCKET = "campaign-media";

const RAW_EXTS = new Set([
  "cr2", "nef", "arw", "raf", "dng", "orf", "rw2", "pef", "srw", "tiff", "tif", "bmp",
]);

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

function needsConversion(fileName: string, mimeType: string): boolean {
  const e = getExt(fileName);
  if (e === "heic" || e === "heif") return true;
  if (RAW_EXTS.has(e)) return true;
  if (mimeType === "image/heic" || mimeType === "image/heif") return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileName, mimeType, campaignId, athleteId } = body;

    if (!fileId || !fileName || !campaignId || !athleteId) {
      return NextResponse.json(
        { error: "Missing required fields: fileId, fileName, campaignId, athleteId" },
        { status: 400 }
      );
    }

    const drive = getDriveClient();

    // 1. Download file from Drive
    const fileResponse = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    let fileBuffer = Buffer.from(fileResponse.data as ArrayBuffer);
    let finalMimeType = mimeType || "application/octet-stream";
    let finalFileName = fileName;

    // 2. Convert HEIC/RAW to JPEG if needed
    if (needsConversion(fileName, finalMimeType)) {
      try {
        fileBuffer = await sharp(fileBuffer).jpeg({ quality: 92 }).toBuffer();
        finalMimeType = "image/jpeg";
        finalFileName = fileName.replace(/\.[^.]+$/, ".jpg");
      } catch (convErr: any) {
        console.error("[drive/import-to-campaign] Conversion failed, uploading original:", convErr.message);
      }
    }

    // 3. Upload to Supabase storage (athlete path pattern)
    const supabase = getSupabaseAdmin();
    const safeName = sanitizeFileName(finalFileName);
    const storagePath = `${campaignId}/${athleteId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: finalMimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[drive/import-to-campaign] Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload to Supabase: " + uploadError.message },
        { status: 500 }
      );
    }

    // 4. Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

    // 5. Insert media record
    const isVideo = finalMimeType.startsWith("video/");
    const mediaRecord = {
      campaign_id: campaignId,
      athlete_id: athleteId,
      type: isVideo ? "video" : "image",
      file_url: publicUrl,
      thumbnail_url: isVideo ? null : publicUrl,
      is_video_thumbnail: false,
      drive_file_id: fileId,
    };

    const { data: insertedMedia, error: insertError } = await supabase
      .from("media")
      .insert(mediaRecord)
      .select()
      .single();

    if (insertError) {
      console.error("[drive/import-to-campaign] Insert error:", insertError);
      await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to create media record: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, media: insertedMedia });
  } catch (error: any) {
    console.error("[drive/import-to-campaign] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import file" },
      { status: 500 }
    );
  }
}
