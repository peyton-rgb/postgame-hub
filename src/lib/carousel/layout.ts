// Carousel layout geometry — a faithful port of the rules in the old
// "Carousel Layout Editor" artifact, so saved layouts draw identically.
// No "@/" imports: `node --test` runs this file directly.

export const W = 5400; // full carousel width (5 slides)
export const H = 1350; // slide height (IG 4:5)
export const SLIDE = 1080; // one slide's width
export const DUR = 6; // the loop every clip plays inside, in seconds

export type Layer = {
  id: string;
  name?: string;
  type?: 'text';
  media: string;
  x: number; y: number; w: number; h: number;
  cx?: number; cy?: number; zoom?: number;
  inset?: { l?: number; t?: number; r?: number; b?: number };
  clip?: '' | 'left' | 'right';
  bright?: number; contrast?: number; sat?: number; bw?: boolean; blur?: number;
  shadow?: boolean; hidden?: boolean; locked?: boolean; pop?: boolean;
  vin?: number; vlen?: number;
};
export type Layout = {
  canvas: { w: number; h: number; slides: number; duration: number; border?: unknown };
  guides?: { h: number[]; v: number[]; show?: boolean; lock?: boolean };
  layers: Layer[];
};
export type MediaInfo = {
  kind: 'video' | 'image' | 'cutout' | 'logo';
  w: number; h: number;
  label?: string; dur?: number; in0?: number; cutout?: string; pop?: string;
};

/** The part of the slide strip a cropped-edge seam layer keeps. */
export function clipRange(L: Layer): [number, number] {
  if (L.clip !== 'left' && L.clip !== 'right') return [0, L.w];
  const seam = Math.round((L.x + L.w / 2) / SLIDE) * SLIDE;
  const cut = Math.min(Math.max(seam - L.x, 0), L.w);
  return L.clip === 'left' ? [0, cut] : [cut, L.w];
}

export function insetOf(L: Layer) {
  const i = L.inset ?? {};
  return { l: i.l ?? 0, t: i.t ?? 0, r: i.r ?? 0, b: i.b ?? 0 };
}

/** Visible part of a layer, in its own pixels: seam split + cropped edges. */
export function visRect(L: Layer) {
  const cr = clipRange(L), I = insetOf(L);
  const x0 = Math.max(cr[0], Math.round(I.l)), x1 = Math.min(cr[1], L.w - Math.round(I.r));
  const y0 = Math.round(I.t), y1 = L.h - Math.round(I.b);
  return { x0, y0, x1: Math.max(x0 + 2, x1), y1: Math.max(y0 + 2, y1) };
}

/** Where the photo/clip sits inside its frame: cover-fit, zoomed, panned by cx/cy, never leaving a gap. */
export function mediaBox(L: Layer, m: Pick<MediaInfo, 'w' | 'h'>) {
  const cover = Math.max(L.w / m.w, L.h / m.h) * Math.max(1, L.zoom ?? 1);
  const mw = m.w * cover, mh = m.h * cover;
  const left = Math.min(0, Math.max(L.w - mw, L.w / 2 - (L.cx ?? 0.5) * mw));
  const top = Math.min(0, Math.max(L.h - mh, L.h / 2 - (L.cy ?? 0.5) * mh));
  return { mw, mh, left, top };
}

export function popOn(L: Layer, m?: MediaInfo) {
  return !!(L.bw && m?.pop && L.pop !== false);
}

export function filterOf(L: Layer, m?: MediaInfo) {
  if (m?.kind === 'logo') return 'none';
  const sat = popOn(L, m) ? (L.sat ?? 1) : L.bw ? 0 : (L.sat ?? 1);
  const cutShadow = m?.kind === 'cutout' && L.shadow ? ' drop-shadow(8px 14px 16px rgba(0,0,0,.55))' : '';
  return (
    `brightness(${L.bright ?? 1}) contrast(${L.contrast ?? 1}) saturate(${sat})` +
    ((L.blur ?? 0) > 0 ? ` blur(${L.blur}px)` : '') +
    cutShadow
  );
}

export function vinOf(L: Layer, m?: MediaInfo) {
  return L.vin ?? m?.in0 ?? 0;
}
export function vlenOf(L: Layer, m?: MediaInfo) {
  return Math.max(0.5, Math.min(DUR, L.vlen ?? DUR, m?.dur ? m.dur - vinOf(L, m) : DUR));
}
/** Where a clip should be at loop time t — every clip shares one 6-second clock. */
export function clipTime(L: Layer, m: MediaInfo | undefined, t: number, hasFull: boolean, elementDuration?: number) {
  if (hasFull) return vinOf(L, m) + (t % vlenOf(L, m));
  return t % (elementDuration || DUR);
}

/** Box + media placement for one layer, ready for absolute positioning. */
export function placeLayer(L: Layer, m: MediaInfo) {
  const v = visRect(L), b = mediaBox(L, m);
  return {
    frame: { left: L.x + v.x0, top: L.y + v.y0, width: v.x1 - v.x0, height: v.y1 - v.y0 },
    media: { left: b.left - v.x0, top: b.top - v.y0, width: b.mw, height: b.mh },
    shadowBox: !!L.shadow && m.kind !== 'cutout',
    filter: filterOf(L, m),
  };
}
