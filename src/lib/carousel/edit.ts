// Carousel editing rules — ported from the old "Carousel Layout Editor"
// artifact so dragging, resizing, cropping, reframing and snapping feel the
// same. Pure functions: they take the layout + a drag's starting state and
// return the updated layer. No "@/" imports so `node --test` can run them.

import { DUR, H, SLIDE, W, insetOf, mediaBox, visRect, type Layer, type Layout, type MediaInfo } from './layout.ts';

export const N = 5; // slides
export type Media = Record<string, MediaInfo>;
export type Box = { x: number; y: number; w: number; h: number };
type Snap = { d: number; l: number; i: number } | null;
export type Lines = { xs: number[]; ys: number[]; px: number[]; py: number[] };

/** The visible box of a layer on the strip (after crop + seam split). */
export function boxOf(L: Layer): Box {
  const v = visRect(L);
  return { x: L.x + v.x0, y: L.y + v.y0, w: v.x1 - v.x0, h: v.y1 - v.y0 };
}

/** A full-height, at-least-one-slide-wide photo/clip: dragging it slides the picture instead of the box. */
export function isBg(L: Layer, media: Media) {
  const m = media[L.media];
  return L.type !== 'text' && !!m && m.kind !== 'logo' && m.kind !== 'cutout' && L.y <= 0 && L.h >= H && L.w >= SLIDE;
}

export function guidesOf(layout: Layout) {
  const g = layout.guides ?? { v: [], h: [], show: true, lock: false };
  return { v: g.v ?? [], h: g.h ?? [], show: g.show ?? true, lock: !!g.lock };
}

/** Everything a dragged edge can snap to. px/py (slide lines, guides) beat xs/ys (other layers' edges). */
export function snapLines(layout: Layout, skip: Set<string>): Lines {
  const xs: number[] = [], ys = [0, H / 2, H];
  for (let k = 0; k <= N; k++) { xs.push(k * SLIDE); if (k < N) xs.push(k * SLIDE + SLIDE / 2); }
  const px = xs.slice(), py = ys.slice();
  const G = guidesOf(layout);
  if (G.show) { px.push(...G.v); py.push(...G.h); }
  for (const o of layout.layers) {
    if (skip.has(o.id) || o.hidden || o.type === 'text') continue;
    const b = boxOf(o);
    xs.push(b.x, b.x + b.w / 2, b.x + b.w);
    ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { xs, ys, px, py };
}

export function snapVal(vals: number[], lines: number[], th: number): Snap {
  let best: Snap = null;
  vals.forEach((v, i) => lines.forEach((l) => {
    const d = l - v;
    if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, l, i };
  }));
  return best;
}

/** Slide lines first; other layers' edges only if no slide line is close (and with a smaller pull). */
export function snapPri(vals: number[], ln: Lines, axis: 'x' | 'y', th: number, extra: number[] = []): Snap {
  return snapVal(vals, (axis === 'x' ? ln.px : ln.py).concat(extra), th) || snapVal(vals, axis === 'x' ? ln.xs : ln.ys, th * 0.6);
}

/** Where an edge must sit so its gap to the slide edge equals the gap on the opposite side. */
export function mirrorX(fixed: number, moving: 'l' | 'r') {
  if (moving === 'r') { const k = Math.max(0, Math.min(N - 1, Math.floor(fixed / SLIDE))); return (k + 1) * SLIDE - (fixed - k * SLIDE); }
  const k = Math.max(0, Math.min(N - 1, Math.floor((fixed - 1) / SLIDE)));
  return k * SLIDE + ((k + 1) * SLIDE - fixed);
}
export const mirrorY = (fixed: number) => H - fixed;

/** Gaps from a box to each edge of the slide it sits in — the live measurements. */
export function margins(b: Box) {
  const k = Math.max(0, Math.min(N - 1, Math.floor((b.x + b.w / 2) / SLIDE))), s0 = k * SLIDE, s1 = s0 + SLIDE;
  const gl = b.x - s0, gr = s1 - (b.x + b.w), gt = b.y, gb = H - (b.y + b.h);
  const inSlide = gl >= -0.5 && gr >= -0.5;
  return { s0, gl, gr, gt, gb, inSlide, hEq: inSlide && Math.abs(gl - gr) <= 1, vEq: gt >= 0 && gb >= 0 && Math.abs(gt - gb) <= 1 };
}

