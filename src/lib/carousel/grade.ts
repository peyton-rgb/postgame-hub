// Andres's colour grades, applied live in the editor (see GradedVideo).
// Each look is a 33×33×33 LUT fitted to his graded stills (andres/luts/
// README.json), stored as a 1089×33 PNG in public/luts: column = r + b·33,
// row = g. Which look a clip gets comes from its camera, read off the file
// name — the README's camera_to_lut table.

import type { Layer, MediaInfo } from './layout.ts';

export const LOOKS = ['sonystudio', 'blackmagic', 'btscanon', 'canoncourt', 'canonstudio'] as const;
export type Look = (typeof LOOKS)[number];

export const LOOK_LABEL: Record<Look, string> = {
  sonystudio: 'Sony studio',
  blackmagic: 'Blackmagic',
  btscanon: 'Canon BTS / bright',
  canoncourt: 'Canon court (dark)',
  canonstudio: 'Canon studio (Ninja)',
};

/** The look a camera's footage gets, from the file name; null = leave as shot. */
export function autoLook(fileName: string): Look | null {
  const n = fileName.trim();
  if (/graded/i.test(n)) return null;                 // already graded
  if (/super ?8/i.test(n)) return null;               // Super 8 stays as-is
  if (/^IMG_/i.test(n)) return null;                  // iPhone: already display-ready
  if (/BRAW-PREVIEW/i.test(n)) return 'blackmagic';   // Blackmagic A-cam preview
  if (/^NINJAV/i.test(n)) return 'canonstudio';       // Canon via Atomos Ninja
  if (/^CK\d/i.test(n)) return 'btscanon';            // Canon CK — court shots: pick canoncourt by hand
  if (/^(LWFX6|FAM)_/i.test(n)) return 'sonystudio';  // Sony FX6
  if (/^C\d{4}\.(mp4|mxf)$/i.test(n)) return 'sonystudio'; // Sony XAVC C00xx / C9xxx
  return null;
}

/** The look to draw a layer with. Auto only grades clips that came straight from
 *  Frame.io — clips cut in the artifact editor may already carry a grade. */
export function lookFor(L: Pick<Layer, 'grade'>, m: (MediaInfo & { source?: string }) | undefined): Look | null {
  if (!m || m.kind !== 'video') return null;
  const g = L.grade ?? 'auto';
  if (g === 'off') return null;
  if (g !== 'auto') return g;
  if (m.source !== 'frameio') return null;
  return autoLook(m.label ?? '');
}
