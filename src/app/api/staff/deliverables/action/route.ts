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
    .select("id,status,optin_id")
    .eq("id", deliverableId)
    .maybeSingle();
  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }

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
    }
  }

  return NextResponse.json({ ok: true, dealComplete });
}