// ---- photo ↔ its cutout: they magnet back into perfect alignment ----
export function partnersOf(L: Layer, layout: Layout, media: Media) {
  const m = media[L.media];
  if (L.type === 'text' || !m) return [];
  return layout.layers.filter((P) => P.id !== L.id && P.type !== 'text' && !P.hidden && media[P.media] &&
    (m.cutout === P.media || media[P.media].cutout === L.media));
}
export function alignTo(L: Layer, P: Layer): Layer {
  return { ...L, x: P.x, y: P.y, w: P.w, h: P.h, cx: P.cx ?? 0.5, cy: P.cy ?? 0.5, zoom: P.zoom ?? 1 };
}
function pairNear(L: Layer, layout: Layout, media: Media, t: number) {
  let best: { P: Layer; d: number } | null = null;
  for (const P of partnersOf(L, layout, media)) {
    const d = Math.hypot(L.x + L.w / 2 - (P.x + P.w / 2), L.y + L.h / 2 - (P.y + P.h / 2));
    const sizeOk = Math.abs(L.w - P.w) <= Math.max(t, P.w * 0.15) && Math.abs(L.h - P.h) <= Math.max(t, P.h * 0.15);
    if (d <= t && sizeOk && (!best || d < best.d)) best = { P, d };
  }
  return best?.P ?? null;
}

// ---- drags ----
export type Drag =
  | { mode: 'move'; id: string; o: { x: number; y: number } }
  | { mode: 'pan'; id: string; o: { cx: number; cy: number }; mw: number; mh: number }
  | { mode: 'resize'; id: string; corner: string; o: Box; ratio: number }
  | { mode: 'edge'; id: string; edge: 'n' | 's' | 'e' | 'w'; o: { l: number; t: number; r: number; b: number } };

export type DragResult = { layer: Layer; gx: number | null; gy: number | null; paired: boolean };

/** Start a drag on a layer body: background (or Reframe mode, or ⌥) slides the picture, otherwise moves the box. */
export function startBodyDrag(L: Layer, media: Media, frameMode: boolean, alt: boolean): Drag {
  const pan = frameMode ? true : isBg(L, media) ? !alt : alt;
  if (pan) {
    const b = mediaBox(L, media[L.media]);
    return { mode: 'pan', id: L.id, o: { cx: L.cx ?? 0.5, cy: L.cy ?? 0.5 }, mw: b.mw, mh: b.mh };
  }
  return { mode: 'move', id: L.id, o: { x: L.x, y: L.y } };
}

/**
 * Apply a drag. dx/dy are in strip pixels; scale is the on-screen zoom, so snapping
 * distances feel the same at any zoom (12 screen pixels, as in the artifact).
 */
