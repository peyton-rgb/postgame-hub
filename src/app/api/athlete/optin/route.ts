// ============================================================
// POST /api/athlete/optin — an athlete opts into a deal
//
// Records the opt-in in athlete_campaign_optins, keyed to BOTH the verified
// athlete (athlete_id → profiles) AND the deal (optin_campaign_id →
// optin_campaigns), and seeds the feed/reel deliverable rows. "My deals"
// reads from this same table, so the deal appears immediately.
//
// We intentionally do NOT touch campaign_optin_submissions: its optin_id
// foreign-keys the LEGACY campaign_optins table, so an optin_campaigns id
// there would always FK-violate (this was the "Couldn't record your opt-in"
// bug). The legacy/public submission pipeline is left untouched.
//
// athlete_id comes from the verified session — never the client body — so an
// athlete can only opt themselves in. Writes use the service role but are
// always scoped to the authenticated user's id. Idempotent via
// UNIQUE(athlete_id, optin_campaign_id).
// ============================================================

import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { ensureDeliverables } from "@/lib/athlete-deliverables";
import { notifyManagers, dealContext } from "@/lib/manager-notify";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { campaignId?: string; ftcAck?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const campaignId = body.campaignId;
  const ftcAck = body.ftcAck === true;
  if (!campaignId) {
    return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  }
  if (!ftcAck) {
    return NextResponse.json({ error: "You must agree to the FTC disclosure to opt in." }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify the athlete's profile + that the campaign is real and live.
  const [{ data: profile }, { data: campaign }] = await Promise.all([
    service.from("profiles").select("id,role,full_name,email,ig_handle").eq("id", user.id).single(),
    service.from("optin_campaigns").select("id,status,title,required_deliverables").eq("id", campaignId).maybeSingle(),
  ]);

  if (!profile || profile.role !== "athlete") {
    return NextResponse.json({ error: "Only athletes can opt into deals." }, { status: 403 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (campaign.status !== "live") {
    return NextResponse.json({ error: "This deal isn't open for opt-in right now." }, { status: 409 });
  }

  // Idempotent: if they're already in, just succeed (and make sure their
  // deliverable rows exist).
  const { data: existing } = await service
    .from("athlete_campaign_optins")
    .select("id")
    .eq("athlete_id", user.id)
    .eq("optin_campaign_id", campaignId)
    .maybeSingle();
  if (existing) {
    await ensureDeliverables(existing.id, user.id, campaignId, (campaign as any).required_deliverables);
    return NextResponse.json({ ok: true, alreadyOptedIn: true });
  }

  // Record the opt-in, keyed to BOTH the logged-in athlete and the
  // optin_campaigns deal. We do NOT write to campaign_optin_submissions: its
  // optin_id foreign-keys the LEGACY campaign_optins table, so inserting an
  // optin_campaigns id there is a guaranteed FK violation. The legacy/public
  // submission pipeline (campaign_optin_submissions / pending_optins) is left
  // untouched — the athlete app keys on athlete_id, never ig_handle.
  const { error: acoErr } = await service.from("athlete_campaign_optins").insert({
    athlete_id: user.id,
    optin_campaign_id: campaignId,
    status: "opted_in",
    ftc_ack: ftcAck,
  });

  if (acoErr) {
    // Unique-violation race → treat as already opted in.
    if ((acoErr as any).code === "23505") {
      return NextResponse.json({ ok: true, alreadyOptedIn: true });
    }
    console.error("athlete_campaign_optins insert error:", acoErr.message);
    return NextResponse.json({ error: "Couldn't record your opt-in. Please try again." }, { status: 500 });
  }

  // Create the feed/reel deliverable rows so the tracker is ready immediately.
  const { data: created } = await service
    .from("athlete_campaign_optins")
    .select("id")
    .eq("athlete_id", user.id)
    .eq("optin_campaign_id", campaignId)
    .maybeSingle();
  if (created) {
    await ensureDeliverables(created.id, user.id, campaignId, (campaign as any).required_deliverables);
  }

  // Notify managers of the new opt-in (only on the fresh path above).
  const ctx = await dealContext(user.id, campaignId);
  await notifyManagers({
    type: "new_optin",
    title: `${ctx.athleteName || "An athlete"} opted into a deal`,
    message: `${ctx.brandName ? ctx.brandName + " · " : ""}${ctx.campaignTitle ?? "deal"}.`,
    linkUrl: ctx.reviewLink,
    athleteName: ctx.athleteName,
    brandName: ctx.brandName,
    campaignTitle: ctx.campaignTitle,
  });

  return NextResponse.json({ ok: true });
}
