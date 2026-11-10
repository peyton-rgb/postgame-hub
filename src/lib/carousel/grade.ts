// Colour grades (Andres's looks + a plain brighten), applied live in the editor (see GradedVideo).
// Each look is a 33×33×33 LUT fitted to his graded stills (andres/luts/
// README.json), stored as a 1089×33 PNG in public/luts: column = r + b·33,
// row = g. Which look a clip gets comes from its camera, read off the file
// name — the README's camera_to_lut table.

import type { Layer, MediaInfo } from './layout.ts';

export const LOOKS = ['lift', 'sonystudio', 'blackmagic', 'btscanon', 'canoncourt', 'canonstudio'] as const;
export type Look = (typeof LOOKS)[number];

export const LOOK_LABEL: Record<Look, string> = {
  lift: 'As shot, brightened',
  sonystudio: 'Sony studio',
  blackmagic: 'Blackmagic',
  btscanon: 'Canon BTS / bright',
  canoncourt: 'Canon court (dark)',
  canonstudio: 'Canon studio (Ninja)',
};

/** The look a camera's footage gets, read from a file name (or any name that
 *  contains one); null = leave as shot / unknown camera. */
export function autoLook(fileName: string): Look | null {
  const n = fileName.trim();
  if (!n) return null;
  if (/graded/i.test(n)) return null;                       // already graded
  if (/super ?8/i.test(n)) return null;                     // Super 8 stays as-is
  if (/(^|[^A-Z])IMG_\d/i.test(n)) return null;            // iPhone: already display-ready
  if (/BRAW-PREVIEW/i.test(n)) return 'blackmagic';         // Blackmagic A-cam preview
  if (/NINJAV/i.test(n)) return 'canonstudio';              // Canon via Atomos Ninja
  if (/(^|[^A-Z0-9])CK\d{4}/i.test(n)) return 'btscanon';  // Canon CK — court shots: pick canoncourt by hand
  if (/(LWFX6|FAM)_/i.test(n)) return 'sonystudio';        // Sony FX6
  if (/A\d{3}_\d{8}_C\d{3}/i.test(n)) return 'blackmagic'; // Blackmagic A-cam proxy (A004_07021446_C033.mp4)
  if (/(^|[^A-Z0-9])C\d{4}(\.|_|$)/i.test(n)) return 'sonystudio'; // Sony XAVC C00xx / C9xxx
  if (/(^|[^A-Z0-9])C\d{3}(\.|_|$| )/i.test(n)) return 'blackmagic'; // A-cam clip number on its own (C036, C764)
  return null;
}

/** The camera file name behind a media item: the name after "· " in an
 *  artifact label ("✨ s2 · A009_…_BRAW-PREVIEW.mp4"), the label itself for
 *  Frame.io clips, the source file, then the media key as a last resort. */
export function cameraLook(m: MediaInfo & { source?: string }, key = ''): Look | null {
  const label = (m.label ?? '').replace(/\s*\(\d+:\d+\)\s*$/, '');
  const tail = label.includes('·') ? label.slice(label.lastIndexOf('·') + 1) : label;
  const src = m.source && m.source !== 'frameio' ? m.source.split('/').pop() ?? '' : '';
  for (const n of [tail.replace(/^[^A-Za-z0-9]+/, ''), src, key]) {
    if (/super ?8|graded/i.test(n)) return null;
    const k = autoLook(n);
    if (k) return k;
  }
  return null;
}

/** The look to draw a layer with: its own choice, or the camera's look on Auto. */
export function lookFor(L: { grade?: Layer['grade']; media?: string }, m: (MediaInfo & { source?: string }) | undefined): Look | null {
  if (!m || m.kind !== 'video') return null;
  const g = L.grade ?? 'auto';
  if (g === 'off') return null;
  if (g !== 'auto') return g;
  return cameraLook(m, L.media ?? '');
}

/** Canon footage (CK files and Canon via the Ninja). */
const CANON: ReadonlySet<Look> = new Set<Look>(['btscanon', 'canonstudio', 'canoncourt']);
/** Does Auto need to know whether this clip is green screen? */
export const needsScene = (look: Look | null) => !!look && CANON.has(look);

/** What Auto actually shows. Peyton's call (Nov 2026): the footage looks best
 *  as shot — Andres's fitted looks came out too saturated and dark on most
 *  sets. Only Canon footage away from the green screen (the dim warm room,
 *  the Canon black-set shots) is brightened; everything else stays as shot.
 *  Andres's looks remain one pick away in each layer's dropdown.
 *  `green` undefined = not checked yet → as shot for a moment. */
export function refineLook(look: Look | null, auto: boolean, green: boolean | undefined): Look | null {
  if (!auto) return look;
  if (!needsScene(look) || green === undefined) return null;
  return green ? null : 'lift';
}

/** Share of a picture that is green-screen green, ignoring black side bars.
 *  `rgba` is 0–255 pixel data (e.g. from a small canvas). */
export function greenShare(rgba: Uint8ClampedArray | number[]): number {
  let green = 0, counted = 0;
  for (let k = 0; k < rgba.length; k += 4) {
    const r = rgba[k] / 255, g = rgba[k + 1] / 255, b = rgba[k + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 0.06) continue;                       // pillarbox / pure black
    counted++;
    if (mx !== g || mx - mn < 0.08) continue;      // not green-dominant
    const sat = (mx - mn) / mx;
    let hue = 60 * ((b - r) / (mx - mn)) + 120;    // green-dominant hue
    if (hue < 0) hue += 360;
    if (sat > 0.18 && hue >= 85 && hue <= 175) green++;
  }
  return counted ? green / counted : 0;
}
export const GREEN_SCREEN_SHARE = 0.15;
