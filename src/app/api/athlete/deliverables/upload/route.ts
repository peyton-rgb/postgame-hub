// ============================================================
// POST /api/athlete/deliverables/upload
//
// Called AFTER the browser has uploaded the file to the campaign-media
// storage bucket. Creates the media row (stamped with the slot) and links it
// to the athlete's deliverable, flipping it to "uploaded". Ownership is
// verified from the session — an athlete can only touch their own rows.
//
// Body: { storagePath, fileName, fileSize, contentType,
//         and either deliverableId, or optinId + slot (+ optional slotIndex) }
// ============================================================

import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { ensureAthleteDealFolder } from "@/lib/athlete-drive";
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
  const { optinId, slot, deliverableId, storagePath, fileName, fileSize, contentType } = body || {};
  // Optional instance discriminator, for campaigns with more than one of a slot.
  const slotIndex =
    Number.isInteger(body?.slotIndex) && body.slotIndex > 0 ? (body.slotIndex as number) : null;
  if (!storagePath || (!deliverableId && (!optinId || !slot))) {
    return NextResponse.json(
      { error: "Missing storagePath, and either deliverableId or optinId + slot" },
      { status: 400 }
    );
  }

  const service = createServiceSupabase();

  // Resolve exactly one deliverable. Uniqueness is (optin_id, slot, slot_index),
  // so slot alone can match several rows — which used to make .maybeSingle()
  // error out and 404 a valid upload.
  const COLS = "id,athlete_id,optin_id,optin_campaign_id,slot_index";
  let deliverable: any = null;

  if (deliverableId) {
    // Preferred shape: the client already knows the row.
    const { data } = await service
      .from("athlete_deliverables")
      .select(COLS)
      .eq("id", deliverableId)
      .eq("athlete_id", user.id)
      .maybeSingle();
    deliverable = data;
  } else {
    // Scoped to the caller: a non-owner matches nothing and falls through to
    // the same 404 as before, so the ambiguity check below can never become an
    // existence oracle for someone else's deal.
    let finder = service
      .from("athlete_deliverables")
      .select(COLS)
      .eq("optin_id", optinId)
      .eq("slot", slot)
      .eq("athlete_id", user.id);
    if (slotIndex !== null) finder = finder.eq("slot_index", slotIndex);
    const { data: matches } = await finder.order("slot_index", { ascending: true });
    if (matches && matches.length > 1) {
      // Ambiguous without an instance: refuse rather than overwrite the wrong one.
      return NextResponse.json(
        { error: "This deal has more than one slot of this type. Contact Postgame — your upload page needs updating." },
        { status: 409 }
      );
    }
    deliverable = matches?.[0] ?? null;
  }

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

  // Append a version rather than overwriting the file. The function locks the
  // parent row, computes the next version_number, inserts the version and
  // repoints file_url / thumbnail_url / media_type / uploaded_at in one atomic
  // step — so two concurrent uploads cannot both claim the same version.
  // Called first: if the status write below fails, the athlete's file is still
  // saved and pointed at, which is the safer half to have landed.
  const { error: verErr } = await service.rpc("add_deliverable_version", {
    p_deliverable_id: deliverable.id,
    p_file_url: fileUrl,
    p_media_type: isVideo ? "video" : "image",
    p_source: "athlete",
    p_created_by: null, // created_by records staff actors; an athlete upload has none
  });
  if (verErr) {
    console.error("add_deliverable_version error:", verErr.message);
    return NextResponse.json({ error: "Couldn't save your file. Please try again." }, { status: 500 });
  }

  // Status, and the storage fields the function does not manage.
  const now = new Date().toISOString();
  const { error: updErr } = await service
    .from("athlete_deliverables")
    .update({
      storage_path: storagePath,
      storage_bucket: BUCKET,
      content_type: contentType ?? null,
      file_size_bytes: typeof fileSize === "number" ? fileSize : null,
      status: "uploaded",
      review_note: null,
      updated_at: now,
    })
    .eq("id", deliverable.id);

  if (updErr) {
    console.error("deliverable update error:", updErr.message);
    return NextResponse.json({ error: "Couldn't save your file. Please try again." }, { status: 500 });
  }

  // Best-effort: ensure the deal's Drive folder exists (stubbed if Drive isn't
  // configured). Never blocks the upload.
  try {
    await ensureAthleteDealFolder(deliverable.optin_id ?? optinId);
  } catch (e) {
    console.error("[drive] ensure folder (upload) failed:", e);
  }

  return NextResponse.json({ ok: true, fileUrl, fileName });
}
