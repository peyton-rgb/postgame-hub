// Timeline of the carousel preview video: the athlete's Instagram profile,
// the post opening, then a swipe through every slide.
// A slide stays on screen until every clip on it has played once, all the way
// through — the swipe never cuts a clip short (Peyton, Nov 11 2026).
// No "@/" imports: `node --test` runs this file directly.

import { SLIDE, vlenOf, type Layer, type MediaInfo } from './layout.ts';

export const PREVIEW = {
  profile: 2.2,  // seconds on the profile screen
  push: 0.35,    // post slides in over the profile
  first: 2.05,   // slide 1 holds at least this long after the push
  swipe: 0.4,    // one swipe between slides
  hold: 2.2,     // each later slide holds at least this long
  tail: 0.3,     // a beat on a clip's last frame before the next swipe
} as const;

/** `starts[k-1]` = when slide k (1-based) starts arriving — slide 1 with the push,
 *  later slides when their swipe begins. Its clips start from the top at that moment.
 *  `len` = the whole video. */
export type PreviewPlan = { starts: number[]; len: number };

const need = (clip?: number) => (clip && clip > 0 ? clip + PREVIEW.tail : 0);

/** Lay out the video. `clips[k-1]` is the length in seconds of the longest clip on
 *  slide k (0 or missing = no video there). Each slide stays for its longest clip
 *  plus a beat, and never less than the standard hold (so photo slides are unchanged). */
export function previewPlan(slides: number, clips: number[] = []): PreviewPlan {
  const n = Math.max(1, slides);
  const starts = [PREVIEW.profile as number];
  let end = PREVIEW.profile + Math.max(PREVIEW.push + PREVIEW.first, need(clips[0]));
  for (let k = 2; k <= n; k++) {
    starts.push(end);
    end += Math.max(PREVIEW.swipe + PREVIEW.hold, need(clips[k - 1]));
  }
  return { starts, len: end };
}

/** Total length for a carousel of `slides` slides (with `clips` as in previewPlan). */
export function previewLength(slides: number, clips: number[] = []) {
  return previewPlan(slides, clips).len;
}

/** Which slide (1-based) a layer belongs to: the one its centre sits on. */
export function slideOf(L: Pick<Layer, 'x' | 'w'>, slides: number) {
  return Math.min(Math.max(1, slides), Math.max(1, Math.floor((L.x + L.w / 2) / SLIDE) + 1));
}

/** The longest clip on each slide, in seconds — what previewPlan needs. Hidden layers,
 *  text, photos and clips with nothing to play don't count. */
export function slideClips(layers: Layer[], media: Record<string, (MediaInfo & { src?: string | null }) | undefined>, slides: number) {
  const out: number[] = Array.from({ length: Math.max(1, slides) }, () => 0);
  for (const L of layers) {
    if (L.hidden || L.type === 'text') continue;
    const m = media[L.media];
    if (!m || m.kind !== 'video' || !m.src) continue;
    const k = slideOf(L, slides) - 1;
    out[k] = Math.max(out[k], vlenOf(L, m));
  }
  return out;
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export type PreviewState = {
  /** 0 = profile only, 1 = post fully in; in between = the push. */
  push: number;
  /** Which slide is showing; fractional mid-swipe (1.5 = halfway from slide 2 to 3, 0-based). */
  offset: number;
  /** Slide number the counter shows (1-based). */
  shown: number;
};

export function previewState(t: number, plan: PreviewPlan): PreviewState {
  const n = plan.starts.length;
  const p0 = PREVIEW.profile, p1 = p0 + PREVIEW.push;
  const push = t <= p0 ? 0 : t >= p1 ? 1 : ease((t - p0) / PREVIEW.push);
  let offset = 0;
  for (let k = 2; k <= n; k++) {
    const at = plan.starts[k - 1];
    if (t < at) break;
    const into = (t - at) / PREVIEW.swipe;
    if (into < 1) { offset = k - 2 + ease(into); break; }
    offset = k - 1;
  }
  return { push, offset, shown: Math.min(n, Math.round(offset) + 1) };
}

/** When slide `k` (1-based) starts coming on screen: slide 1 with the push
 *  (on the profile grid it is a still tile, as on Instagram), later slides
 *  when their swipe begins. */
export function slideStart(k: number, plan: PreviewPlan) {
  return plan.starts[Math.min(plan.starts.length, Math.max(1, k)) - 1];
}

/** Where a clip on slide `k` should be at preview time `t`. Like Instagram,
 *  each slide's video starts from the top when it arrives — never on a shared
 *  clock that loops mid-slide. Before arrival it waits on its first frame;
 *  past its length it holds the last frame rather than jumping back. */
export function clipAt(t: number, k: number, vlen: number, plan: PreviewPlan) {
  const local = t - slideStart(k, plan);
  if (local <= 0) return { at: 0, playing: false };
  const end = Math.max(0, vlen - 1 / 30);
  return local >= end ? { at: end, playing: false } : { at: local, playing: true };
}
