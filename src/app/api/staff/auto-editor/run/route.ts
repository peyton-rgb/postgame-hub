// ============================================================
// POST /api/staff/auto-editor/run  (staff only)
//
// Runs the curator on one athlete + deal: scores the uploaded content, applies
// the compliance gate + dedupe, persists content_evaluations, returns the
// results (top picks first). Stubs cleanly if ANTHROPIC_API_KEY is unset.
//
// Body: { athleteId, campaignId }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { runAutoEditor } from "@/lib/auto-editor";

export const maxDuration = 120; // vision scoring can take a while

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
  const { athleteId, campaignId } = body || {};
  if (!athleteId || !campaignId) {
    return NextResponse.json({ error: "Missing athleteId or campaignId" }, { status: 400 });
  }

  try {
    const result = await runAutoEditor(athleteId, campaignId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("auto-editor run error:", e?.message || e);
    return NextResponse.json({ error: "Auto editor failed. Please try again." }, { status: 500 });
  }
}
