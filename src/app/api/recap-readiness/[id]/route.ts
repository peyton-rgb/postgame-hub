// ============================================================
// POST /api/recap-readiness/[id] — check one campaign, now.
//
// The "Check readiness" button on the campaign page. Runs exactly the same
// checkRecap() the daily sweep runs and writes the same recap_readiness row,
// so a button press and a cron run leave identical evidence.
//
// Staff only. Unlike the cron this is reached from a browser with a session, so
// it authenticates the user rather than a shared secret.
//
// Sends no email — the button shows its result inline. Writes no agent_runs
// row either: that table records the unattended sweep, and one row per button
// press would drown it.
//
// Not restricted to delivered campaigns or to the 120-day window. Those bound
// what the sweep reports on; asking about one campaign on purpose is a
// different question, and refusing to answer it for an active campaign would
// be surprising.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { checkRecap, RECAP_SELECT, type RecapRow } from "@/lib/recap-readiness";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // Staff gate. The service client below bypasses RLS, so this is the only
  // thing standing between a logged-out caller and a Drive-backed check.
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email?.endsWith("@pstgm.com")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();

  const { data, error } = await supabase
    .from("campaign_recaps")
    .select(RECAP_SELECT)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "campaign not found" }, { status: 404 });

  try {
    const check = await checkRecap(supabase, data as RecapRow);
    return NextResponse.json({ ok: true, check });
  } catch (e) {
    console.error("[readiness] single check failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "readiness check failed" }, { status: 500 });
  }
}
