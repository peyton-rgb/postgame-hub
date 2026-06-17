// ============================================================
// POST /api/athlete/deliverables/post-link
//
// The athlete has posted approved content and is submitting the live URL.
// approved/to_post → pending_verification. A manager verifies it next.
// Ownership verified from the session.
//
// Body: { deliverableId, liveUrl }
// ============================================================

import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { notifyManagers, dealContext } from "@/lib/manager-notify";
import { NextRequest, NextResponse } from "next/server";

function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

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
  const { deliverableId, liveUrl } = body || {};
  if (!deliverableId || !liveUrl) {
    return NextResponse.json({ error: "Missing deliverableId or liveUrl" }, { status: 400 });
  }
  if (!isValidUrl(liveUrl)) {
    return NextResponse.json({ error: "Enter a valid post link (https://…)." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data: deliverable } = await service
    .from("athlete_deliverables")
    .select("id,status,athlete_id,optin_campaign_id,slot")
    .eq("id", deliverableId)
    .maybeSingle();

  if (!deliverable || deliverable.athlete_id !== user.id) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }
  if (!["approved", "to_post", "pending_verification"].includes(deliverable.status)) {
    return NextResponse.json({ error: "This content isn't ready to post yet." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await service
    .from("athlete_deliverables")
    .update({ live_url: liveUrl, status: "pending_verification", posted_at: now, updated_at: now })
    .eq("id", deliverableId);

  if (updErr) {
    console.error("post-link update error:", updErr.message);
    return NextResponse.json({ error: "Couldn't save your link. Please try again." }, { status: 500 });
  }

  // Notify managers a live post is awaiting verification.
  if ((deliverable as any).optin_campaign_id) {
    const ctx = await dealContext(deliverable.athlete_id, (deliverable as any).optin_campaign_id);
    const who = ctx.athleteName || "An athlete";
    await notifyManagers({
      type: "post_awaiting_verification",
      title: `${who} posted — verify it's live`,
      message: `${ctx.brandName ? ctx.brandName + " · " : ""}${ctx.campaignTitle ?? "deal"} — ${(deliverable as any).slot ?? "a deliverable"} post is awaiting verification.`,
      linkUrl: ctx.reviewLink,
      athleteName: ctx.athleteName,
      brandName: ctx.brandName,
      campaignTitle: ctx.campaignTitle,
    });
  }

  return NextResponse.json({ ok: true });
}
