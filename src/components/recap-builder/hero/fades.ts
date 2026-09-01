// ============================================================
// Recap Builder — hero geometry and edge blend
//
// EVERY NUMBER IN THIS FILE IS LAW. It is copied literally from
// builder-03-hero-v11.html, the frozen prototype that
// claude_RECAP-BUILDER-HERO-SPEC.md designates as the source of
// truth. The fade stops, the slider floor, the 2px inset, the
// whole-pixel box width and the webp transformer params are all
// battle-tested against a real HDR display. Do not simplify,
// round, re-derive, or "clean up" any of it.
//
// Why the construction is what it is (spec §1 and §4):
//   • format=webp is mandatory. The athlete photos are iPhone
//     HDR shots with gain maps; without the re-encode, Chrome
//     renders them brighter than SDR black can composite
//     against and every scrim visually fails. CSS filter and
//     dynamic-range-limit workarounds were tried and rejected.
//   • Never call the transformer with width only — it keeps
//     height and distorts. Always width + height + resize.
//   • Fades are plain black gradients spanning the WHOLE box
//     with the transparent tail inside the stops. Sized-to-zone
//     elements seam at their edge; CSS masks and mask-composite
//     are unsupported / seam on the target browser.
//   • Box width is set in whole pixels — a fractional % edge
//     glints.
//   • The slider floor a = 0.45 + (slider/100)·0.55 means the
//     minimum blend is a tighter fade, never a hard edge.
// ============================================================

export type Frame = { x: number; y: number; z: number; s: number; f: number };

/** Default framing for a newly selected slot — the prototype's values. */
export const DEFAULT_FRAME: Frame = { x: 50, y: 40, z: 100, s: 100, f: 70 };

/** Framing used when nothing is selected and the fallback photo is shown. */
export const FALLBACK_FRAME: Frame = { x: 50, y: 40, z: 100, s: 100, f: 60 };

const B = '#07070A';

/** Supabase transformer URLs. Width AND height AND resize, always webp. */
export const thumbUrl = (u: string): string =>
  u.replace('/object/public/', '/render/image/public/') +
  '?width=520&height=520&resize=contain&quality=78&format=webp';

export const heroUrl = (u: string): string =>
  u.replace('/object/public/', '/render/image/public/') +
  '?width=1600&height=1600&resize=contain&quality=82&format=webp';

/** Ratio badge label. Verbatim from the prototype. */
export function ratioLabel(r: number): string {
  if (r < 0.9) return r < 0.62 ? '9:16' : '3:4';
  if (r <= 1.15) return '1:1';
  return r > 1.55 ? '16:9' : '3:2';
}

/** The slider floor. Edges are never hard. */
export const alphaOf = (f: Frame): number => 0.45 + (f.f / 100) * 0.55;

/** Side mode covers squares and verticals; landscape is full-bleed. */
export const isSide = (r: number): boolean => r <= 1.15;
export const isSquare = (r: number): boolean => r > 0.9 && r <= 1.15;

export type SideGeometry = {
  widthPx: number;
  heightPct: string;
  topPct: string;
};

/**
 * Box geometry for side mode. `heroHeight`, `heroTop` and `pageHeight` are
 * measured off the live preview, exactly as the prototype reads them from
 * the DOM — the box takes the photo's natural height at its width so
 * nothing is cut at Zoom 1.0, capped at the page bottom minus 6px so the
 * bottom fade always completes on-page.
 */
export function sideGeometry(
  r: number,
  frame: Frame,
  device: 'desktop' | 'mobile',
  heroHeight: number,
  heroTop: number,
  pageHeight: number,
): SideGeometry {
  const fs = (frame.s || 100) / 100;
  const baseW = r < 0.62 ? 48 : r <= 0.9 ? 58 : 68;
  const pageWpx = device === 'desktop' ? 1280 : 390;
  // Whole pixels — a fractional edge glints.
  const wpx = Math.round((pageWpx * Math.min(88, Math.max(24, baseW * fs))) / 100);

  const naturalPct = ((wpx / r) / heroHeight) * 100;
  const availPct = ((pageHeight - heroTop - 6) / heroHeight) * 100;

  return {
    widthPx: wpx,
    heightPct: Math.min(availPct, Math.max(60, naturalPct)).toFixed(1) + '%',
    topPct: naturalPct < 100 ? ((100 - Math.min(100, naturalPct)) / 2).toFixed(1) + '%' : '0',
  };
}

