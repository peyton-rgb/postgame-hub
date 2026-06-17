// ============================================================
// POST /api/staff/videographer-link  (staff only)
//
// Staff generate a videographer upload link for a given athlete + deal from
// the review area. Ensures the athlete's participation + deliverables exist.
// Copy-to-clipboard only — nothing is sent.
//
// Body: { athleteId, campaignId, label? }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createVideographerLink } from "@/lib/videographer";

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
  const { athleteId, campaignId, label } = body || {};
  if (!athleteId || !campaignId) {
    return NextResponse.json({ error: "Missing athleteId or campaignId" }, { status: 400 });
  }

  const link = await createVideographerLink({
    athleteId,
    campaignId,
    createdBy: staff.id,
    label: typeof label === "string" ? label : null,
  });
  if (!link) {
    return NextResponse.json({ error: "Couldn't create the link. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, path: link.path });
}
