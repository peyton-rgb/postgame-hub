// Warm the picker's thumbnails for one campaign.
//
// Supabase caches a transform per EXACT parameter set, and generates it from
// the original on first request. For a campaign like Ghost Amp — 73 photos,
// 447MB of originals, median 4.3MB — that means the first person to open the
// builder waits while 73 full-size images are decoded and resized one by one,
// which reads as broken rather than slow.
//
// This does that work up front. The client fires it on mount and ignores the
// response, so nothing blocks on it; every subsequent view is served from
// Supabase's cache.
//
// It warms BOTH sets, and the second one is the point. There are only two now
// — PICKER 320 for the builder's grid, DISPLAY 1600 for everything the recap
// renders — and DISPLAY is what a client's first view of a finished recap
// asks for. Warming only the builder's own grid left the page cold, which is
// the whole reason the five sets were collapsed to two.
//
// URLs come from pickerThumb() and displayImage() rather than being assembled
// here, because a warmer that builds its own URL warms a cache entry nothing
// reads.
import { NextResponse } from "next/server";
import { createPlainSupabase } from "@/lib/supabase";
import { displayImage, pickerThumb } from "@/components/recap-v2/media";
import type { Media } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Enough to be quick, low enough not to look like an attack on storage. */
const CONCURRENCY = 6;
/** Leave headroom under maxDuration so the response is never the thing killed. */
const TIME_BUDGET_MS = 45_000;

export async function POST(req: Request) {
  let campaignId: string | undefined;
  try {
    campaignId = (await req.json())?.campaignId;
  } catch {
    return NextResponse.json({ error: "expected { campaignId }" }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "expected { campaignId }" }, { status: 400 });
  }

  const supabase = createPlainSupabase();
  const { data: media } = await supabase
    .from("media")
    .select("id, type, file_url, is_video_thumbnail")
    .eq("campaign_id", campaignId);

  const photos = (media || []).filter(
    (m: Partial<Media>) => !m.is_video_thumbnail && m.type === "image" && !!m.file_url,
  );
  // Display first: the grid the person who triggered this is already looking at
  // will fill in on its own, but nothing else pre-warms what a client sees.
  const urls = [
    ...photos.map((m: Partial<Media>) => displayImage(m.file_url)),
    ...photos.map((m: Partial<Media>) => pickerThumb(m.file_url)),
  ].filter(Boolean);

  const started = Date.now();
  let warmed = 0;
  let failed = 0;
  let skipped = 0;

  // pop() takes from the end, so reverse to keep display-first ordering.
  const queue = [...urls].reverse();
  async function worker() {
    for (;;) {
      const url = queue.pop();
      if (!url) return;
      if (Date.now() - started > TIME_BUDGET_MS) {
        skipped += queue.length + 1;
        queue.length = 0;
        return;
      }
      try {
        // A GET is what makes Supabase generate and cache the derivative; a
        // HEAD does not. The body is discarded — only the cache entry matters.
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          await res.arrayBuffer();
          warmed += 1;
        } else {
          // A 400 here is the source-file ceiling. Expected, and the picker
          // shows it per-tile; nothing to retry.
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  return NextResponse.json({
    photos: photos.length,
    total: urls.length,
    warmed,
    failed,
    skipped,
    ms: Date.now() - started,
  });
}
