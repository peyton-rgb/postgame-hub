// ============================================================
// POST /api/staff/deliverables/action  (staff only)
//
// The two approval gates, manager side:
//   approve → content approval: in_review | brand_review → approved
//   reject  → content approval: in_review | brand_review → changes_requested (+ note)
//   verify  → post verification: pending_verification → verified
//   send_back_to_athlete → in_edit → changes_requested, after an employee has
//                          edited the compiled brand feedback in review_note
//
// The transition logic itself lives in src/lib/deliverable-transitions.ts so
// that the brand decision routes and the staff queue write status through the
// same code path. This route is the staff-authenticated door to it.
//
// Body: { deliverableId, action, note? }
// ============================================================

import { getStaffUser } from "@/lib/staff-auth";
import {
  applyDeliverableTransition,
  type DeliverableTransition,
} from "@/lib/deliverable-transitions";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ACTIONS: DeliverableTransition[] = [
  "approve",
  "reject",
  "verify",
  "send_back_to_athlete",
];

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
  if (!deliverableId || !ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Missing deliverableId or invalid action" }, { status: 400 });
  }

  const result = await applyDeliverableTransition(deliverableId, action, { note });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, dealComplete: result.dealComplete });
}
