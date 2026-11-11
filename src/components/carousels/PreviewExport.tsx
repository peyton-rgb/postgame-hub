'use client';

// "Preview video": a phone-screen recording of how the carousel lands on the
// athlete's Instagram — their profile (with the new post first in the grid),
// the post opening, then a swipe through every slide with the clips playing.
// Everything is drawn onto one canvas (the same layout maths and colour grades
// as the editor) and recorded in the browser, so it keeps this tab busy for
// the length of the video. Meant for brand review, not for posting.

import { useEffect, useRef, useState } from 'react';
import { placeLayer, vinOf, vlenOf, SLIDE, H as SLIDE_H, type Layer, type Layout } from '@/lib/carousel/layout';
import { lookFor, needsScene, preFor, refineLook, type Look, type Pre } from '@/lib/carousel/grade';
import { PREVIEW, previewLength, previewState, clipAt } from '@/lib/carousel/preview';
import { FRAG, VERT, loadLut } from './GradeCanvas';
import { filmAmount, filmFrame, filmGeo } from '@/lib/carousel/film';
import { createFilmRenderer, type FilmRenderer } from './filmGL';
import { loadImg, sceneOf } from './gradeImage';
import type { CanvasMedia } from './CarouselCanvas';

type BioLine = { t: string; k?: '' | 'cat' | 'link' };
type Profile = {
  handle: string; display_name: string | null; verified: boolean; followers: string | null; following: string | null;
  posts: number | null; bio: BioLine[]; avatar: string | null; grid: string[];
};

// The phone screen is drawn in iPhone points (390 × 844) and scaled to 1080 wide.
const LW = 390, LH = 844, K = 1080 / LW;
const CW = 1080, CH = 2338;
const MEDIA_Y = 139, MEDIA_H = (LW * SLIDE_H) / SLIDE;  // a 4:5 post, full width
const NAV_Y = 764;
const FONT = '-apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

type Item = {
  L: Layer; m: CanvasMedia; el: HTMLVideoElement | HTMLImageElement; vin: number; vlen: number;
  grade: ((src: HTMLVideoElement) => HTMLCanvasElement | null) | null;
  /** Super 8 film look: strength (0 = off), its own drawing surface, and the last film picture drawn. */
  film?: { amt: number; canvas: HTMLCanvasElement; r: FilmRenderer; n: number; pre: Pre | null };
};
// A layer's Super 8 drawing surface (the grade, if any, is drawn underneath by the same pass).
function makeFilm(L: Layer, kind: string, look: Look | null, pre: Pre | null, cleanup: (() => void)[]): Item['film'] {
  const amt = filmAmount(L, kind);
  if (!amt) return undefined;
  const canvas = document.createElement('canvas');
  const r = createFilmRenderer(canvas, look, true);
  if (!r) return undefined;
  cleanup.push(() => r.dispose());
  return { amt, canvas, r, n: -1, pre };
}

// ---------------------------------------------------------------- grading
function makeGrader(look: Look, pre: Pre | null) {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = (u: number) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };
  const vTex = tex(0), lTex = tex(1);
  gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0); gl.uniform1i(gl.getUniformLocation(prog, 'lut'), 1);
  gl.uniform3f(gl.getUniformLocation(prog, 'pre'), pre ? pre[0] : 1, pre ? pre[1] : 1, pre ? pre[2] : 1);
  let ready = false;
  loadLut(look).then((img) => {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); ready = true;
  }).catch(() => {});
  return (v: HTMLVideoElement) => {
    if (!ready || !v.videoWidth) return null;
    const k = Math.min(1, 1920 / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
    try {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
    } catch { return null; }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return c;
  };
}

