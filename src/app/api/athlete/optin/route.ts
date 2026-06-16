// ============================================================
// POST /api/athlete/optin — an athlete opts into a deal
//
// Reuses the EXISTING opt-in pipeline: the action writes a row to
// campaign_optin_submissions (same table the public opt-in forms use), then
// records the app's per-athlete participation in athlete_campaign_optins so
// "My deals" can track it. athlete_id is taken from the verified session —
// never from the client body — so an athlete can only opt themselves in.
//
// Writes use the service role (bypasses RLS) but are always scoped to the
// authenticated user's id.
// ============================================================

import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { ensureDeliverables } from "@/lib/athlete-deliverables";
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

  // 1) Existing pipeline: record the submission.
  const { data: submission, error: subErr } = await service
    .from("campaign_optin_submissions")
    .insert({
      optin_id: campaignId,
      ig_handle: profile.ig_handle ?? null,
      data: {
        source: "athlete-app",
        athlete_id: user.id,
        full_name: profile.full_name,
        email: profile.email,
        ig_handle: profile.ig_handle,
        ftc_ack: ftcAck,
      },
    })
    .select("id")
    .single();

  if (subErr) {
    console.error("optin submission insert error:", subErr.message);
    return NextResponse.json({ error: "Couldn't record your opt-in. Please try again." }, { status: 500 });
  }

  // 2) App participation ledger.
  const { error: acoErr } = await service.from("athlete_campaign_optins").insert({
    athlete_id: user.id,
    optin_campaign_id: campaignId,
    status: "opted_in",
    ftc_ack: ftcAck,
    submission_id: submission?.id ?? null,
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

  return NextResponse.json({ ok: true });
}
