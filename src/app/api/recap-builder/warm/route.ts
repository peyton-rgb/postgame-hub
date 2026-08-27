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
// It warms the PICKER set only. The hero-preview set is needed for at most four
// images and warms itself the moment one is selected, so paying for 73 of them
// here would be waste.
//
// URLs come from pickerThumb() rather than being assembled here, because a
// warmer that builds its own URL warms a cache entry nothing reads.
import { NextResponse } from "next/server";
import { createPlainSupabase } from "@/lib/supabase";
import { pickerThumb } from "@/components/recap-v2/media";
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

  const urls = (media || [])
    .filter((m: Partial<Media>) => !m.is_video_thumbnail && m.type === "image" && !!m.file_url)
    .map((m: Partial<Media>) => pickerThumb(m.file_url))
    .filter(Boolean);

  const started = Date.now();
  let warmed = 0;
  let failed = 0;
  let skipped = 0;

  const queue = [...urls];
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
    total: urls.length,
    warmed,
    failed,
    skipped,
    ms: Date.now() - started,
  });
}
