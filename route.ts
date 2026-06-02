// src/app/api/media/upload/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/media/upload   (application/json — NOT multipart)
// Body: { campaignId, athleteId, storagePath }
//
// The browser uploads the file DIRECTLY to Supabase Storage (the
// campaign-media bucket) before calling this — the same pattern
// CampaignMediaPicker already uses. That bypasses Vercel's ~4.5MB
// serverless request-body limit (a multipart file POST would 413
// for typical 4–8MB photos and all videos).
//
// This endpoint just validates and inserts the media row with the
// service role for a file that is already sitting in Storage.
// drive_file_id is left null — these files don't come from Drive.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MEDIA_BUCKET = "campaign-media";
const EXT_IMAGE = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
const EXT_VIDEO = ["mp4", "mov", "webm"];

function extOf(p: string): string {
  return p.split(".").pop()?.toLowerCase() || "";
}

export async function POST(request: NextRequest) {
  // Track these so we can clean up the orphaned Storage object if we bail
  // out after the browser already uploaded it.
  let supabase: ReturnType<typeof createServiceSupabase> | null = null;
  let storagePath = "";

  const cleanup = async () => {
    if (supabase && storagePath) {
      try {
        await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
      } catch {
        /* best-effort */
      }
    }
  };

  try {
    const body = await request.json().catch(() => ({}));
    const campaignId = String(body.campaignId || "");
    const athleteId = String(body.athleteId || "");
    storagePath = String(body.storagePath || "");

    if (!campaignId || !athleteId || !storagePath) {
      return NextResponse.json(
        { error: "Missing required fields: campaignId, athleteId, storagePath." },
        { status: 400 }
      );
    }

    // Security: the uploaded object must live under this campaign's folder.
    if (!storagePath.startsWith(`${campaignId}/`)) {
      return NextResponse.json({ error: "storagePath does not match campaignId." }, { status: 400 });
    }

    supabase = createServiceSupabase();

    // Validate type from the stored file's extension.
    const ext = extOf(storagePath);
    const isImage = EXT_IMAGE.includes(ext);
    const isVideo = EXT_VIDEO.includes(ext);
    if (!isImage && !isVideo) {
      await cleanup();
      return NextResponse.json({ error: "Only images and videos are supported." }, { status: 400 });
    }

    // Validate the athlete belongs to this campaign.
    const { data: athlete, error: athErr } = await supabase
      .from("athletes")
      .select("id, campaign_id")
      .eq("id", athleteId)
      .maybeSingle();
    if (athErr) {
      await cleanup();
      return NextResponse.json({ error: "Athlete lookup failed: " + athErr.message }, { status: 500 });
    }
    if (!athlete || athlete.campaign_id !== campaignId) {
      await cleanup();
      return NextResponse.json({ error: "Athlete does not belong to this campaign." }, { status: 400 });
    }

    // Re-derive the public URL server-side (don't trust a client-sent URL).
    const {
      data: { publicUrl },
    } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

    const type = isVideo ? "video" : "image";

    const { data: media, error: insertError } = await supabase
      .from("media")
      .insert({
        campaign_id: campaignId,
        athlete_id: athleteId,
        type,
        file_url: publicUrl,
        thumbnail_url: isVideo ? null : publicUrl,
        is_video_thumbnail: false,
        drive_file_id: null, // manual upload — not from Drive
      })
      .select()
      .single();

    if (insertError) {
      await cleanup();
      return NextResponse.json(
        { error: "Failed to create media record: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, media });
  } catch (error: any) {
    await cleanup();
    return NextResponse.json({ error: error?.message || "Upload failed" }, { status: 500 });
  }
}