// ---------------------------------------------------------------- loading
async function loadVideo(src: string, cleanup: (() => void)[]) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
  const wait = () => new Promise<boolean>((res) => {
    const done = (ok: boolean) => { v.removeEventListener('loadeddata', y); v.removeEventListener('error', n); res(ok); };
    const y = () => done(true), n = () => done(false);
    v.addEventListener('loadeddata', y); v.addEventListener('error', n);
    window.setTimeout(() => done(v.readyState >= 2), 20000);
  });
  // Frame.io hands out either a plain file or an HLS playlist; try the file first.
  v.src = src;
  if (await wait()) return v;
  const { default: Hls } = await import('hls.js');
  if (!Hls.isSupported()) return v;
  v.removeAttribute('src');
  const hls = new Hls({ maxBufferLength: 20 }); hls.loadSource(src); hls.attachMedia(v); cleanup.push(() => hls.destroy());
  await wait();
  return v;
}

const img = (src: string) => loadImg(src).catch(() => null);

// ---------------------------------------------------------------- drawing
const P = (d: string) => new Path2D(d);
const ICON = {
  home: P('M3 11l9-8 9 8v10h-6v-6H9v6H3z'),
  search: P('M18 11a7 7 0 1 1-14 0a7 7 0 1 1 14 0M21 21l-5-5'),
  add: P('M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zM12 8v8M8 12h8'),
  reels: P('M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zM10 9l5 3-5 3z'),
  heart: P('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'),
  comment: P('M20 12a8 8 0 1 1-3.2-6.4L21 4l-1.2 4.4A8 8 0 0 1 20 12z'),
  share: P('M22 3L9.5 13.5M22 3l-7 18-5.5-7.5L2 9z'),
  save: P('M6 3h12v18l-6-5-6 5z'),
  back: P('M15 5l-7 7 7 7'),
  grid: P('M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18'),
  person: P('M16 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0M4 21c1-4 4-6 8-6s7 2 8 6'),
};
const BADGE = P('M12 1l2.6 2.2 3.4-.4.9 3.3 3 1.7-1.2 3.2 1.2 3.2-3 1.7-.9 3.3-3.4-.4L12 23l-2.6-2.2-3.4.4-.9-3.3-3-1.7L3.3 12 2.1 8.8l3-1.7.9-3.3 3.4.4z');
const CHECK = P('M8 12l3 3 5-6');
const MULTI = P('M9 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 7v12a2 2 0 0 0 2 2h12');

function icon(x: CanvasRenderingContext2D, p: Path2D, cx: number, cy: number, size = 24, color = '#f5f5f5') {
  x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 24, size / 24);
  x.strokeStyle = color; x.lineWidth = 1.8; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(p); x.restore();
}
function badge(x: CanvasRenderingContext2D, cx: number, cy: number, size = 14) {
  x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 24, size / 24);
  x.fillStyle = '#3897f0'; x.fill(BADGE); x.strokeStyle = '#fff'; x.lineWidth = 2.2; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(CHECK); x.restore();
}
function text(x: CanvasRenderingContext2D, s: string, tx: number, ty: number, size: number, weight = 400, color = '#f5f5f5', align: CanvasTextAlign = 'left') {
  x.font = `${weight} ${size}px ${FONT}`; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(s, tx, ty);
  return x.measureText(s).width;
}
function avatar(x: CanvasRenderingContext2D, im: HTMLImageElement | null, cx: number, cy: number, d: number, ring: boolean) {
  if (ring) {
    const g = x.createLinearGradient(cx - d / 2, cy + d / 2, cx + d / 2, cy - d / 2);
    g.addColorStop(0, '#feda75'); g.addColorStop(0.5, '#d62976'); g.addColorStop(1, '#962fbf');
    x.beginPath(); x.arc(cx, cy, d / 2 + 4, 0, Math.PI * 2); x.fillStyle = g; x.fill();
    x.beginPath(); x.arc(cx, cy, d / 2 + 2, 0, Math.PI * 2); x.fillStyle = '#000'; x.fill();
  }
  x.save(); x.beginPath(); x.arc(cx, cy, d / 2, 0, Math.PI * 2); x.clip();
  if (im) x.drawImage(im, cx - d / 2, cy - d / 2, d, d); else { x.fillStyle = '#333'; x.fillRect(cx - d / 2, cy - d / 2, d, d); }
  x.restore();
}
function cover(x: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
  const s = Math.max(dw / sw, dh / sh); const w = dw / s, h = dh / s;
  x.drawImage(src, (sw - w) / 2, (sh - h) / 2, w, h, dx, dy, dw, dh);
}
function round(x: CanvasRenderingContext2D, rx: number, ry: number, w: number, h: number, r: number, fill: string) {
  x.beginPath(); x.roundRect(rx, ry, w, h, r); x.fillStyle = fill; x.fill();
}

