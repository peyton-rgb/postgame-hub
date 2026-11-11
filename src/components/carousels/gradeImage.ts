'use client';

// Still images (picker thumbnails, timeline frame grids, slide previews)
// graded with the same LUT maths as the live video (GradeCanvas): one shared
// offscreen WebGL canvas, results cached as blob URLs for the visit. Frame.io's
// image hosts allow this (CORS); anything that fails just keeps the original.

import { useEffect, useState } from 'react';
import { sceneKind, type Look, type Scene } from '@/lib/carousel/grade';
import { FRAG, VERT, loadLut } from './GradeCanvas';

type GL = { gl: WebGLRenderingContext; canvas: HTMLCanvasElement; vTex: WebGLTexture; lTex: WebGLTexture; lutOf: Look | null };
let shared: GL | null | undefined;

function setup(): GL | null {
  if (shared !== undefined) return shared;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return (shared = null);
  const sh = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return (shared = null);
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = (unit: number) => {
    const t = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const vTex = tex(0), lTex = tex(1);
  gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0); gl.uniform1i(gl.getUniformLocation(prog, 'lut'), 1);
  // Take pixels as stored — no colour-profile/gamma "correction" — so stills grade like video does.
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  return (shared = { gl, canvas, vTex, lTex, lutOf: null });
}

const imgFrom = (src: string, cors: boolean) => new Promise<HTMLImageElement>((res, rej) => {
  const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src;
});
// If the browser already cached this picture from a plain <img> (no CORS), the
// CORS load fails off that cached copy — so fetch a fresh one past the cache.
export async function loadImg(url: string) {
  try { return await imgFrom(url, true); } catch {
    const blob = await (await fetch(url, { mode: 'cors', cache: 'reload' })).blob();
    const local = URL.createObjectURL(blob);
    try { return await imgFrom(local, false); } finally { setTimeout(() => URL.revokeObjectURL(local), 0); }
  }
}

// One image at a time through the shared canvas.
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<string | null>>();

export function gradeImage(url: string, look: Look, maxSide = 1024): Promise<string | null> {
  const key = `${look}|${maxSide}|${url}`;
  let p = cache.get(key);
  if (p) return p;
  p = (queue = queue.then(async () => {
    try {
      const g = setup(); if (!g) return null;
      const [img, lut] = await Promise.all([loadImg(url), loadLut(look)]);
      const { gl, canvas } = g;
      if (g.lutOf !== look) {
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.lTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, lut); g.lutOf = look;
      }
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k)); canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.vTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      return blob ? URL.createObjectURL(blob) : null;
    } catch { return null; }
  }) as Promise<string | null>);
  cache.set(key, p);
  return p;
}

/** The graded version of `url` once it's ready; the original until then (or if grading fails / look is null). */
export function useGraded(url: string | null | undefined, look: Look | null, maxSide = 1024): string | null {
  const [out, setOut] = useState<{ key: string; url: string } | null>(null);
  const key = `${look}|${maxSide}|${url}`;
  useEffect(() => {
    if (!url || !look) return;
    let live = true;
    gradeImage(url, look, maxSide).then((u) => { if (live && u) setOut({ key, url: u }); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!url) return null;
  return look && out?.key === key ? out.url : url;
}

// ---- Scene check: is this clip's thumbnail green screen, a dark set, or neither? ----
const scenes = new Map<string, Promise<Scene>>();
const sceneDone = new Map<string, Scene>();
export function sceneOf(url: string): Promise<Scene> {
  let p = scenes.get(url);
  if (!p) {
    p = loadImg(url).then((img) => {
      const c = document.createElement('canvas'); c.width = 96; c.height = Math.max(1, Math.round(96 * img.naturalHeight / img.naturalWidth));
      const x = c.getContext('2d')!; x.drawImage(img, 0, 0, c.width, c.height);
      return sceneKind(x.getImageData(0, 0, c.width, c.height).data);
    }).catch((): Scene => 'plain');
    p.then((g) => sceneDone.set(url, g));
    scenes.set(url, p);
  }
  return p;
}

/** The scene for each url (undefined while checking). */
export function useScenes(urls: (string | null | undefined)[]): Record<string, Scene | undefined> {
  const list = urls.filter((u): u is string => !!u);
  const key = list.join('|');
  const [, bump] = useState(0);
  useEffect(() => {
    let live = true;
    for (const u of list) if (!sceneDone.has(u)) sceneOf(u).then(() => { if (live) bump((n) => n + 1); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const out: Record<string, Scene | undefined> = {};
  for (const u of list) out[u] = sceneDone.get(u);
  return out;
}
