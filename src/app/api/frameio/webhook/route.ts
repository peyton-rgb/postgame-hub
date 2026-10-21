// ============================================================
// POST /api/frameio/webhook  (called by Frame.io only)
//
// The "doorbell". Frame.io calls this the moment something happens in the
// workspace — Phase 1 cares about comment.* events (Dom's notes on the
// Raising Cane's basketball edits).
//
// What it does, in order:
//   1. Checks Frame.io's signature (the wax seal). No valid seal → 401.
//   2. Writes one row to frameio_webhook_events with the raw payload.
//   3. Answers 200 right away. Frame.io retries if it doesn't hear back fast,
//      so nothing slow (no Frame.io lookups, no edits) happens here.
//
// Phase 1 only logs. Looking up the comment text and handing work to the
// Mac Studio come later, off this request.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { summarizeFrameioPayload, verifyFrameioSignature } from "@/lib/frameio-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.FRAMEIO_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // The signature covers the bytes exactly as sent, so read the body as text first.
  const raw = await request.text();
  const ok = verifyFrameioSignature(
    raw,
    request.headers.get("x-frameio-request-timestamp"),
    request.headers.get("x-frameio-signature"),
    secret
  );
  if (!ok) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createLiveServiceSupabase();
  const { error } = await supabase
    .from("frameio_webhook_events")
    .insert({ ...summarizeFrameioPayload(payload), payload });

  if (error) {
    // A 500 makes Frame.io retry later, which is what we want if the
    // database hiccuped — the note isn't lost.
    console.error("[frameio-webhook] insert failed", error.message);
    return NextResponse.json({ error: "Could not record event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
