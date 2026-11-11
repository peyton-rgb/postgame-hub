// Colour grades (Andres's looks + a plain brighten), applied live in the editor (see GradeCanvas).
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

/** What a clip's thumbnail shows: green screen, a dark set, or anything else. */
export type Scene = 'green' | 'dark' | 'plain';
/** Does Auto need to look at the picture before it can choose? Only Canon CK files do: their look depends on the set. */
export const needsScene = (look: Look | null) => look === 'btscanon';

/** What Auto actually shows. Peyton's call (Nov 11 2026): every clip is coloured with
 *  Andres's template for the camera it was shot on — the camera_to_lut table in
 *  andres/luts/README.json. (Before that, Auto meant "as shot".) Canon CK files have two
 *  Andres looks: the dark basketball-court set gets "Canon court", everything else
 *  "Canon BTS / bright". Clips already coloured (file name says "graded") and Super 8
 *  never reach here — autoLook leaves them alone. "As shot, brightened" stays one pick
 *  away in each layer's dropdown.
 *  `scene` undefined = not checked yet → as shot for a moment; false = no thumbnail to check. */
export function refineLook(look: Look | null, auto: boolean, scene: Scene | boolean | undefined): Look | null {
  if (!auto || !needsScene(look)) return look;
  if (scene === undefined) return null;
  return scene === 'dark' ? 'canoncourt' : 'btscanon';
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
/** A Canon Log frame this dim (average brightness, black bars ignored) is the dark court set:
 *  Andres's court reference frame sits at 0.22, his bright-interior one at 0.32. */
export const DARK_SCENE_LUMA = 0.27;
/** Sort a thumbnail's pixels (0–255 rgba) into green screen / dark set / anything else. */
export function sceneKind(rgba: Uint8ClampedArray | number[]): Scene {
  if (greenShare(rgba) >= GREEN_SCREEN_SHARE) return 'green';
  let sum = 0, n = 0;
  for (let k = 0; k < rgba.length; k += 4) {
    const l = (0.2126 * rgba[k] + 0.7152 * rgba[k + 1] + 0.0722 * rgba[k + 2]) / 255;
    if (l < 0.06) continue;                        // pillarbox / pure black
    sum += l; n++;
  }
  return n && sum / n < DARK_SCENE_LUMA ? 'dark' : 'plain';
}