export function applyDrag(
  drag: Drag, layout: Layout, media: Media, dx: number, dy: number,
  opt: { scale: number; snap: boolean; shift?: boolean },
): DragResult | null {
  const cur = layout.layers.find((l) => l.id === drag.id);
  if (!cur) return null;
  let L: Layer = { ...cur };
  const th = 12 / opt.scale;
  let gx: number | null = null, gy: number | null = null, paired = false;

  if (drag.mode === 'edge') {
    const o = drag.o, ed = drag.edge, I = { ...o }, MIN = 30;
    if (ed === 'w') I.l = o.l + dx; if (ed === 'e') I.r = o.r - dx; if (ed === 'n') I.t = o.t + dy; if (ed === 's') I.b = o.b - dy;
    if (opt.snap) {
      const ln = snapLines(layout, new Set([L.id]));
      if (ed === 'w' || ed === 'e') {
        const pos = ed === 'w' ? L.x + I.l : L.x + L.w - I.r;
        const mir = ed === 'w' ? mirrorX(L.x + L.w - I.r, 'l') : mirrorX(L.x + I.l, 'r');
        const sx = snapPri([pos], ln, 'x', th, [mir]);
        if (sx) { if (ed === 'w') I.l += sx.d; else I.r -= sx.d; gx = sx.l; }
      } else {
        const pos = ed === 'n' ? L.y + I.t : L.y + L.h - I.b;
        const mir = ed === 'n' ? mirrorY(L.y + L.h - I.b) : mirrorY(L.y + I.t);
        const sy = snapPri([pos], ln, 'y', th, [mir]);
        if (sy) { if (ed === 'n') I.t += sy.d; else I.b -= sy.d; gy = sy.l; }
      }
    }
    I.l = Math.max(0, Math.min(I.l, L.w - I.r - MIN)); I.r = Math.max(0, Math.min(I.r, L.w - I.l - MIN));
    I.t = Math.max(0, Math.min(I.t, L.h - I.b - MIN)); I.b = Math.max(0, Math.min(I.b, L.h - I.t - MIN));
    L.inset = { l: Math.round(I.l), t: Math.round(I.t), r: Math.round(I.r), b: Math.round(I.b) };
    return { layer: L, gx, gy, paired };
  }

  if (drag.mode === 'move') {
    let nx = Math.round(drag.o.x + dx), ny = Math.round(drag.o.y + dy);
    if (opt.snap) {
      const ln = snapLines(layout, new Set([L.id]));
      const v = visRect(L);
      const sx = snapPri([nx + v.x0, nx + (v.x0 + v.x1) / 2, nx + v.x1], ln, 'x', th); if (sx) { nx += sx.d; gx = sx.l; }
      const sy = snapPri([ny + v.y0, ny + (v.y0 + v.y1) / 2, ny + v.y1], ln, 'y', th); if (sy) { ny += sy.d; gy = sy.l; }
    }
    L.x = Math.round(nx); L.y = Math.round(ny);
    if (opt.snap) {
      const P = pairNear(L, layout, media, 48 / opt.scale);
      if (P) { L = alignTo(L, P); gx = P.x; gy = P.y; paired = true; }
    }
    return { layer: L, gx, gy, paired };
  }

  if (drag.mode === 'pan') {
    L.cx = Math.max(0, Math.min(1, drag.o.cx - dx / drag.mw));
    L.cy = Math.max(0, Math.min(1, drag.o.cy - dy / drag.mh));
    if (opt.snap) {
      const P = partnersOf(L, layout, media).find((P) => P.x === L.x && P.y === L.y && P.w === L.w && P.h === L.h &&
        Math.abs((P.zoom ?? 1) - (L.zoom ?? 1)) < 0.02 &&
        Math.abs(((P.cx ?? 0.5) - (L.cx ?? 0.5)) * drag.mw) <= 40 / opt.scale &&
        Math.abs(((P.cy ?? 0.5) - (L.cy ?? 0.5)) * drag.mh) <= 40 / opt.scale);
      if (P) { L.cx = P.cx ?? 0.5; L.cy = P.cy ?? 0.5; paired = true; }
    }
    return { layer: L, gx, gy, paired };
  }

  // resize from a corner
  const o = drag.o, c = drag.corner;
  let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
  if (c.includes('w')) x1 += dx; else x2 += dx;
  if (c.includes('n')) y1 += dy; else y2 += dy;
  if (opt.snap) {
    const ln = snapLines(layout, new Set([L.id]));
    const I = insetOf(L);
    const mx = c.includes('w') ? mirrorX(x2 - I.r, 'l') : mirrorX(x1 + I.l, 'r');
    const my = c.includes('n') ? mirrorY(y2 - I.b) : mirrorY(y1 + I.t);
    const sx = snapPri([c.includes('w') ? x1 + I.l : x2 - I.r], ln, 'x', th, [mx]); if (sx) { if (c.includes('w')) x1 += sx.d; else x2 += sx.d; gx = sx.l; }
    const sy = snapPri([c.includes('n') ? y1 + I.t : y2 - I.b], ln, 'y', th, [my]); if (sy) { if (c.includes('n')) y1 += sy.d; else y2 += sy.d; gy = sy.l; }
  }
  let w = Math.max(40, x2 - x1), h = Math.max(40, y2 - y1);
  const keep = opt.shift || media[L.media]?.kind === 'logo';
  if (keep) { if (w / h > drag.ratio) w = h * drag.ratio; else h = w / drag.ratio; gx = gy = null; }
  L.w = Math.round(w); L.h = Math.round(h);
  L.x = Math.round(c.includes('w') ? o.x + o.w - L.w : o.x);
  L.y = Math.round(c.includes('n') ? o.y + o.h - L.h : o.y);
  if (opt.snap) {
    const t = 30 / opt.scale;
    const P = partnersOf(L, layout, media).find((P) => Math.abs(L.x - P.x) <= t && Math.abs(L.y - P.y) <= t &&
      Math.abs(L.x + L.w - P.x - P.w) <= t && Math.abs(L.y + L.h - P.y - P.h) <= t);
    if (P) { L = alignTo(L, P); gx = c.includes('w') ? P.x : P.x + P.w; gy = c.includes('n') ? P.y : P.y + P.h; paired = true; }
  }
  return { layer: L, gx, gy, paired };
}

