// ============================================================
// POST /api/athlete/videographer-link
//
// An athlete generates a videographer upload link for one of their own deals.
// athlete_id is the verified session user — they can only make links for
// themselves. Returns the relative /v/[token] path (copy-to-clipboard only;
// nothing is sent anywhere).
//
// Body: { campaignId }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createVideographerLink } from "@/lib/videographer";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { campaignId } = body || {};
  if (!campaignId) {
    return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  }

  // Only an athlete who is actually on this deal can make a link for it.
  const { data: optin } = await supabase
    .from("athlete_campaign_optins")
    .select("id")
    .eq("athlete_id", user.id)
    .eq("optin_campaign_id", campaignId)
    .maybeSingle();
  if (!optin) {
    return NextResponse.json({ error: "You're not on this deal." }, { status: 403 });
  }

  const link = await createVideographerLink({ athleteId: user.id, campaignId, createdBy: user.id });
  if (!link) {
    return NextResponse.json({ error: "Couldn't create the link. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, path: link.path });
}
