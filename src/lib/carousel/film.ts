// The "Super 8" film look — a per-layer switch (Layer.film) that makes any clip
// or photo read like the Super 8 footage shot on set. Matched by eye and by
// numbers to the real scans from the Cane's basketball shoot: milky blacks and
// dimmer whites, soft focus, moving grain, a warm glow round bright spots,
// darker corners, a little flicker and frame wobble, and 18 pictures a second
// instead of 24–30. Nothing is baked into the file; it is drawn live on the
// graphics chip (see filmGL.ts) and again when a preview video is recorded.
// No "@/" imports: `node --test` runs this file directly.

import { EVEN_GLSL } from './grade.ts';

/** Super 8 runs at 18 pictures a second. */
export const FILM_FPS = 18;
/** One "film pixel", in slide pixels: a Super 8 frame holds roughly 680 pixels of real detail across a 1080 slide. */
export const FILM_PX = 1080 / 680;

/** Where the effect sits on a layer, in the picture's own 0–1 coordinates. */
export type FilmGeo = {
  /** The part of the picture the frame shows: left, top, right, bottom. */
  vis: [number, number, number, number];
  /** Width ÷ height of that visible part, in slide pixels. */
  asp: number;
  /** One slide pixel, as a share of the drawn picture's width and height. */
  pxu: [number, number];
};

type Placed = { frame: { width: number; height: number }; media: { left: number; top: number; width: number; height: number } };

/** Film geometry from a placed layer (layout.ts placeLayer): the visible window is "the film frame". */
export function filmGeo(p: Placed): FilmGeo {
  const { frame: f, media: m } = p;
  return {
    vis: [(0 - m.left) / m.width, (0 - m.top) / m.height, (f.width - m.left) / m.width, (f.height - m.top) / m.height],
    asp: f.width / Math.max(1, f.height),
    pxu: [1 / m.width, 1 / m.height],
  };
}

// A repeatable "random" number 0–1 for picture n — the same every time, so a
// recorded preview and the editor wobble identically.
const rnd = (n: number, k: number) => { const x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

/** What changes from one film picture to the next, for a moment `seconds` on any steady clock. */
export function filmFrame(seconds: number) {
  const n = Math.floor(Math.max(0, seconds) * FILM_FPS);
  return {
    /** Which film picture this is; a clip only steps forward when this changes. */
    n,
    /** Shuffles the grain. */
    seed: (n % 997) * 0.618,
    /** Gate weave: the frame's wobble, in slide pixels. */
    weave: [2 * Math.sin(n * 0.9) + 1.3 * (rnd(n, 1) - 0.5), 1.7 * Math.sin(n * 1.3 + 1) + 1.3 * (rnd(n, 2) - 0.5)] as [number, number],
    /** Flicker: a small brightness pulse. */
    flick: 0.012 * Math.sin(2 * Math.PI * (n / FILM_FPS) * 6.1) + 0.012 * (rnd(n, 3) - 0.5),
  };
}

/** How strong the look is on a layer: 0 = off. */
export function filmAmount(L: { film?: boolean; filmAmt?: number }, kind?: string): number {
  if (!L.film || (kind !== 'video' && kind !== 'image')) return 0;
  return Math.min(1, Math.max(0.1, L.filmAmt ?? 1));
}

/** The picture through an optional LUT grade, then the film look. Same vertex shader as GradeCanvas. */
export const FRAG_FILM = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D img; uniform sampler2D lut;
uniform float useLut, amt, seed, flick, asp;
uniform vec4 vis; uniform vec2 pxu; uniform vec2 weave; uniform vec3 pre; uniform vec3 scr;
${EVEN_GLSL}
varying vec2 uv;
const float N = 33.0;
vec3 grade(vec3 c){
  c = clamp(c, 0., 1.);
  if (useLut < .5) return c;
  c = evenGreen(c, scr);                                                  // green screen: even out the backdrop
  c = clamp(c * (pre.r + pre.g + pre.b > 0. ? pre : vec3(1.)), 0., 1.);   // the clip's exposure / white-balance correction
  float b = c.b * (N - 1.), b0 = floor(b), b1 = min(b0 + 1., N - 1.);
  float x = c.r * (N - 1.) + .5, y = (c.g * (N - 1.) + .5) / N;
  vec3 s0 = texture2D(lut, vec2((b0 * N + x) / (N * N), y)).rgb;
  vec3 s1 = texture2D(lut, vec2((b1 * N + x) / (N * N), y)).rgb;
  return mix(s0, s1, b - b0);
}
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
// A tone curve through five points (input 0, .25, .5, .75, 1).
float seg(float x, float a, float b, float c, float d, float e){
  x = clamp(x, 0., 1.) * 4.;
  return x < 1. ? mix(a, b, x) : x < 2. ? mix(b, c, x - 1.) : x < 3. ? mix(c, d, x - 2.) : mix(d, e, x - 3.);
}
void main(){
  vec2 f = pxu * ${FILM_PX.toFixed(4)};          // one film pixel, in picture coordinates
  vec2 u = uv + weave * pxu * amt;               // gate weave
  vec3 raw = texture2D(img, u).rgb;
  // Soft focus: the tiny frame can't hold fine detail.
  vec3 c = raw * .30;
  for (int i = 0; i < 6; i++){
    float a = 1.0472 * float(i);
    c += texture2D(img, u + vec2(cos(a), sin(a)) * f).rgb * .09;
    c += texture2D(img, u + vec2(cos(a + .5236), sin(a + .5236)) * f * 2.).rgb * .0267;
  }
  // Halation: bright spots bleed a warm glow into what's around them.
  float rot = hash(uv / pxu + seed) * 6.2832;
  vec3 halo = vec3(0.); float hw = 0.;
  for (int i = 0; i < 20; i++){
    float r = sqrt((float(i) + .5) / 20.);
    float a = rot + 2.39996 * float(i);
    vec3 t = texture2D(img, u + vec2(cos(a), sin(a)) * f * r * 20.).rgb;
    float w = exp(-r * r * 2.5);
    halo += max(t - .72, 0.) / .28 * w; hw += w;
  }
  halo = halo / hw * vec3(1., .38, .12);
  c = grade(c);
  c = 1. - (1. - c) * (1. - halo * .55);
  // Film colour: a touch more colour and contrast, then blacks lifted (a little red), whites held back (a little warm).
  float l = dot(c, vec3(.299, .587, .114));
  c = l + (c - l) * 1.12;
  c = (c - .5) * 1.08 + .5;
  c = vec3(seg(c.r, .205, .335, .52, .705, .87), seg(c.g, .17, .30, .495, .69, .86), seg(c.b, .165, .29, .475, .655, .805));
  // Grain: new for every film picture.
  vec2 g = uv / f;
  float n = vnoise(g + seed * vec2(37.1, 17.7)) * .65 + vnoise(g * 2.1 + seed * vec2(11.3, 29.9)) * .35 - .5;
  vec3 cn = vec3(vnoise(g * .55 + seed * 3.1), vnoise(g * .55 + seed * 5.7 + 40.), vnoise(g * .55 + seed * 7.9 + 80.)) - .5;
  c += n * .085 + cn * .03;
  // Darker corners, measured across the part of the picture the frame shows.
  vec2 q = (uv - vis.xy) / (vis.zw - vis.xy);
  float dist = length((q - .5) * vec2(asp, 1.)) / length(vec2(asp, 1.) * .5);
  c *= pow(cos(min(dist, 1.5) * .5236), 4.);
  c += flick;
  gl_FragColor = vec4(mix(grade(raw), clamp(c, 0., 1.), amt), 1.);
}`;
