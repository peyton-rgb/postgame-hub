// src/app/api/athletes/list/route.ts
// ─────────────────────────────────────────────────────────────
// GET /api/athletes/list?campaignId=XXXXX
//
// Returns all athletes on a campaign, alphabetized by name.
// Used by DriveImportModal for folder-to-athlete matching
// and manual mapping dropdowns.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { error: "Missing campaignId parameter" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("athletes")
      .select("id, name")
      .eq("campaign_id", campaignId)
      .order("name");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ athletes: data || [] });
  } catch (error: any) {
    console.error("[athletes/list] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list athletes" },
      { status: 500 }
    );
  }
}
