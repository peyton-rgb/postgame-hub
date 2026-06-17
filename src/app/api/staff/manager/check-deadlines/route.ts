// ============================================================
// POST/GET /api/staff/manager/check-deadlines
//
// Fires deadline notifications for due-soon / overdue campaigns (deduped).
// Allowed for a logged-in staff user OR a scheduler that sends the CRON_SECRET.
// Wire a Vercel cron to this route to run it on a schedule.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { checkCampaignDeadlines } from "@/lib/manager-notify";

async function handle(request: NextRequest) {
  const cronKey = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-key") || new URL(request.url).searchParams.get("key");
  const authorized = (cronKey && provided === cronKey) || (await getStaffUser()) !== null;
  if (!authorized) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  try {
    const sent = await checkCampaignDeadlines();
    return NextResponse.json({ ok: true, sent });
  } catch (e: any) {
    console.error("check-deadlines error:", e?.message || e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}
export async function GET(request: NextRequest) {
  return handle(request);
}