type Opts = { caption: string; partner: boolean };

function drawStatus(x: CanvasRenderingContext2D) {
  x.fillStyle = '#000'; x.fillRect(0, 0, LW, 47);
  text(x, '9:41', 42, 27, 15, 600);
  [4, 6.5, 9, 11.5].forEach((h, i) => round(x, 296 + i * 5, 31 - h, 3, h, 1, '#f5f5f5'));
  round(x, 322, 21, 24, 12, 3.5, '#f5f5f5'); round(x, 347, 25, 2, 4, 1, '#f5f5f5');
}

function drawNav(x: CanvasRenderingContext2D, av: HTMLImageElement | null) {
  x.fillStyle = '#000'; x.fillRect(0, NAV_Y, LW, LH - NAV_Y);
  x.fillStyle = '#222'; x.fillRect(0, NAV_Y, LW, 1);
  [ICON.home, ICON.search, ICON.add, ICON.reels].forEach((p, i) => icon(x, p, 39 + i * 78, NAV_Y + 25));
  avatar(x, av, 351, NAV_Y + 25, 26, false);
  x.beginPath(); x.arc(351, NAV_Y + 25, 14, 0, Math.PI * 2); x.strokeStyle = '#f5f5f5'; x.lineWidth = 1.5; x.stroke();
  round(x, 128, LH - 13, 134, 5, 2.5, '#f5f5f5');  // home indicator
}

function drawProfile(x: CanvasRenderingContext2D, p: Profile, av: HTMLImageElement | null, grid: (HTMLImageElement | null)[], strip: HTMLCanvasElement) {
  x.fillStyle = '#000'; x.fillRect(0, 47, LW, NAV_Y - 47);
  const hw = text(x, p.handle, 0, -100, 17, 700);  // measure
  text(x, p.handle, LW / 2 - (p.verified ? 9 : 0), 69, 17, 700, '#f5f5f5', 'center');
  if (p.verified) badge(x, LW / 2 - 9 + hw / 2 + 11, 69, 15);
  avatar(x, av, 59, 140, 86, true);
  const stats: [string, string][] = [[p.posts != null ? String(p.posts) : '—', 'posts'], [p.followers ?? '—', 'followers'], [p.following ?? '—', 'following']];
  stats.forEach(([n, l], i) => { const cx = 126 + (248 / 3) * (i + 0.5); text(x, n, cx, 131, 17, 700, '#f5f5f5', 'center'); text(x, l, cx, 150, 13, 400, '#f5f5f5', 'center'); });
  let y = 199;
  if (p.display_name) { text(x, p.display_name, 16, y, 13, 600); y += 17.5; }
  for (const b of p.bio.slice(0, 4)) { text(x, b.t, 16, y, 13, 400, b.k === 'cat' ? '#a8a8a8' : b.k === 'link' ? '#e0f1ff' : '#f5f5f5'); y += 17.5; }
  const by = Math.max(y + 4, 270);
  round(x, 16, by, 176, 30, 8, '#3897f0'); text(x, 'Follow', 104, by + 15, 13, 600, '#fff', 'center');
  round(x, 198, by, 176, 30, 8, '#262626'); text(x, 'Message', 286, by + 15, 13, 600, '#fff', 'center');
  const ty = by + 42;
  x.fillStyle = '#222'; x.fillRect(0, ty, LW, 1);
  icon(x, ICON.grid, 65, ty + 21); icon(x, ICON.reels, 195, ty + 21, 24, '#777'); icon(x, ICON.person, 325, ty + 21, 24, '#777');
  x.fillStyle = '#f5f5f5'; x.fillRect(0, ty + 41, 130, 1);
  const gy = ty + 43, cw = (LW - 4) / 3, ch = (cw * 4) / 3;
  for (let i = 0; i < 9; i++) {
    const cx = (i % 3) * (cw + 2), cy = gy + Math.floor(i / 3) * (ch + 2);
    if (cy > NAV_Y) break;
    if (i === 0) {
      cover(x, strip, SLIDE, SLIDE_H, cx, cy, cw, ch);   // the new post: slide 1, live
      x.save(); x.translate(cx + cw - 22, cy + 6); x.scale(16 / 24, 16 / 24); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(MULTI); x.restore();
    } else {
      const g = grid[i - 1];
      if (g) cover(x, g, g.naturalWidth, g.naturalHeight, cx, cy, cw, ch);
      else { x.fillStyle = '#1c1c1e'; x.fillRect(cx, cy, cw, ch); }
    }
  }
}

