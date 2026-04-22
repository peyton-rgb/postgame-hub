// ─────────────────────────────────────────────────────────────────────────────
// GET /api/recap/[slug]/pptx
//
// Returns a fully editable .pptx file for a published campaign recap.
// Fetches the same data the public /recap/[slug] page uses, then hands it off
// to buildRecapPptx() to produce the binary file.
//
// Usage:
//   <a href="/api/recap/my-campaign/pptx" download>Export as PowerPoint</a>
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createPlainSupabase } from "@/lib/supabase";
import { buildRecapPptx, recapFileName } from "@/lib/pptx-export";
import type { Media } from "@/lib/types";

// Force dynamic rendering — this route always runs fresh against the database.
export const dynamic = "force-dynamic";
// Explicit Node runtime — pptxgenjs + Buffer aren't available on Edge runtime.
export const runtime = "nodejs";
// Give the route enough time to fetch images and assemble the deck.
// (Vercel Hobby caps at 10s regardless; Pro respects this up to 60s.)
export const maxDuration = 60;

type Params = { slug: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const { slug } = await params;
  const supabase = createPlainSupabase();

  // 1. Fetch the campaign (must be published — same rule the public page uses)
  const { data: campaign, error: campaignErr } = await supabase
    .from("campaign_recaps")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (campaignErr || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Top 50 rankings use a different layout and aren't supported by this exporter yet.
  if (campaign.settings?.campaign_type === "top_50") {
    return NextResponse.json(
      { error: "PowerPoint export is not yet supported for Top 50 recaps." },
      { status: 400 },
    );
  }

  // 2. Fetch athletes and media in parallel
  const [{ data: athletes }, { data: mediaRows }] = await Promise.all([
    supabase.from("athletes").select("*").eq("campaign_id", campaign.id).order("sort_order"),
    supabase.from("media").select("*").eq("campaign_id", campaign.id).order("sort_order"),
  ]);

  // 3. Group media by athlete (same shape CampaignRecap expects)
  const mediaByAthlete: Record<string, Media[]> = {};
  (mediaRows || []).forEach((m: Media) => {
    if (!mediaByAthlete[m.athlete_id]) mediaByAthlete[m.athlete_id] = [];
    mediaByAthlete[m.athlete_id].push(m);
  });

  // 4. Build the .pptx
  let buffer: Buffer;
  try {
    buffer = await buildRecapPptx(campaign, athletes || [], mediaByAthlete);
  } catch (err) {
    const e = err as Error;
    console.error(`[pptx-export] Build failed for slug="${slug}"`, {
      message: e.message,
      name: e.name,
      stack: e.stack?.split("\n").slice(0, 10).join("\n"),
      athleteCount: (athletes || []).length,
      mediaCount: (mediaRows || []).length,
    });
    return NextResponse.json(
      {
        error: "Failed to generate PowerPoint.",
        detail: e.message,
      },
      { status: 500 },
    );
  }

  // 5. Return as a file download
  const filename = recapFileName(campaign);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
