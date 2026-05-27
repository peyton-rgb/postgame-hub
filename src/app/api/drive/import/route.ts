// src/app/api/drive/import/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/import
// Body: { fileId, fileName, athleteId | collabContainerId, slot?, recapId }
//
// Downloads a file from Google Drive and uploads it to
// Supabase storage. Inserts a media record matching the
// existing media table schema.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import {
  downloadAndUpload,
  buildStoragePath,
  removeUpload,
} from "@/lib/drive-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileName, athleteId, collabContainerId, slot, recapId } = body;

    if (!fileId || !fileName || !recapId || (!athleteId && !collabContainerId)) {
      return NextResponse.json(
        { error: "Missing required fields: fileId, fileName, recapId, and one of athleteId/collabContainerId" },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabase();
    // Storage path segment: athlete folder, or a collab-<id> folder for collab posts.
    const destSegment = athleteId ?? `collab-${collabContainerId}`;
    const storagePath = buildStoragePath(recapId, destSegment, fileName);

    const { publicUrl, isVideo } = await downloadAndUpload(supabase, {
      fileId,
      fileName,
      storagePath,
    });

    // Insert media record. Collab destinations use athlete_id = NULL and the
    // "collab:<id>" marker that the dashboard + recap already group on.
    const mediaRecord = athleteId
      ? {
          campaign_id: recapId,
          athlete_id: athleteId,
          type: isVideo ? "video" : "image",
          file_url: publicUrl,
          thumbnail_url: isVideo ? null : publicUrl,
          is_video_thumbnail: false,
        }
      : {
          campaign_id: recapId,
          athlete_id: null,
          type: isVideo ? "video" : "image",
          file_url: publicUrl,
          thumbnail_url: isVideo ? null : publicUrl,
          is_video_thumbnail: false,
          drive_file_id: `collab:${collabContainerId}`,
          // feed/reel slot for the team collab card; null if the caller
          // didn't specify one (legacy / untargeted collab import).
          slot: slot === "feed" || slot === "reel" ? slot : null,
        };

    const { data: insertedMedia, error: insertError } = await supabase
      .from("media")
      .insert(mediaRecord)
      .select()
      .single();

    if (insertError) {
      console.error("[drive/import] Insert error:", insertError);
      await removeUpload(supabase, storagePath);
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
    // DEBUG: temporary verbose error — remove after fix
    return NextResponse.json(
      {
        error: error?.message || "Failed to import file",
        name: error?.name || "Unknown",
        stack: error?.stack || null,
        response_data: error?.response?.data || error?.errors || null,
        code: error?.code || null,
        env_check: {
          client_id_set: !!process.env.GOOGLE_CLIENT_ID,
          client_secret_set: !!process.env.GOOGLE_CLIENT_SECRET,
          refresh_token_set: !!process.env.GOOGLE_REFRESH_TOKEN,
        },
      },
      { status: 500 }
    );
  }
}