function drawPost(x: CanvasRenderingContext2D, p: Profile, av: HTMLImageElement | null, strip: HTMLCanvasElement, offset: number, shown: number, slides: number, o: Opts) {
  x.fillStyle = '#000'; x.fillRect(0, 47, LW, NAV_Y - 47);
  icon(x, ICON.back, 26, 69); text(x, 'Posts', 48, 69, 16, 700);
  avatar(x, av, 28, 115, 32, true);
  const hy = o.partner ? 108 : 115;
  const hw = text(x, p.handle, 54, hy, 13, 600);
  if (p.verified) badge(x, 54 + hw + 9, hy, 13);
  if (o.partner) text(x, 'Paid partnership with raisingcanes', 54, 124, 11, 400, '#bbb');
  [-6, 0, 6].forEach((d) => { x.beginPath(); x.arc(370 + d, 115, 1.6, 0, Math.PI * 2); x.fillStyle = '#f5f5f5'; x.fill(); });
  x.save(); x.beginPath(); x.rect(0, MEDIA_Y, LW, MEDIA_H); x.clip();
  x.drawImage(strip, offset * SLIDE, 0, SLIDE, SLIDE_H, 0, MEDIA_Y, LW, MEDIA_H);
  x.restore();
  if (slides > 1) { round(x, LW - 50, MEDIA_Y + 12, 38, 22, 11, 'rgba(18,18,18,.7)'); text(x, `${shown}/${slides}`, LW - 31, MEDIA_Y + 23, 12, 600, '#f5f5f5', 'center'); }
  const ay = MEDIA_Y + MEDIA_H + 22;
  icon(x, ICON.heart, 24, ay); icon(x, ICON.comment, 62, ay); icon(x, ICON.share, 100, ay); icon(x, ICON.save, 366, ay);
  if (slides > 1) for (let k = 0; k < slides; k++) {
    x.beginPath(); x.arc(LW / 2 + (k - (slides - 1) / 2) * 10, ay, 3, 0, Math.PI * 2); x.fillStyle = k === shown - 1 ? '#3897f0' : '#555'; x.fill();
  }
  if (o.caption.trim()) {
    x.font = `600 13px ${FONT}`; const hw2 = x.measureText(p.handle + ' ').width;
    const words = o.caption.trim().split(/\s+/); let line = '', lines: string[] = [], first = true;
    for (const w of words) {
      const test = line ? line + ' ' + w : w; x.font = `400 13px ${FONT}`;
      if (x.measureText(test).width > (first ? 358 - hw2 : 358)) { lines.push(line); line = w; first = false; } else line = test;
    }
    lines.push(line);
    text(x, p.handle, 16, ay + 32, 13, 600);
    lines.slice(0, 2).forEach((l, i) => text(x, i === 1 && lines.length > 2 ? l + '… more' : l, i === 0 ? 16 + hw2 : 16, ay + 32 + i * 18, 13, 400));
  }
}

