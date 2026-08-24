// ============================================================
// POST /api/v/register  (PUBLIC — no session)
//
// Step 2 of the videographer upload: after the file is in storage, register
// it on the athlete's deliverable (same pipeline as athlete uploads), so
// everything downstream is agnostic to who uploaded. The storage path MUST be
// under the token's own athlete prefix — anything else is rejected.
//
// Body: { token, slot, path, contentType, fileSize, slotIndex? }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import {
  validateVideographerToken,
  ensureParticipation,
  isAllowedType,
  VIDEOGRAPHER_BUCKET,
} from "@/lib/videographer";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_SLOTS = ["feed", "reel", "story"];

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { token, slot, path, contentType, fileSize } = body || {};
  // Optional instance discriminator. Absent (today's callers) means "the only
  // one", which the lookup below verifies rather than assumes.
  const slotIndex =
    Number.isInteger(body?.slotIndex) && body.slotIndex > 0 ? (body.slotIndex as number) : null;

  if (!token || !rateLimit(`vregister:${token}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const link = await validateVideographerToken(token);
  if (!link) {
    return NextResponse.json({ error: "This upload link is no longer active." }, { status: 403 });
  }
  if (!ALLOWED_SLOTS.includes(slot)) {
    return NextResponse.json({ error: "Invalid deliverable." }, { status: 400 });
  }
  // The path must live under this token's own athlete prefix.
  if (typeof path !== "string" || !path.startsWith(`videographer/${link.athleteId}/${link.optinCampaignId}/`)) {
    return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
  }
  const kind = isAllowedType(contentType) || "image";

  const optinId = await ensureParticipation(link.athleteId, link.optinCampaignId);
  if (!optinId) {
    return NextResponse.json({ error: "Couldn't find the deal for this link." }, { status: 404 });
  }

  const service = createServiceSupabase();

  // Resolve exactly one deliverable before writing. Uniqueness is
  // (optin_id, slot, slot_index), so a filter on slot alone can match several
  // rows — an unbounded update would write this one file onto all of them.
  let finder = service
    .from("athlete_deliverables")
    .select("id,slot_index")
    .eq("optin_id", optinId)
    .eq("slot", slot);
  if (slotIndex !== null) finder = finder.eq("slot_index", slotIndex);
  const { data: matches, error: findErr } = await finder.order("slot_index", { ascending: true });

  if (findErr) {
    console.error("videographer register lookup error:", findErr.message);
    return NextResponse.json({ error: "Couldn't save your upload. Please try again." }, { status: 500 });
  }
  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: "Invalid deliverable." }, { status: 404 });
  }
  if (matches.length > 1) {
    // The link named a slot but not which instance of it. Refuse rather than
    // overwriting an unrelated instance's file.
    return NextResponse.json(
      { error: "This deal has more than one slot of this type. Ask Postgame for an updated upload link." },
      { status: 409 }
    );
  }

  const { data: pub } = service.storage.from(VIDEOGRAPHER_BUCKET).getPublicUrl(path);
  const now = new Date().toISOString();

  const { error: updErr } = await service
    .from("athlete_deliverables")
    .update({
      file_url: pub.publicUrl,
      storage_path: path,
      storage_bucket: VIDEOGRAPHER_BUCKET,
      content_type: typeof contentType === "string" ? contentType : null,
      file_size_bytes: typeof fileSize === "number" ? fileSize : null,
      media_type: kind === "video" ? "video" : "image",
      status: "uploaded",
      uploaded_at: now,
      review_note: null,
      updated_at: now,
    })
    .eq("id", matches[0].id);

  if (updErr) {
    console.error("videographer register error:", updErr.message);
    return NextResponse.json({ error: "Couldn't save your upload. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileUrl: pub.publicUrl });
}
