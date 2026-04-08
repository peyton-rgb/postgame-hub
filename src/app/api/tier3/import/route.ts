// src/app/api/tier3/import/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/tier3/import
// Body: { submission_id, recap_id }
//
// Downloads a tier3 submission file from Drive, uploads to
// Supabase storage, inserts a media record, and marks the
// submission as imported.
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submission_id, recap_id } = body as {
      submission_id: string;
      recap_id: string;
    };

    if (!submission_id || !recap_id) {
      return NextResponse.json(
        { error: "submission_id and recap_id are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabase();

    // 1. Load and validate submission
    const { data: submission, error: fetchErr } = await supabase
      .from("tier3_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (fetchErr || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.status !== "scored") {
      return NextResponse.json(
        { error: "Submission must be scored before importing (current status: " + submission.status + ")" },
        { status: 400 }
      );
    }

    if (!submission.athlete_id) {
      return NextResponse.json(
        { error: "Submission must have a matched athlete before importing" },
        { status: 400 }
      );
    }

    // 2. Download from Drive → upload to Supabase storage
    const storagePath = buildStoragePath(
      recap_id,
      submission.athlete_id,
      submission.file_name ?? "unnamed"
    );

    const { publicUrl } = await downloadAndUpload(supabase, {
      fileId: submission.drive_file_id!,
      fileName: submission.file_name ?? "unnamed",
      storagePath,
    });

    // 3. Insert media record
    const mediaRecord = {
      campaign_id: recap_id,
      athlete_id: submission.athlete_id,
      type: submission.asset_type === "video" ? "video" : "image",
      file_url: publicUrl,
      thumbnail_url: submission.asset_type === "video" ? null : publicUrl,
      is_video_thumbnail: false,
      drive_file_id: submission.drive_file_id,
    };

    const { data: insertedMedia, error: insertError } = await supabase
      .from("media")
      .insert(mediaRecord)
      .select()
      .single();

    if (insertError) {
      console.error("[tier3/import] Insert error:", insertError);
      await removeUpload(supabase, storagePath);
      return NextResponse.json(
        { error: "Failed to create media record: " + insertError.message },
        { status: 500 }
      );
    }

    // 4. Update submission status
    await supabase
      .from("tier3_submissions")
      .update({
        status: "imported",
        campaign_media_id: insertedMedia.id,
        recap_id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submission_id);

    return NextResponse.json({
      success: true,
      media: insertedMedia,
    });
  } catch (error: any) {
    console.error("[tier3/import] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import submission" },
      { status: 500 }
    );
  }
}
