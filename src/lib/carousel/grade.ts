// Colour grades (Andres's looks + a plain brighten), applied live in the editor (see GradeCanvas).
// Each look is a 33×33×33 LUT fitted to his graded stills (andres/luts/
// README.json), stored as a 1089×33 PNG in public/luts: column = r + b·33,
// row = g. Which look a clip gets comes from its camera, read off the file
// name — the README's camera_to_lut table.

import type { Layer, MediaInfo } from './layout.ts';

export const LOOKS = ['lift', 'sonystudio', 'blackmagic', 'blackmagicflat', 'btscanon', 'canoncourt', 'canonstudio'] as const;
export type Look = (typeof LOOKS)[number];

export const LOOK_LABEL: Record<Look, string> = {
  lift: 'As shot, brightened',
  sonystudio: 'Sony studio',
  blackmagic: 'Blackmagic (preview file)',
  blackmagicflat: 'Blackmagic (flat A-cam file)',
  btscanon: 'Canon BTS / bright',
  canoncourt: 'Canon court (dark)',
  canonstudio: 'Canon studio (Ninja)',
};

/** Andres's own graded A-cam exports are 4K (4096 or 3072 wide) and carry the SAME file names
 *  as the flat 720p proxies in the athlete folders — so the width is what tells them apart. */
export const GRADED_ACAM_MIN_W = 3000;
export const FLAT_ACAM_MAX_W = 1280;

/** The look a camera's footage gets, read from a file name (or any name that
 *  contains one); null = leave as shot / unknown camera. `w` is the file's pixel
 *  width when known: for the Blackmagic A-cam it separates Andres's already-graded
 *  4K export (no look — it is finished) from the flat 720p proxy (the flat-file look,
 *  fitted to his graded exports of the same frames, Nov 11 2026). */
