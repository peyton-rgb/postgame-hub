import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createServiceSupabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// GET /api/intake/reprocess?id=<uuid>          (single)
// GET /api/intake/reprocess?ids=<uuid,uuid>    (a few)
//
// Manually (re)send already-uploaded video(s) to the FFmpeg worker for frame
// extraction + tagging.
//
// Why this exists: the normal /api/intake path only hands a video to the
// worker at the moment of UPLOAD. Videos that were uploaded before the worker
// was wired up never got processed, and nothing re-sends them. This endpoint
// lets us hand an existing video to the worker on demand.
//
// Unlike /api/intake (which is fire-and-forget), this AWAITS the worker's reply
// and returns it verbatim — so we can see exactly what happened (a success, or
// the real error message) instead of guessing. That makes it a clean test tool.
//
// Auth: you must be signed in. It uses your browser's login session, so you can
// simply paste the URL into your browser while logged into the app.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const maxDuration = 300; // let the worker round-trip finish (Vercel Pro)

const MAX_IDS = 5; // safety cap while testing

export async function GET(req: NextRequest) {
  // --- Auth: require a signed-in user (browser session cookie) ---
  const authClient = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // --- Worker config (the app already holds these in its environment) ---
  const workerUrl = process.env.FFMPEG_WORKER_URL;
  const workerSecret = process.env.FFMPEG_WORKER_SECRET;
  if (!workerUrl || !workerSecret) {
    return NextResponse.json(
      { error: "FFMPEG_WORKER_URL or FFMPEG_WORKER_SECRET not set" },
      { status: 500 }
    );
  }

  // --- Collect the requested item id(s) ---
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("ids") || searchParams.get("id") || "";
  const ids = idParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Pass ?id=<inspo_item_id> (or ?ids=a,b,c)" },
      { status: 400 }
    );
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Too many ids — limit ${MAX_IDS} at a time while testing` },
      { status: 400 }
    );
  }

  const db = createServiceSupabase();
  const results: Array<Record<string, unknown>> = [];

  for (const id of ids) {
    // Look up the item
    const { data: item, error: itemError } = await db
      .from("inspo_items")
      .select("id, file_url, mime_type, athlete_name, content_type, tech_notes")
      .eq("id", id)
      .single();

    if (itemError || !item) {
      results.push({
        id,
        ok: false,
        error: `Item not found: ${itemError?.message ?? "unknown"}`,
      });
      continue;
    }
    if (!item.file_url) {
      results.push({ id, ok: false, error: "Item has no file_url" });
      continue;
    }
    if (!item.mime_type?.startsWith("video/")) {
      results.push({
        id,
        ok: false,
        error: `Not a video (mime_type: ${item.mime_type ?? "null"})`,
      });
      continue;
    }

    // Hand it to the worker and WAIT for the result
    try {
      const workerRes = await fetch(`${workerUrl}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ffmpeg-secret": workerSecret,
        },
        body: JSON.stringify({
          video_url: item.file_url,
          inspo_item_id: item.id,
          human_tags: {
            athlete_name: item.athlete_name || undefined,
            content_type: item.content_type || undefined,
            tech_notes: item.tech_notes || undefined,
          },
        }),
      });

      const text = await workerRes.text();
      let workerBody: unknown = text;
      try {
        workerBody = JSON.parse(text);
      } catch {
        /* not JSON — keep the raw text so we can still read the error */
      }

      results.push({
        id,
        ok: workerRes.ok,
        worker_status: workerRes.status,
        worker_response: workerBody,
      });
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : "worker call failed",
      });
    }
  }

  return NextResponse.json({ requested: ids.length, results });
}
