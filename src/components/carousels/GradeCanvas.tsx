'use client';

// Draws the <video> next to it through one of Andres's LUTs, live, on the
// graphics chip (WebGL). The video keeps playing — and keeps being synced by
// the canvas clock — underneath at opacity 0; this canvas sits in exactly the
// same box with the same CSS (crop, filters), so every other control still
// works. If the browser can't read the video's pixels (no WebGL, or a source
// without CORS), it gives up and the plain video shows instead.
//
// With `film` on it also draws the Super 8 film look (lib/carousel/film) — on
// a clip or, given `imageSrc`, on a photo — stepping at film speed while the
// carousel plays and holding still while it is paused.

import { useEffect, useRef, useState } from 'react';
import type { Look } from '@/lib/carousel/grade';
import { FILM_FPS, type FilmGeo } from '@/lib/carousel/film';
import { createFilmRenderer } from './filmGL';
import { loadImg } from './gradeImage';

const N = 33;
export const VERT = `
attribute vec2 p; varying vec2 uv;
void main(){ uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
export const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D img; uniform sampler2D lut; varying vec2 uv;
const float N = ${N}.0;
void main(){
  vec3 c = clamp(texture2D(img, uv).rgb, 0., 1.);
  float b = c.b * (N - 1.), b0 = floor(b), b1 = min(b0 + 1., N - 1.);
  float x = c.r * (N - 1.) + .5, y = (c.g * (N - 1.) + .5) / N;
  vec3 s0 = texture2D(lut, vec2((b0 * N + x) / (N * N), y)).rgb;
  vec3 s1 = texture2D(lut, vec2((b1 * N + x) / (N * N), y)).rgb;
  gl_FragColor = vec4(mix(s0, s1, b - b0), 1.);
}`;

const lutImages = new Map<Look, Promise<HTMLImageElement>>();
export function loadLut(look: Look) {
  let p = lutImages.get(look);
  if (!p) {
    p = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `/luts/${look}.png`; });
    lutImages.set(look, p);
  }
  return p;
}

export default function GradeCanvas({ look, style, onFail, film = 0, geo, animate = true, imageSrc }: {
  look: Look | null; style: React.CSSProperties; onFail: () => void;
  /** Super 8 strength, 0 = off. */
  film?: number;
  /** Where the film frame sits on the picture (filmGeo of the placed layer). */
  geo?: FilmGeo;
  /** Is the carousel playing? Film grain only moves while it is. */
  animate?: boolean;
  /** For a photo: its address (the film look reads its own copy of the pixels). */
  imageSrc?: string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const filmOn = film > 0;
  const live = useRef({ film, geo, animate });
  live.current = { film, geo, animate };

  // ---- Super 8 film look (with the grade underneath, if there is one)
  useEffect(() => {
    if (!filmOn) return;
    const canvas = ref.current;
    if (!canvas) return;
    const video = imageSrc ? null : canvas.parentElement?.querySelector('video') ?? null;
    if (!video && !imageSrc) return;
    const r = createFilmRenderer(canvas, look);
    if (!r) { onFail(); return; }
    let stop = false, raf = 0, shown = false, lastKey = '', lastN = -1, lastT = -1, held = 0;
    let photo: HTMLImageElement | null = null, photoSent = false;
    if (imageSrc) loadImg(imageSrc).then((i) => { photo = i; }).catch(() => { if (!stop) { stop = true; onFail(); } });
    const tick = () => {
      if (stop) return;
      raf = requestAnimationFrame(tick);
      const { film: amt, geo: g, animate: anim } = live.current;
      if (!g || !r.ready()) return;
      const src = video ?? photo;
      if (!src) return;
      if (video && (video.readyState < 2 || !video.videoWidth)) return;
      // Playing: a new film picture 18 times a second. Paused: hold the grain still.
      if (anim) held = performance.now() / 1000;
      const n = Math.floor(held * FILM_FPS);
      const t = video ? video.currentTime : 0;
      const key = `${amt}|${g.vis.join(',')}|${g.asp}|${g.pxu.join(',')}`;
      const stepped = n !== lastN, moved = !anim && t !== lastT;
      if (shown && !stepped && !moved && key === lastKey) return;
      // A clip only takes a new frame when the film steps (or when it is scrubbed while paused).
      const upload = video ? stepped || moved || !shown : !photoSent;
      const sw = video ? video.videoWidth : photo!.naturalWidth, sh = video ? video.videoHeight : photo!.naturalHeight;
      if (!r.draw(src, sw, sh, g, amt, held, upload)) { stop = true; onFail(); return; }   // pixels not readable (no CORS)
      photoSent = true; lastN = n; lastT = t; lastKey = key;
      if (!shown) { shown = true; setReady(true); }
    };
    tick();
    return () => { stop = true; cancelAnimationFrame(raf); r.dispose(); };
  }, [look, filmOn, imageSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Colour grade only
  useEffect(() => {
    if (filmOn || !look) return;
    const canvas = ref.current;
    const video = canvas?.parentElement?.querySelector('video');
    if (!canvas || !video) return;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) { onFail(); return; }
    let stop = false, raf = 0, last = -1, shown = false;

    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { onFail(); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit: number) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };
    const vTex = tex(0), lTex = tex(1);
    gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0); gl.uniform1i(gl.getUniformLocation(prog, 'lut'), 1);

    loadLut(look).then((img) => {
      if (stop) return;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      const draw = () => {
        if (stop) return;
        raf = requestAnimationFrame(draw);
        if (video.readyState < 2 || !video.videoWidth) return;
        const t = video.currentTime;
        if (t === last && video.paused) return;
        last = t;
        const k = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
        const w = Math.round(video.videoWidth * k), h = Math.round(video.videoHeight * k);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
        try {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        } catch {
          stop = true; onFail(); return;   // pixels not readable (no CORS) — show the plain video
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!shown) { shown = true; setReady(true); }
      };
      draw();
    }).catch(() => onFail());

    return () => {
      stop = true; cancelAnimationFrame(raf);
      // Free the GPU context only once the canvas has really left the page —
      // React re-runs effects on the same canvas (dev), which would get a dead context back.
      setTimeout(() => { if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext(); }, 0);
    };
  }, [look, filmOn]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} aria-hidden style={{ ...style, opacity: ready ? (style.opacity ?? 1) : 0 }} />;
}
