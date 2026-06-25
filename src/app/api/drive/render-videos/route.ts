// src/app/api/drive/render-videos/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/render-videos
// Body: { athleteName, videoUrl, overlays: [{ spec, pngBase64 }] }
//
// Kicks off a "Video w/ graphic" render: writes a pending video_render_jobs row,
// then fires the FFmpeg worker's /composite FIRE-AND-FORGET (intake pattern — the
// worker does the work synchronously inside its request, then calls our callback).
// Returns the jobId immediately; the tool polls /api/drive/render-status.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const authClient = createServerSupabase();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteName, videoUrl, overlays } = body;
    if (!athleteName || !videoUrl || !Array.isArray(overlays) || overlays.length === 0) {
      return NextResponse.json(
        { error: "athleteName, videoUrl and a non-empty overlays[] are required" },
        { status: 400 }
      );
    }
    for (const o of overlays) {
      if (!o || !o.spec || !o.pngBase64) {
        return NextResponse.json({ error: "each overlay needs spec + pngBase64" }, { status: 400 });
      }
    }

    const workerUrl = process.env.FFMPEG_WORKER_URL;
    const workerSecret = process.env.FFMPEG_WORKER_SECRET;
    if (!workerUrl || !workerSecret) {
      return NextResponse.json({ error: "FFMPEG worker not configured" }, { status: 500 });
    }

    // 1. Pending job row (service role — RLS is staff-only).
    const supabase = createServiceSupabase();
    const { data: job, error: insErr } = await supabase
      .from("video_render_jobs")
      .insert({ athlete_name: String(athleteName).trim(), status: "pending", links: {} })
      .select("id")
      .single();
    if (insErr || !job) {
      return NextResponse.json({ error: "Failed to create job: " + (insErr?.message || "unknown") }, { status: 500 });
    }

    // 2. Upload each overlay PNG to Supabase Storage and forward only URLs to the
    //    worker — keeps the fire-and-forget body tiny so it flushes before Vercel
    //    freezes the function (the fat base64 body never sent → job stuck pending).
    const workerOverlays: { spec: string; overlayUrl: string }[] = [];
    for (const o of overlays) {
      const b64 = String(o.pngBase64).replace(/^data:image\/\w+;base64,/, "");
      const objectPath = `_overlays/${job.id}_${o.spec}.png`;
      const { error: upErr } = await supabase.storage
        .from("campaign-media")
        .upload(objectPath, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: true });
      if (upErr) {
        await supabase.from("video_render_jobs").update({ status: "failed", error: "overlay upload: " + upErr.message }).eq("id", job.id);
        return NextResponse.json({ error: "Overlay upload failed: " + upErr.message }, { status: 500 });
      }
      const { data: pub } = supabase.storage.from("campaign-media").getPublicUrl(objectPath);
      workerOverlays.push({ spec: o.spec, overlayUrl: pub.publicUrl });
    }

    // 3. Fire the worker fire-and-forget — now a tiny URL body. It downloads each
    //    overlay, composites + uploads to Drive, then POSTs results to our callback.
    const callbackUrl = `${request.nextUrl.origin}/api/drive/render-callback`;
    fetch(`${workerUrl}/composite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ffmpeg-secret": workerSecret },
      body: JSON.stringify({
        athleteName: String(athleteName).trim(),
        videoUrl,
        overlays: workerOverlays,
        callbackUrl,
        jobId: job.id,
      }),
    }).catch((e) => console.error("[render-videos] worker fire failed:", e?.message));

    return NextResponse.json({ jobId: job.id, status: "pending" });
  } catch (error: any) {
    console.error("[render-videos] Error:", error);
    return NextResponse.json({ error: error?.message || "render-videos failed" }, { status: 500 });
  }
}
