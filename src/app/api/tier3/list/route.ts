import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const campaign_id = req.nextUrl.searchParams.get("campaign_id");
  const athlete_id = req.nextUrl.searchParams.get("athlete_id");

  if (!campaign_id || !athlete_id) {
    return NextResponse.json({ error: "campaign_id and athlete_id required" }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("tier3_submissions")
    .select("*")
    .eq("campaign_id", campaign_id)
    .eq("athlete_id", athlete_id)
    .eq("status", "scored")
    .order("score_composite", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
