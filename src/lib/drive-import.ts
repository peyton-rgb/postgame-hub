// src/lib/drive-import.ts
// Shared helper: download a file from Google Drive → upload to Supabase storage

import { google } from "googleapis";
import { SupabaseClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "campaign-media";

export function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  });
  return google.drive({ version: "v3", auth: oauth2Client });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}

export interface DriveUploadResult {
  publicUrl: string;
  mimeType: string;
  isVideo: boolean;
  storagePath: string;
}

/**
 * Downloads a file from Google Drive by fileId and uploads it to
 * Supabase storage under the given storagePath prefix.
 *
 * Returns the public URL, resolved mime type, and storage path.
 */
export async function downloadAndUpload(
  supabase: SupabaseClient,
  opts: {
    fileId: string;
    fileName: string;
    storagePath: string; // e.g. "{recapId}/{athleteId}/{timestamp}-{name}"
  }
): Promise<DriveUploadResult> {
  const drive = getDriveClient();

  // Get metadata for mime type
  const meta = await drive.files.get({
    fileId: opts.fileId,
    supportsAllDrives: true,
    fields: "name, mimeType, size",
  });
  const mimeType = meta.data.mimeType ?? "application/octet-stream";
  const isVideo = mimeType.startsWith("video/");

  // Download file bytes
  const fileResponse = await drive.files.get(
    { fileId: opts.fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  const fileBuffer = Buffer.from(fileResponse.data as ArrayBuffer);

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(opts.storagePath, fileBuffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error("Failed to upload to Supabase: " + uploadError.message);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(opts.storagePath);

  return { publicUrl, mimeType, isVideo, storagePath: opts.storagePath };
}

/**
 * Build the standard storage path for a media upload.
 */
export function buildStoragePath(
  recapId: string,
  athleteId: string,
  fileName: string
): string {
  return `${recapId}/${athleteId}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

/**
 * Remove an uploaded file (for rollback on downstream failure).
 */
export async function removeUpload(
  supabase: SupabaseClient,
  storagePath: string
) {
  await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
}