// ---------------------------------------------------------------- component
export default function PreviewExport({ slug, name, layout, media, onClose }: {
  slug: string; name: string; layout: Layout; media: Record<string, CanvasMedia>; onClose: () => void;
}) {
  const out = useRef<HTMLCanvasElement>(null);
  const opts = useRef<Opts>({ caption: '', partner: true });
  const clock = useRef<{ t0: number; rec: boolean }>({ t0: performance.now(), rec: false });
  const [stage, setStage] = useState<'loading' | 'ready' | 'recording' | 'done' | 'error'>('loading');
  const [note, setNote] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; ext: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [partner, setPartner] = useState(true);
  const [hasProfile, setHasProfile] = useState(true);
  const recordRef = useRef<() => void>(() => {});
  opts.current = { caption, partner };

  const slides = layout.canvas?.slides ?? 5;
  const len = previewLength(slides);

  useEffect(() => {
    let alive = true, timer = 0;
    const cleanup: (() => void)[] = [];
    (async () => {
      try {
        const pr = await fetch(`/api/carousels/${slug}/profile`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
        const prof: Profile = pr.profile ?? { handle: name.toLowerCase().replace(/[^a-z0-9]+/g, ''), display_name: name, verified: false, followers: null, following: null, posts: null, bio: [], avatar: null, grid: [] };
        if (!pr.profile) setHasProfile(false);
        prof.bio = Array.isArray(prof.bio) ? prof.bio : []; prof.grid = Array.isArray(prof.grid) ? prof.grid : [];
        const av = prof.avatar ? await img(prof.avatar) : null;
        const grid = await Promise.all(prof.grid.slice(0, 8).map((g) => img(g)));

        // Fonts for text layers come from next/font CSS variables.
        const css = getComputedStyle(document.body);
        const fam = (v: string, fb: string) => `${css.getPropertyValue(v).trim() || fb}, ${fb}`;
        const items: Item[] = [];
        for (const L of layout.layers) {
          if (L.hidden || L.type === 'text') continue;
          const m = media[L.media];
          if (!m?.src && !m?.thumb) continue;
          if (m.kind === 'video') {
            if (!m.src) continue;
            const el = await loadVideo(m.src, cleanup);
            const base = lookFor(L, m), auto = (L.grade ?? 'auto') === 'auto';
            const scene = auto && needsScene(base) && m.thumb ? await sceneOf(m.thumb) : false;
            const look = refineLook(base, auto, scene);
            const pre = look ? preFor(base, auto, scene) : null;
            const film = makeFilm(L, m.kind, look, pre, cleanup);
            items.push({ L, m, el, vin: vinOf(L, m), vlen: vlenOf(L, m), grade: look && !film ? makeGrader(look, pre) : null, film });
          } else {
            const el = await img((m.src ?? m.thumb)!);
            if (el) items.push({ L, m, el, vin: 0, vlen: 0, grade: null, film: makeFilm(L, m.kind, null, null, cleanup) });
          }
          if (!alive) return;
        }
        const texts = layout.layers.filter((L) => L.type === 'text' && !L.hidden);
        for (const it of items) if (it.el instanceof HTMLVideoElement) it.el.currentTime = it.vin;

        const strip = document.createElement('canvas'); strip.width = SLIDE * slides; strip.height = SLIDE_H;
        const sx = strip.getContext('2d')!;
        const ctx = out.current!.getContext('2d')!;

        const frame = () => {
          if (!alive) return;
          const now = performance.now();
          let t = (now - clock.current.t0) / 1000;
          if (!clock.current.rec) t %= len + 1;                     // live preview loops
          // the carousel strip
          sx.fillStyle = '#000'; sx.fillRect(0, 0, strip.width, strip.height);
          for (const it of items) {
            const { L, m, el } = it;
            const pl = placeLayer(L, m);
            let src: CanvasImageSource = el;
            if (el instanceof HTMLVideoElement) {
              // Each slide's clips start from the top when the slide arrives (as on Instagram).
              const k = Math.floor((L.x + L.w / 2) / SLIDE) + 1;
              const c = clipAt(t, k, it.vlen);
              const want = it.vin + c.at;
              if (Math.abs(el.currentTime - want) > (c.playing ? 0.3 : 0.05)) el.currentTime = want;
              if (c.playing && el.paused) el.play().catch(() => {});
              if (!c.playing && !el.paused) el.pause();
              if (el.readyState < 2) continue;
              src = (it.grade && it.grade(el)) || el;
            }
            if (it.film && it.film.r.ready()) {
              // Super 8: a clip takes a new frame only when the film steps on (18 a second); a photo is sent once.
              const f = it.film, n = filmFrame(t).n, vid = el instanceof HTMLVideoElement;
              const sw = vid ? el.videoWidth : el.naturalWidth, sh = vid ? el.videoHeight : el.naturalHeight;
              if (f.r.draw(el, sw, sh, filmGeo(pl), f.amt, t, vid ? n !== f.n : f.n < 0, f.pre)) { src = f.canvas; f.n = n; }
            }
            sx.save();
            sx.beginPath(); sx.rect(pl.frame.left, pl.frame.top, pl.frame.width, pl.frame.height); sx.clip();
            if (pl.shadowBox) { sx.shadowColor = 'rgba(0,0,0,.55)'; sx.shadowBlur = 60; sx.shadowOffsetY = 18; }
            sx.filter = pl.filter || 'none';
            sx.drawImage(src, pl.frame.left + pl.media.left, pl.frame.top + pl.media.top, pl.media.width, pl.media.height);
            sx.restore();
          }
          for (const L of texts) {
            const f = L.font === 'Arimo' ? fam('--font-arimo', 'Arial') : L.font === 'Anton' ? fam('--font-anton', 'Impact') : fam('--font-bebas', 'Impact');
            sx.save(); sx.globalAlpha = L.opacity ?? 1; sx.fillStyle = L.color ?? '#fff';
            sx.font = `${L.weight ?? 400} ${L.size ?? 40}px ${f}`; sx.textBaseline = 'top'; sx.textAlign = L.align ?? 'left';
            (L.text ?? '').split('\n').forEach((ln, i) => sx.fillText(ln, L.x, L.y + i * (L.size ?? 40)));
            sx.restore();
          }
          // the phone screen
          const st = previewState(t, slides);
          ctx.save(); ctx.setTransform(K, 0, 0, CH / LH, 0, 0);
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, LW, LH);
          if (st.push < 1) { ctx.save(); ctx.translate(-st.push * LW * 0.3, 0); drawProfile(ctx, prof, av, grid, strip); ctx.restore(); }
          if (st.push > 0) { ctx.save(); ctx.translate((1 - st.push) * LW, 0); drawPost(ctx, prof, av, strip, st.offset, st.shown, slides, opts.current); ctx.restore(); }
          drawStatus(ctx); drawNav(ctx, av);
          ctx.restore();
          if (clock.current.rec) setProgress(Math.min(1, t / len));
        };
        timer = window.setInterval(frame, 1000 / 30);

        recordRef.current = async () => {
          const c = out.current!;
          // Line every clip up on its first frame, then start clock and recorder together.
          await Promise.all(items.map((it) => it.el instanceof HTMLVideoElement
            ? new Promise<void>((res) => { const v = it.el as HTMLVideoElement; v.currentTime = it.vin; v.addEventListener('seeked', () => res(), { once: true }); window.setTimeout(res, 4000); })
            : Promise.resolve()));
          const types = ['video/mp4;codecs=avc1.640033', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
          const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
          const rec = new MediaRecorder(c.captureStream(30), { mimeType: mime || undefined, videoBitsPerSecond: 16_000_000 });
          const chunks: Blob[] = [];
          rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          clock.current = { t0: performance.now(), rec: true };
          setStage('recording'); setProgress(0);
          rec.start(500);
          await new Promise((r) => window.setTimeout(r, len * 1000 + 200));
          rec.stop();
          await new Promise((r) => { rec.onstop = r; });
          clock.current = { t0: performance.now(), rec: false };
          const type = rec.mimeType || mime || 'video/webm';
          setResult((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(new Blob(chunks, { type })), ext: type.includes('mp4') ? 'mp4' : 'webm' }; });
          setStage('done');
        };
        if (alive) setStage('ready');
      } catch (e) {
        if (alive) { setStage('error'); setNote(e instanceof Error ? e.message : 'Could not load the carousel'); }
      }
    })();
    return () => { alive = false; window.clearInterval(timer); cleanup.forEach((f) => f()); };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const btn = 'grid h-10 place-items-center rounded-full px-5 text-[12px] font-bold uppercase tracking-[.12em]';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ground/85 p-4" role="dialog" aria-modal="true" aria-label="Preview video">
      <div className="flex max-h-[94vh] w-full max-w-[920px] flex-col gap-5 overflow-auto rounded-2xl border border-hairline-soft bg-ground p-5 sm:flex-row">
        <div className="flex shrink-0 justify-center">
          {stage === 'done' && result && (
            <video src={result.url} controls autoPlay loop playsInline className="h-[min(78vh,760px)] w-auto rounded-[28px] bg-black" style={{ aspectRatio: `${CW} / ${CH}` }} />
          )}
          {/* Always mounted: it is what gets drawn and recorded. */}
          <canvas ref={out} width={CW} height={CH} className={`h-[min(78vh,760px)] w-auto rounded-[28px] bg-black ${stage === 'done' && result ? 'hidden' : ''}`} style={{ aspectRatio: `${CW} / ${CH}` }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <h2 className="font-display text-[28px] leading-none text-ink-1">Preview video</h2>
            <p className="mt-2 text-[13px] text-ink-3">
              {name}&apos;s profile, the post opening, then a swipe through all {slides} slides — {Math.round(len)} seconds, phone size.
              For brand review only: it shows the athlete&apos;s own Instagram posts.
            </p>
          </div>
          {!hasProfile && <p className="rounded-lg border border-hairline-soft px-3 py-2 text-[13px] text-status-warn">No Instagram profile captured for {name} yet — showing a placeholder.</p>}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[.14em] text-ink-3">Caption</span>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} disabled={stage === 'recording'}
              placeholder="Optional — leave empty for no caption"
              className="rounded-lg border border-hairline-soft bg-surface-raised px-3 py-2 text-[14px] text-ink-1" />
          </label>
          <label className="flex items-center gap-2 text-[14px] text-ink-1">
            <input type="checkbox" checked={partner} onChange={(e) => setPartner(e.target.checked)} disabled={stage === 'recording'} />
            Show &ldquo;Paid partnership with raisingcanes&rdquo;
          </label>
          {stage === 'loading' && <p className="text-[13px] text-ink-3">Loading the clips…</p>}
          {stage === 'error' && <p className="text-[13px] text-status-bad">{note}</p>}
          {stage === 'recording' && (
            <div className="flex flex-col gap-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} /></div>
              <p className="text-[13px] text-ink-3">Recording… keep this tab open and in front until it finishes.</p>
            </div>
          )}
          <div className="mt-auto flex flex-wrap gap-2">
            {(stage === 'ready' || stage === 'done') && (
              <button type="button" onClick={() => { setResult(null); setStage('ready'); window.setTimeout(() => recordRef.current(), 50); }} className={`${btn} bg-accent text-white`}>
                {stage === 'done' ? 'Record again' : 'Record video'}
              </button>
            )}
            {stage === 'done' && result && (
              <a href={result.url} download={`${slug}_carousel_preview.${result.ext}`} className={`${btn} border border-hairline-soft text-ink-1`}>Download</a>
            )}
            <button type="button" onClick={onClose} disabled={stage === 'recording'} className={`${btn} border border-hairline-soft text-ink-3`}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
