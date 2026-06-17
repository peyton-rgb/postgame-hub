// ============================================================
// POST /api/staff/auto-editor/suggest  (staff only)
//
// Generates edit suggestions for one deliverable (top pick). Body: { deliverableId }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { generateSuggestions } from "@/lib/suggestions";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { deliverableId } = body || {};
  if (!deliverableId) return NextResponse.json({ error: "Missing deliverableId" }, { status: 400 });

  try {
    const result = await generateSuggestions(deliverableId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("suggest error:", e?.message || e);
    return NextResponse.json({ error: "Couldn't generate suggestions." }, { status: 500 });
  }
}
