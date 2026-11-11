import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILM_FPS, FRAG_FILM, filmAmount, filmFrame, filmGeo } from './film.ts';
import { placeLayer, type Layer, type MediaInfo } from './layout.ts';

test('film steps 18 times a second and repeats exactly', () => {
  assert.equal(FILM_FPS, 18);
  assert.equal(filmFrame(0).n, 0);
  assert.equal(filmFrame(0.99).n, 17);
  assert.equal(filmFrame(1).n, 18);
  assert.deepEqual(filmFrame(2.51), filmFrame(2.52));          // same film picture → same wobble, flicker and grain
  assert.notDeepEqual(filmFrame(2.5).weave, filmFrame(2.6).weave);
});

test('wobble and flicker stay small', () => {
  for (let i = 0; i < 400; i++) {
    const f = filmFrame(i / FILM_FPS);
    assert.ok(Math.abs(f.weave[0]) <= 2.7 && Math.abs(f.weave[1]) <= 2.4, `weave ${f.weave}`);
    assert.ok(Math.abs(f.flick) <= 0.019, `flick ${f.flick}`);
  }
});

test('the film frame is the part of the picture the layer shows', () => {
  // A 1920×1080 clip filling a 1080×1350 slide: cover-fit, centred, sides cropped.
  const L: Layer = { id: 'a', media: 'm', x: 0, y: 0, w: 1080, h: 1350 };
  const m: MediaInfo = { kind: 'video', w: 1920, h: 1080 };
  const g = filmGeo(placeLayer(L, m));
  assert.ok(Math.abs(g.vis[0] - 0.275) < 1e-9 && Math.abs(g.vis[2] - 0.725) < 1e-9);
  assert.deepEqual([g.vis[1], g.vis[3]], [0, 1]);
  assert.equal(g.asp, 0.8);
  assert.ok(Math.abs(g.pxu[0] - 1 / 2400) < 1e-12 && Math.abs(g.pxu[1] - 1 / 1350) < 1e-12);
  // Cropped edges shrink the frame, not the picture.
  const c = filmGeo(placeLayer({ ...L, inset: { l: 100, t: 50 } }, m));
  assert.ok(c.vis[0] > g.vis[0] && c.vis[1] > 0 && c.vis[2] === g.vis[2]);
});

test('off unless switched on, and only for clips and photos', () => {
  assert.equal(filmAmount({}, 'video'), 0);
  assert.equal(filmAmount({ film: true }, 'video'), 1);
  assert.equal(filmAmount({ film: true, filmAmt: 0.5 }, 'image'), 0.5);
  assert.equal(filmAmount({ film: true, filmAmt: 0 }, 'image'), 0.1);
  assert.equal(filmAmount({ film: true }, 'logo'), 0);
  assert.equal(filmAmount({ film: true }, 'cutout'), 0);
  assert.equal(filmAmount({ film: false, filmAmt: 1 }, 'video'), 0);
});

test('the shader carries every setting the renderer sends', () => {
  for (const u of ['img', 'lut', 'useLut', 'amt', 'seed', 'flick', 'asp', 'vis', 'pxu', 'weave', 'pre']) assert.match(FRAG_FILM, new RegExp(`\\b${u}\\b`));
});
