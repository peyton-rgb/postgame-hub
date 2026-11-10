// Timeline of the carousel preview video: the athlete's Instagram profile,
// the post opening, then a swipe through every slide.
// No "@/" imports: `node --test` runs this file directly.

export const PREVIEW = {
  profile: 2.2,  // seconds on the profile screen
  push: 0.35,    // post slides in over the profile
  first: 2.05,   // slide 1 holds after the push
  swipe: 0.4,    // one swipe between slides
  hold: 2.2,     // each later slide holds
} as const;

/** Total length for a carousel of `slides` slides. */
export function previewLength(slides: number) {
  const n = Math.max(1, slides);
  return PREVIEW.profile + PREVIEW.push + PREVIEW.first + (n - 1) * (PREVIEW.swipe + PREVIEW.hold);
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

export function previewState(t: number, slides: number): PreviewState {
  const n = Math.max(1, slides);
  const p0 = PREVIEW.profile, p1 = p0 + PREVIEW.push;
  const push = t <= p0 ? 0 : t >= p1 ? 1 : ease((t - p0) / PREVIEW.push);
  let offset = 0;
  let at = p1 + PREVIEW.first;
  for (let k = 1; k < n; k++) {
    if (t < at) break;
    const into = (t - at) / PREVIEW.swipe;
    if (into < 1) { offset = k - 1 + ease(into); break; }
    offset = k;
    at += PREVIEW.swipe + PREVIEW.hold;
  }
  return { push, offset, shown: Math.min(n, Math.round(offset) + 1) };
}

/** When slide `k` (1-based) starts coming on screen: slide 1 with the push
 *  (on the profile grid it is a still tile, as on Instagram), later slides
 *  when their swipe begins. */
export function slideStart(k: number) {
  if (k <= 1) return PREVIEW.profile;
  return PREVIEW.profile + PREVIEW.push + PREVIEW.first + (k - 2) * (PREVIEW.swipe + PREVIEW.hold);
}

/** Where a clip on slide `k` should be at preview time `t`. Like Instagram,
 *  each slide's video starts from the top when it arrives — never on a shared
 *  clock that loops mid-slide. Before arrival it waits on its first frame;
 *  past its length it holds the last frame rather than jumping back. */
export function clipAt(t: number, k: number, vlen: number) {
  const local = t - slideStart(k);
  if (local <= 0) return { at: 0, playing: false };
  const end = Math.max(0, vlen - 1 / 30);
  return local >= end ? { at: end, playing: false } : { at: local, playing: true };
}
