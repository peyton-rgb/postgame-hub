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
    const { fileId, fileName, athleteId, recapId } = body;

    if (!fileId || !fileName || !athleteId || !recapId) {
      return NextResponse.json(
        { error: "Missing required fields: fileId, fileName, athleteId, recapId" },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabase();
    const storagePath = buildStoragePath(recapId, athleteId, fileName);

    const { publicUrl, isVideo } = await downloadAndUpload(supabase, {
      fileId,
      fileName,
      storagePath,
    });

    // Insert media record (matching actual schema)
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
    return NextResponse.json(
      { error: error.message || "Failed to import file" },
      { status: 500 }
    );
  }
}
