// ============================================================
// hero-render — small helpers for the vertical-hero picker flow.
//
// Lives client-side. Three things:
//
//   isVertical(resolution)      — orientation check from media.resolution text
//   probeVideoDimensions(url)   — client-side fallback when no media row exists
//                                 (Upload/URL pick paths in CampaignMediaPicker)
//   requestHeroRender(...)      — POST to /api/heroes/render (server-side proxy
//                                 to the Fly worker) and await the rendered_url
// ============================================================

export interface VideoDimensions {
  w: number;
  h: number;
}

/** Parse a media.resolution text like "1080x1920" into width/height. */
export function parseResolution(resolution: string | undefined | null): VideoDimensions | null {
  if (!resolution) return null;
  const m = resolution.match(/^(\d+)x(\d+)$/);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!w || !h) return null;
  return { w, h };
}

/** True iff the clip is taller than it is wide. Square (h === w) counts as horizontal. */
export function isVertical(dim: VideoDimensions | null): boolean {
  return !!dim && dim.h > dim.w;
}

/**
 * Load a video URL just far enough to read videoWidth/videoHeight, then dispose.
 * Used when the picked file isn't a row in the media table (Upload/URL paths) so
 * media.resolution isn't available.
 */
export function probeVideoDimensions(url: string, timeoutMs = 8000): Promise<VideoDimensions> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    let done = false;
    const cleanup = () => {
      video.removeAttribute("src");
      try { video.load(); } catch { /* noop */ }
    };
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      cleanup();
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error("video metadata probe timed out"))),
      timeoutMs,
    );
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const w = video.videoWidth;
      const h = video.videoHeight;
      finish(() => (w && h ? resolve({ w, h }) : reject(new Error("video has no dimensions"))));
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish(() => reject(new Error("video failed to load for probe")));
    };
    video.src = url;
  });
}

export type HeroLook = "blur" | "mirror";

export interface HeroRenderRequest {
  /** media.id when available; else a stable hash of the file URL (handled server-side). */
  mediaId: string;
  /** Public URL the worker should download and re-render. */
  sourceUrl: string;
  look: HeroLook;
}

export interface HeroRenderResult {
  rendered_url: string;
  cached: boolean;
  render_ms?: number;
}

/**
 * Pick the URL to actually play for a hero placement.
 * Centralized so all three website surfaces apply the same rule.
 *
 *   hero_source='rendered' + hero_rendered_url set  → play the widescreen render
 *   otherwise                                        → fall back to file_url
 *
 * Tolerates missing/loose typing so it works with the `(any)` casts in the
 * page-level Supabase queries.
 */
export function resolveHeroPlaybackUrl(row: {
  file_url?: string | null;
  hero_source?: string | null;
  hero_rendered_url?: string | null;
}): string | null {
  if (!row.file_url) return null;
  if (row.hero_source === 'rendered' && row.hero_rendered_url) {
    return row.hero_rendered_url;
  }
  return row.file_url;
}

/**
 * Ask the hub to render (or fetch the cached) widescreen version of a vertical clip.
 * Server-side route proxies to the Fly worker so the FFMPEG_WORKER_SECRET stays
 * out of the browser. Synchronous: returns instantly on cache hit, ~80s on miss.
 */
export async function requestHeroRender(req: HeroRenderRequest): Promise<HeroRenderResult> {
  const res = await fetch("/api/heroes/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `hero render failed (HTTP ${res.status})`);
  }
  return body as HeroRenderResult;
}