export type FadeSet = { left: string; top: string; bottom: string; blend: string };

/** Side-mode fades: long eased left, plus top and bottom. */
export function sideFades(a: number, square: boolean): FadeSet {
  const k = 36 + a * 44; // left fade zone: 36–80% of the box
  const v = 16 + a * 12;
  const vb = square ? 20 + a * 10 : 28 + a * 12;

  return {
    left:
      `linear-gradient(90deg, ${B} 0%, ${B} ${Math.max(11, k * 0.26).toFixed(1)}%, ` +
      `rgba(7,7,10,.97) ${(k * 0.4).toFixed(1)}%, rgba(7,7,10,.86) ${(k * 0.55).toFixed(1)}%, ` +
      `rgba(7,7,10,.62) ${(k * 0.7).toFixed(1)}%, rgba(7,7,10,.34) ${(k * 0.84).toFixed(1)}%, ` +
      `rgba(7,7,10,.12) ${(k * 0.94).toFixed(1)}%, rgba(7,7,10,0) ${Math.min(100, k * 1.1).toFixed(1)}%, ` +
      `rgba(7,7,10,0) 100%)`,
    top:
      `linear-gradient(180deg, ${B} 0%, rgba(7,7,10,.75) ${(v * 0.3).toFixed(1)}%, ` +
      `rgba(7,7,10,.42) ${(v * 0.6).toFixed(1)}%, rgba(7,7,10,.16) ${(v * 0.84).toFixed(1)}%, ` +
      `rgba(7,7,10,0) ${(v * 1.15).toFixed(1)}%, rgba(7,7,10,0) 100%)`,
    bottom:
      `linear-gradient(0deg, ${B} 0%, ${B} ${(vb * 0.05).toFixed(1)}%, ` +
      `rgba(7,7,10,.8) ${(vb * 0.28).toFixed(1)}%, rgba(7,7,10,.5) ${(vb * 0.55).toFixed(1)}%, ` +
      `rgba(7,7,10,.22) ${(vb * 0.8).toFixed(1)}%, rgba(7,7,10,0) ${(vb * 1.1).toFixed(1)}%, ` +
      `rgba(7,7,10,0) 100%)`,
    // Soft wash across the fade zone so bright content eases out.
    blend:
      `linear-gradient(90deg, rgba(7,7,10,.55) 0%, rgba(7,7,10,.28) ${(k * 0.45).toFixed(0)}%, ` +
      `rgba(7,7,10,0) ${(k * 0.95).toFixed(0)}%),` +
      `linear-gradient(180deg, rgba(7,7,10,.5) 0%, rgba(7,7,10,0) ${(v * 1.6).toFixed(0)}%)`,
  };
}

/** Full-bleed fades: no left fade, shallower top and bottom. */
export function bleedFades(a: number): FadeSet {
  const v2 = 10 + a * 8;
  const vb2 = 16 + a * 10;

  return {
    left: 'none',
    top:
      `linear-gradient(180deg, ${B} 0%, rgba(7,7,10,.7) ${(v2 * 0.35).toFixed(1)}%, ` +
      `rgba(7,7,10,.35) ${(v2 * 0.68).toFixed(1)}%, rgba(7,7,10,0) ${(v2 * 1.15).toFixed(1)}%, ` +
      `rgba(7,7,10,0) 100%)`,
    bottom:
      `linear-gradient(0deg, ${B} 0%, ${B} ${(vb2 * 0.06).toFixed(1)}%, ` +
      `rgba(7,7,10,.8) ${(vb2 * 0.3).toFixed(1)}%, rgba(7,7,10,.45) ${(vb2 * 0.58).toFixed(1)}%, ` +
      `rgba(7,7,10,.18) ${(vb2 * 0.82).toFixed(1)}%, rgba(7,7,10,0) ${(vb2 * 1.1).toFixed(1)}%, ` +
      `rgba(7,7,10,0) 100%)`,
    blend: 'none',
  };
}