// ---- panel actions ----
const rid = () => Math.random().toString(36).slice(2, 7);
export type Action = 'front' | 'bottom' | 'fwd' | 'back' | 'dup' | 'del' | 'fill' | 'fillstrip' | 'uncrop';

/** Returns the new layout and which layer should be selected afterwards. */
export function act(layout: Layout, id: string, a: Action): { layout: Layout; select: string | null } {
  const arr = layout.layers.slice();
  const i = arr.findIndex((l) => l.id === id);
  if (i < 0) return { layout, select: null };
  const L = arr[i];
  let select: string | null = id;
  if (a === 'front') { arr.splice(i, 1); arr.push(L); }
  if (a === 'bottom') { arr.splice(i, 1); arr.unshift(L); }
  if (a === 'fwd' && i < arr.length - 1) { arr.splice(i, 1); arr.splice(i + 1, 0, L); }
  if (a === 'back' && i > 0) { arr.splice(i, 1); arr.splice(i - 1, 0, L); }
  if (a === 'dup') {
    const c: Layer = { ...structuredClone(L), id: `${L.id}_${rid()}`, name: `${L.name ?? 'Layer'} copy`, x: L.x + 40, y: L.y + 40, locked: false };
    arr.splice(i + 1, 0, c); select = c.id;
  }
  if (a === 'del') { arr.splice(i, 1); select = null; }
  if (a === 'uncrop') { const c = { ...L }; delete c.inset; arr[i] = c; }
  if (a === 'fill' || a === 'fillstrip') {
    const k = Math.max(0, Math.min(N - 1, Math.floor((L.x + L.w / 2) / SLIDE)));
    arr[i] = a === 'fill' ? { ...L, x: k * SLIDE, w: SLIDE, y: 0, h: H } : { ...L, x: 0, w: W, y: 0, h: H };
  }
  return { layout: { ...layout, layers: arr }, select };
}

// ---- clip section (which part of a long clip plays in the 6s loop) ----

/** Clamp a section to 1–6s inside the clip, snapped to 1/24s frames (as the artifact did). */
export function setSection(dur: number, a: number, len: number) {
  len = Math.max(1, Math.min(DUR, len, dur));
  a = Math.max(0, Math.min(dur - len, a));
  return { vin: Math.round(a * 24) / 24, vlen: Math.round(len * 24) / 24 };
}
/** The zoomed timeline shows 24s around the section. */
export function zoomRange(dur: number, vin: number, vlen: number): [number, number] {
  const span = Math.min(dur, 24), mid = vin + vlen / 2;
  const a = Math.max(0, Math.min(dur - span, mid - span / 2));
  return [a, a + span];
}
export const fmtT = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

// ---- adding a new card (from the picker) ----
export function newCard(layout: Layout, key: string, m: MediaInfo, label: string, slide: number): { layout: Layout; id: string } {
  const r = m.w / m.h;
  let w: number, h: number;
  if (r >= 1) { w = 680; h = Math.round(680 / r); } else { h = 820; w = Math.round(820 * r); }
  const cx = slide * SLIDE + SLIDE / 2, cy = H / 2;
  const id = `card_${rid()}`;
  const L: Layer = {
    id, name: label, media: key, x: Math.round(cx - w / 2), y: Math.round(Math.max(40, Math.min(H - h - 40, cy - h / 2))), w, h,
    cx: 0.5, cy: 0.5, zoom: 1, bw: false, bright: 1, contrast: 1, sat: 1, blur: 0, shadow: true,
  };
  // in front of the cards, under logos
  const arr = layout.layers.slice();
  const top = arr.findIndex((o) => o.type === 'text' || o.media === 'logo_white' || o.media?.startsWith('logo'));
  if (top < 0) arr.push(L); else arr.splice(top, 0, L);
  return { layout: { ...layout, layers: arr }, id };
}
