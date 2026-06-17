// ============================================================
// POST /api/v/upload-url  (PUBLIC — no session)
//
// Step 1 of the videographer upload: validate the token, enforce file type +
// size, and return a Supabase signed upload URL scoped to the token's
// athlete+campaign path. The client PUTs the file to that signed URL directly
// (handles large reels), then calls /api/v/register.
//
// Service role stays server-side. The page is treated as untrusted input.
// Body: { token, slot, fileName, contentType, fileSize }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import {
  validateVideographerToken,
  isAllowedType,
  maxBytesFor,
  VIDEOGRAPHER_BUCKET,
} from "@/lib/videographer";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_SLOTS = ["feed", "reel", "story"];

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { token, slot, fileName, contentType, fileSize } = body || {};

  if (!token || !rateLimit(`vupload:${token}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const link = await validateVideographerToken(token);
  if (!link) {
    return NextResponse.json({ error: "This upload link is no longer active." }, { status: 403 });
  }

  if (!ALLOWED_SLOTS.includes(slot)) {
    return NextResponse.json({ error: "Invalid deliverable." }, { status: 400 });
  }
  const kind = isAllowedType(contentType);
  if (!kind) {
    return NextResponse.json({ error: "Only image or video files are allowed." }, { status: 400 });
  }
  if (typeof fileSize !== "number" || fileSize <= 0 || fileSize > maxBytesFor(kind)) {
    const mb = Math.round(maxBytesFor(kind) / 1024 / 1024);
    return NextResponse.json({ error: `File too large (max ${mb} MB for ${kind}).` }, { status: 400 });
  }

  // Path is derived server-side from the validated token — the client cannot
  // influence which athlete/campaign it writes to.
  const ext = (typeof fileName === "string" && fileName.split(".").pop()) || (kind === "video" ? "mp4" : "jpg");
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
  const path = `videographer/${link.athleteId}/${link.optinCampaignId}/${slot}-${Date.now()}.${safeExt}`;

  const service = createServiceSupabase();
  const { data, error } = await service.storage.from(VIDEOGRAPHER_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl error:", error?.message);
    return NextResponse.json({ error: "Couldn't start the upload. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bucket: VIDEOGRAPHER_BUCKET, path, token: data.token });
}
