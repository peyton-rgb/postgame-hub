'use client';

// Draws one picture or video frame with the Super 8 film look (lib/carousel/film)
// — and, if the layer has one, its colour grade first — on the graphics chip
// (WebGL). Used live in the editor (GradeCanvas) and frame by frame when a
// preview video is recorded (PreviewExport), so both look the same.

import type { Look } from '@/lib/carousel/grade';
import { FRAG_FILM, filmFrame, type FilmGeo } from '@/lib/carousel/film';
import { VERT, loadLut } from './GradeCanvas';

/** The effect is soft by nature, so it never needs more than this many pixels on the long side. */
export const FILM_MAX_SIDE = 1600;

export type FilmRenderer = {
  /** False until the grade's LUT (if any) has loaded. */
  ready: () => boolean;
  /**
   * Draw `src` (sw×sh) for the moment `seconds`. `upload: false` re-uses the picture
   * already on the chip (a still, or a clip holding its frame between film pictures).
   * Returns false if the browser won't let us read the pixels (no CORS).
   */
  draw: (src: TexImageSource, sw: number, sh: number, geo: FilmGeo, amt: number, seconds: number, upload?: boolean) => boolean;
  dispose: () => void;
};

export function createFilmRenderer(canvas: HTMLCanvasElement, look: Look | null, preserve = false): FilmRenderer | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG_FILM));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
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
  const U = (name: string) => gl.getUniformLocation(prog, name);
  gl.uniform1i(U('img'), 0); gl.uniform1i(U('lut'), 1);
  // Take pixels as stored — no colour-profile "correction" — so stills and video match.
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  const u = { useLut: U('useLut'), amt: U('amt'), seed: U('seed'), flick: U('flick'), asp: U('asp'), vis: U('vis'), pxu: U('pxu'), weave: U('weave') };
  // The LUT sampler needs something bound even when there is no grade.
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
  let lutReady = !look, dead = false, loaded = false;
  if (look) loadLut(look).then((img) => {
    if (dead) return;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    lutReady = true;
  }).catch(() => { lutReady = true; look = null; });   // grade missing: still show the film look

  return {
    ready: () => lutReady,
    draw(src, sw, shh, geo, amt, seconds, upload = true) {
      if (dead || !sw || !shh) return true;
      const k = Math.min(1, FILM_MAX_SIDE / Math.max(sw, shh));
      const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(shh * k));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); upload = true; }
      if (upload || !loaded) {
        try {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
          loaded = true;
        } catch { return false; }
      }
      const fr = filmFrame(seconds);
      gl.uniform1f(u.useLut, look && lutReady ? 1 : 0);
      gl.uniform1f(u.amt, amt); gl.uniform1f(u.seed, fr.seed); gl.uniform1f(u.flick, fr.flick); gl.uniform1f(u.asp, geo.asp);
      gl.uniform4f(u.vis, geo.vis[0], geo.vis[1], geo.vis[2], geo.vis[3]);
      gl.uniform2f(u.pxu, geo.pxu[0], geo.pxu[1]); gl.uniform2f(u.weave, fr.weave[0], fr.weave[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    },
    dispose() {
      dead = true;
      // Free the GPU context only once the canvas has really left the page (React re-runs effects on the same canvas in dev).
      setTimeout(() => { if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext(); }, 0);
    },
  };
}
