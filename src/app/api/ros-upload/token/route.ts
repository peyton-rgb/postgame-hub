// ============================================================
// POST /api/ros-upload/token  (PUBLIC — no session)
//
// Issues a short-lived signed upload token for one shoot. The crew's browser
// hands it to the Mac Studio's tus server with every file; the Studio trusts
// the token's dest_base to decide where files land in LucidLink, so the
// browser never builds a LucidLink path itself.
//
// Body: { shootId }
// Returns: { token, uploadUrl, expiresAt }   (expiresAt = unix seconds)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildDestBase,
  isRosUploadConfigured,
  parseShootDate,
  signUploadToken,
  tokenExpiry,
} from "@/lib/ros-upload";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const shootId = body?.shootId;
  if (typeof shootId !== "string" || !UUID_RE.test(shootId)) {
    return NextResponse.json({ code: "bad_request", error: "Missing shootId." }, { status: 400 });
  }

  if (!isRosUploadConfigured()) {
    return NextResponse.json(
      { code: "not_configured", error: "Uploads aren't set up yet." },
      { status: 503 }
    );
  }

  // Best-effort (per server instance): 30 tokens per shoot per hour.
  if (!rateLimit(`ros-upload-token:${shootId}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json(
      { code: "rate_limited", error: "Too many requests. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const supabase = createLiveServiceSupabase();

  const { data: shoot } = await supabase
    .from("ros_shoots")
    .select("id, slug, date, run_of_show_id")
    .eq("id", shootId)
    .maybeSingle();

  const { data: ros } = shoot
    ? await supabase
        .from("run_of_shows")
        .select("id, client_name, brand_id, published, uploads_enabled, lucid_campaign_folder")
        .eq("id", shoot.run_of_show_id)
        .maybeSingle()
    : { data: null };

  const campaignFolder = ros?.lucid_campaign_folder?.trim();
  if (!shoot || !ros || !ros.published || !ros.uploads_enabled || !campaignFolder) {
    return NextResponse.json(
      { code: "uploads_off", error: "Uploads aren't open for this shoot." },
      { status: 403 }
    );
  }

  let brand: string = ros.client_name;
  if (ros.brand_id) {
    const { data: brandRow } = await supabase
      .from("brands")
      .select("name")
      .eq("id", ros.brand_id)
      .maybeSingle();
    if (brandRow?.name?.trim()) brand = brandRow.name;
  }

  const shootDate = parseShootDate(shoot.date);
  const exp = tokenExpiry(shootDate);
  if (exp * 1000 <= Date.now()) {
    return NextResponse.json(
      { code: "token_expired", error: "This upload link has expired." },
      { status: 403 }
    );
  }

  const token = signUploadToken({
    v: 1,
    shoot_id: shoot.id,
    dest_base: buildDestBase({
      brand,
      year: shootDate ? shootDate.getUTCFullYear() : new Date().getFullYear(),
      campaignFolder,
      shootSlug: shoot.slug,
    }),
    exp,
  });

  return NextResponse.json(
    { token, uploadUrl: process.env.NEXT_PUBLIC_ROS_UPLOAD_URL, expiresAt: exp },
    { headers: { "Cache-Control": "no-store" } }
  );
}
