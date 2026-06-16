// ============================================================
// POST /api/athlete/deliverables/upload
//
// Called AFTER the browser has uploaded the file to the campaign-media
// storage bucket. Creates the media row (stamped with the slot) and links it
// to the athlete's deliverable, flipping it to "uploaded". Ownership is
// verified from the session — an athlete can only touch their own rows.
//
// Body: { optinId, slot, storagePath, fileName, fileSize, contentType }
// ============================================================

import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "campaign-media";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { optinId, slot, storagePath, fileName, fileSize, contentType } = body || {};
  if (!optinId || !slot || !storagePath) {
    return NextResponse.json({ error: "Missing optinId, slot, or storagePath" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify this deliverable belongs to the logged-in athlete.
  const { data: deliverable } = await service
    .from("athlete_deliverables")
    .select("id,athlete_id,optin_campaign_id,media_id")
    .eq("optin_id", optinId)
    .eq("slot", slot)
    .maybeSingle();

  if (!deliverable || deliverable.athlete_id !== user.id) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }

  // Guard against path spoofing: the athlete may only register files stored
  // under their own prefix.
  if (!storagePath.startsWith(`athlete/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(storagePath);
  const fileUrl = pub.publicUrl;
  const isVideo = typeof contentType === "string" && contentType.startsWith("video/");

  // Create the media asset row.
  const { data: media, error: mediaErr } = await service
    .from("media")
    .insert({
      campaign_id: deliverable.optin_campaign_id,
      athlete_id: user.id,
      type: isVideo ? "video" : "image",
      file_url: fileUrl,
      slot,
      storage_path: storagePath,
      storage_bucket: BUCKET,
      content_type: contentType ?? null,
      file_size_bytes: typeof fileSize === "number" ? fileSize : null,
      source_system: "athlete-app",
      hero_source: "athlete_upload",
    })
    .select("id,file_url")
    .single();

  if (mediaErr) {
    console.error("media insert error:", mediaErr.message);
    return NextResponse.json({ error: "Couldn't save your file. Please try again." }, { status: 500 });
  }

  // Link it to the deliverable and mark uploaded (resets a rejected one).
  const { error: updErr } = await service
    .from("athlete_deliverables")
    .update({
      media_id: media.id,
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
      review_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliverable.id);

  if (updErr) {
    console.error("deliverable update error:", updErr.message);
    return NextResponse.json({ error: "Couldn't update your deliverable. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mediaId: media.id, fileUrl: media.file_url, fileName });
}
