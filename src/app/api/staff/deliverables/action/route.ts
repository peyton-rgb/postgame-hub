// ============================================================
// POST /api/staff/deliverables/action  (staff only)
//
// The two approval gates, manager side:
//   approve → content approval: in_review → approved
//   reject  → content approval: in_review → changes_requested (+ note)
//   verify  → post verification: pending_verification → verified
//
// When every deliverable on a deal is verified, the opt-in is marked
// 'completed' and a pending payout is created (payout execution is stubbed
// in Phase 5 — see createPendingPayout).
//
// Body: { deliverableId, action, note? }
// ============================================================

import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { createPendingPayout } from "@/lib/payouts";
import { notifyAthlete } from "@/lib/notify";
import { slotLabel } from "@/lib/deliverable-status";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { deliverableId, action, note } = body || {};
  if (!deliverableId || !["approve", "reject", "verify"].includes(action)) {
    return NextResponse.json({ error: "Missing deliverableId or invalid action" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data: deliverable } = await service
    .from("athlete_deliverables")
    .select(
      "id,status,optin_id,slot,athlete_id,optin_campaign_id,campaign:optin_campaigns(title,brand:brands(name))"
    )
    .eq("id", deliverableId)
    .maybeSingle();
  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }
  const campaign = Array.isArray((deliverable as any).campaign) ? (deliverable as any).campaign[0] : (deliverable as any).campaign;
  const brand = campaign ? (Array.isArray(campaign.brand) ? campaign.brand[0] : campaign.brand) : null;
  const brandName = brand?.name || "your brand";
  const dealLink = `/athlete/my-deals/${deliverable.optin_id}`;

  const now = new Date().toISOString();
  let update: Record<string, any> = { updated_at: now };

  if (action === "approve") {
    if (deliverable.status !== "in_review") {
      return NextResponse.json({ error: "Only in-review content can be approved." }, { status: 409 });
    }
    update = { ...update, status: "approved", approved_at: now, review_note: null };
  } else if (action === "reject") {
    if (deliverable.status !== "in_review") {
      return NextResponse.json({ error: "Only in-review content can be rejected." }, { status: 409 });
    }
    update = { ...update, status: "changes_requested", review_note: note || "Please revise and re-upload." };
  } else if (action === "verify") {
    if (deliverable.status !== "pending_verification") {
      return NextResponse.json({ error: "Only posted content awaiting verification can be verified." }, { status: 409 });
    }
    update = { ...update, status: "verified", verified_at: now };
  }

  const { error: updErr } = await service
    .from("athlete_deliverables")
    .update(update)
    .eq("id", deliverableId);
  if (updErr) {
    console.error("staff action update error:", updErr.message);
    return NextResponse.json({ error: "Couldn't update. Please try again." }, { status: 500 });
  }

  // Next-step nudge to the athlete (mockup screen 9).
  if (action === "approve") {
    await notifyAthlete(deliverable.athlete_id, {
      type: "content_approved",
      title: `Your ${brandName} content is approved`,
      message: `Time to post your ${slotLabel(deliverable.slot).toLowerCase()}. Tap for your file, caption, and link.`,
      linkUrl: dealLink,
      campaignId: deliverable.optin_campaign_id,
    });
  } else if (action === "reject") {
    await notifyAthlete(deliverable.athlete_id, {
      type: "changes_requested",
      title: `Changes needed on your ${brandName} content`,
      message: update.review_note || "Tap to see what to update and re-upload.",
      linkUrl: dealLink,
      campaignId: deliverable.optin_campaign_id,
    });
  } else if (action === "verify") {
    await notifyAthlete(deliverable.athlete_id, {
      type: "post_verified",
      title: `Your ${brandName} post is verified`,
      message: `Nice — your ${slotLabel(deliverable.slot).toLowerCase()} is confirmed live.`,
      linkUrl: dealLink,
      campaignId: deliverable.optin_campaign_id,
    });
  }

  // After a verify, see if the whole deal is done.
  let dealComplete = false;
  if (action === "verify") {
    const { data: siblings } = await service
      .from("athlete_deliverables")
      .select("status")
      .eq("optin_id", deliverable.optin_id);
    dealComplete = !!siblings && siblings.length > 0 && siblings.every((s) => s.status === "verified" || s.status === "paid");
    if (dealComplete) {
      await service
        .from("athlete_campaign_optins")
        .update({ status: "completed", updated_at: now })
        .eq("id", deliverable.optin_id);
      // Phase 5: schedule the payout (stubbed execution).
      await createPendingPayout(deliverable.optin_id);
      await notifyAthlete(deliverable.athlete_id, {
        type: "payout_scheduled",
        title: `Payout scheduled for ${brandName}`,
        message: "All your posts are verified. Your payout is scheduled — link your PayPal to get paid.",
        linkUrl: "/athlete/earnings",
        campaignId: deliverable.optin_campaign_id,
      });
    }
  }

  return NextResponse.json({ ok: true, dealComplete });
}