export function autoLook(fileName: string, w?: number | null): Look | null {
  const n = fileName.trim();
  if (!n) return null;
  if (/graded/i.test(n)) return null;                       // already graded
  if (/super ?8/i.test(n)) return null;                     // Super 8 stays as-is
  if (/(^|[^A-Z])IMG_\d/i.test(n)) return null;            // iPhone: already display-ready
  if (/BRAW-PREVIEW/i.test(n)) return 'blackmagic';         // Blackmagic A-cam preview
  if (/NINJAV/i.test(n)) return 'canonstudio';              // Canon via Atomos Ninja
  if (/(^|[^A-Z0-9])CK\d{4}/i.test(n)) return 'btscanon';  // Canon CK — court shots: pick canoncourt by hand
  if (/(LWFX6|FAM)_/i.test(n)) return 'sonystudio';        // Sony FX6
  const acam = (): Look | null => (w && w >= GRADED_ACAM_MIN_W ? null : w && w <= FLAT_ACAM_MAX_W ? 'blackmagicflat' : 'blackmagic');
  if (/A\d{3}_\d{8}_C\d{3}/i.test(n)) return acam();          // Blackmagic A-cam file (A004_07021446_C033.mp4): graded 4K, flat proxy, or a cut of unknown size
  if (/(^|[^A-Z0-9])C\d{4}(\.|_|$)/i.test(n)) return 'sonystudio'; // Sony XAVC C00xx / C9xxx
  if (/(^|[^A-Z0-9])C\d{3}(\.|_|$| )/i.test(n)) return w && w >= GRADED_ACAM_MIN_W ? null : 'blackmagic'; // A-cam clip number on its own (C036, C764)
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
    const k = autoLook(n, m.w);
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
/** A per-clip correction applied before the look: how much to multiply red, green and blue by. */
export type Pre = [number, number, number] | [number, number, number, number, number, number];
/** Red, green, blue, each 0–1. */
export type Rgb = [number, number, number];
/** What the editor learns from a clip's thumbnail: the set, and the exposure / white-balance correction it would need. */
export type SceneInfo = { kind: Scene; pre: Pre | null; /** the green screen's own colour in the file, when there is one (screenColour) */ screen?: Rgb | null };
type SceneArg = SceneInfo | Scene | boolean | undefined;
const kindOf = (s: SceneArg): Scene | boolean | undefined => (s && typeof s === 'object' ? s.kind : s);
/** Does Auto need to look at the picture before it can choose? Canon footage does: its treatment depends on the set. */
export const needsScene = (look: Look | null) => look === 'btscanon' || look === 'canonstudio';
/** Looks whose clips get their thumbnail read at all: the ones above, plus Sony — its green-screen
 *  clips get the backdrop evened out, but Auto doesn't have to wait for the answer to pick the look. */
export const wantsScene = (look: Look | null) => needsScene(look) || look === 'sonystudio';
/** The cameras the green screen station was shot on. (The Blackmagic's green-lit room is a set, not a screen.) */
export const evensGreen = (look: Look | null) => look === 'canonstudio' || look === 'sonystudio';

/** What Auto actually shows. Peyton's call (Nov 11 2026): every clip is coloured with
 *  Andres's template for the camera it was shot on — the camera_to_lut table in
 *  andres/luts/README.json. (Before that, Auto meant "as shot".) Canon CK files have two
 *  Andres looks: the dark basketball-court set gets "Canon court", everything else
 *  "Canon BTS / bright". Clips already coloured (file name says "graded") and Super 8
 *  never reach here — autoLook leaves them alone. "As shot, brightened" stays one pick
 *  away in each layer's dropdown.
 *  `scene` undefined = not checked yet → as shot for a moment; false = no thumbnail to check. */
export function refineLook(look: Look | null, auto: boolean, scene: SceneArg): Look | null {
  if (!auto || !needsScene(look)) return look;
  const kind = kindOf(scene);
  if (kind === undefined) return null;
  if (look === 'canonstudio') return look;
  return kind === 'dark' ? 'canoncourt' : 'btscanon';
}

/** The correction Auto adds under the look. Andres built his Canon studio look on the bright
 *  green-screen set; in the dim warm white-wall room the same look leaves faces dark and the
 *  frame orange (Peyton, Nov 11 2026). So Canon-via-Ninja clips away from the green screen are
 *  first brightened and white-balanced to their own wall — the way a colourist would set
 *  exposure before applying a look — and then get Andres's look. Picked by hand, a look is
 *  applied exactly as Andres made it. */
export function preFor(look: Look | null, auto: boolean, scene: SceneArg, even = true): Pre | null {
  if (!auto || !scene || typeof scene !== 'object') return null;
  const gains = look === 'canonstudio' && scene.kind !== 'green' ? scene.pre : null;
  // Green screen (Peyton, Nov 11 2026): the look's contrast turns tiny differences in the backdrop into
  // light and dark patches, so on Auto the screen's colour rides along and the shader evens it out first.
  const screen = even && evensGreen(look) ? scene.screen ?? null : null;
  if (!screen) return gains;
  const g = gains ?? [1, 1, 1];
  return [g[0], g[1], g[2], screen[0], screen[1], screen[2]];
}
/** Does this correction brighten / white-balance the clip? */
export const preBalances = (pre: Pre | null) => !!pre && (pre[0] !== 1 || pre[1] !== 1 || pre[2] !== 1);
/** Does this correction even out a green screen? */
export const preEvens = (pre: Pre | null) => !!pre && pre.length === 6;

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

/** Where the wall should land before the look (0–1): Andres's Canon look turns this into a bright off-white. */
export const BALANCE_TARGET = 0.6;
/** Exposure + white balance for a clip, read off its thumbnail (0–255 rgba): find the wall
 *  (the brightest, least colourful third of the picture), then the red/green/blue multipliers
 *  that bring it to a bright near-neutral — keeping about a third of its warmth so it doesn't go
 *  clinical. Multiplying (rather than adding) keeps blacks black. With no wall to read, it
 *  only brightens. Null = nothing to measure. */
export function balanceGains(rgba: Uint8ClampedArray | number[]): Pre | null {
  const px: [number, number, number, number, number][] = [];   // luma, r, g, b, colourfulness
  for (let k = 0; k < rgba.length; k += 4) {
    const r = rgba[k] / 255, g = rgba[k + 1] / 255, b = rgba[k + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 0.06) continue;                       // pillarbox / pure black
    px.push([0.2126 * r + 0.7152 * g + 0.0722 * b, r, g, b, (mx - mn) / mx]);
  }
  if (px.length < 50) return null;
  px.sort((a, b) => b[0] - a[0]);
  const clamp = (v: number) => Math.min(2, Math.max(0.85, v));
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const wall = px.slice(0, Math.floor(px.length * 0.3)).filter((p) => p[4] < 0.3);
  if (wall.length < px.length * 0.08) {
    const top = px[Math.floor(px.length * 0.05)][0];           // no wall: lift the brightest part to the target
    const g = round(clamp(BALANCE_TARGET / Math.max(top, 0.05)));
    return [g, g, g];
  }
  const med = (i: 1 | 2 | 3) => { const v = wall.map((p) => p[i]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const w = [med(1), med(2), med(3)];
  const wl = 0.2126 * w[0] + 0.7152 * w[1] + 0.0722 * w[2];
  return w.map((c) => round(clamp((BALANCE_TARGET * (wl + (c - wl) * 0.3)) / wl / Math.max(c, 0.02)))) as Pre;
}

// ---- Green screen: even out the backdrop -------------------------------------------------
// Anything close to the screen's own colour is pulled toward it; the further a colour is from
// the screen — in hue or in brightness — the less it moves. No hard edge anywhere, so skin,
// hair and shirts (even a green shirt) stay put, and real shadows and folds keep their shape.
// It runs on the file's own colours, before the look. Tested on 12 green-screen clips from
// three cameras; a hard "replace with flat green" key was tried and left blocky edges.
export const EVEN = {
  chroma: 0.45,   // how far in hue (relative to how far the screen itself is from grey) still counts as "screen"
  luma: 0.30,     // how far in brightness (relative to the screen's)
  strength: 0.85, // how much of the difference is removed on the screen itself
  share: 0.15,    // a frame needs at least this much screen for the screen colour to be trusted
  minChroma: 0.02,
} as const;
const lumaOf = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** How much of the way a colour is moved to the screen colour (0 … EVEN.strength). */
export function evenWeight(c: Rgb, scr: Rgb): number {
  const sc = c[0] + c[1] + c[2] + 1e-4, ss = scr[0] + scr[1] + scr[2];
  if (ss <= 0) return 0;
  const cs: Rgb = [scr[0] / ss, scr[1] / ss, scr[2] / ss];
  const D = Math.max(Math.hypot(cs[0] - 1 / 3, cs[1] - 1 / 3, cs[2] - 1 / 3), 1e-4);
  const dc = Math.hypot(c[0] / sc - cs[0], c[1] / sc - cs[1], c[2] / sc - cs[2]) / D / EVEN.chroma;
  const dl = Math.abs(lumaOf(c) - lumaOf(scr)) / Math.max(lumaOf(scr), 1e-3) / EVEN.luma;
  return EVEN.strength / ((1 + dc ** 4) * (1 + dl ** 4));
}
/** The same maths as EVEN_GLSL, for tests and stills worked out in code. */
export function evenGreen(c: Rgb, scr: Rgb): Rgb {
  const k = evenWeight(c, scr);
  return [c[0] + (scr[0] - c[0]) * k, c[1] + (scr[1] - c[1]) * k, c[2] + (scr[2] - c[2]) * k];
}
/** GLSL for the shaders: `vec3 evenGreen(vec3 c, vec3 scr)`; scr of all zeros = no screen, c comes back untouched. */
export const EVEN_GLSL = `
vec3 evenGreen(vec3 c, vec3 scr){
  float ss = scr.r + scr.g + scr.b;
  if (ss <= 0.) return c;
  const vec3 LW = vec3(.2126, .7152, .0722);
  vec3 cs = scr / ss, ch = c / (c.r + c.g + c.b + 1e-4);
  float D = max(length(cs - vec3(1. / 3.)), 1e-4);
  float dc = length(ch - cs) / D / ${EVEN.chroma.toFixed(2)};
  float dl = abs(dot(c, LW) - dot(scr, LW)) / max(dot(scr, LW), 1e-3) / ${EVEN.luma.toFixed(2)};
  float k = ${EVEN.strength.toFixed(2)} / ((1. + dc * dc * dc * dc) * (1. + dl * dl * dl * dl));
  return c + (scr - c) * k;
}`;
const median = (v: number[]) => { v.sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
/** The green screen's colour, read off a thumbnail (0–255 rgba): the typical colour of the
 *  green-leaning pixels, then once more over only the pixels close to that (which drops
 *  green props and shirts). Null when less than EVEN.share of the picture is screen. */
export function screenColour(rgba: Uint8ClampedArray | number[]): Rgb | null {
  const px: Rgb[] = [];
  let counted = 0;
  for (let k = 0; k < rgba.length; k += 4) {
    const r = rgba[k] / 255, g = rgba[k + 1] / 255, b = rgba[k + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 0.06) continue;                       // pillarbox / pure black
    counted++;
    if (mx === g && (mx - mn) / mx > 0.08) px.push([r, g, b]);
  }
  if (!counted || px.length < counted * EVEN.share) return null;
  const mid = (list: Rgb[]): Rgb => [median(list.map((p) => p[0])), median(list.map((p) => p[1])), median(list.map((p) => p[2]))];
  const first = mid(px);
  const near = px.filter((p) => evenWeight(p, first) >= EVEN.strength / 2);
  if (near.length < counted * EVEN.share) return null;
  const scr = mid(near);
  const ss = scr[0] + scr[1] + scr[2];
  if (!(scr[1] > scr[0] && scr[1] > scr[2]) || Math.hypot(scr[0] / ss - 1 / 3, scr[1] / ss - 1 / 3, scr[2] / ss - 1 / 3) < EVEN.minChroma) return null;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return [round(scr[0]), round(scr[1]), round(scr[2])];
}
