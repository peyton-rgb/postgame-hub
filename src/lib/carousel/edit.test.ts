import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDrag, startBodyDrag, act, isBg, margins } from './edit.ts';
import type { Layout } from './layout.ts';

const media = {
  bg: { kind: 'image' as const, w: 3840, h: 2160 },
  card: { kind: 'image' as const, w: 1920, h: 1080, cutout: 'cut' },
  cut: { kind: 'cutout' as const, w: 1920, h: 1080 },
  logo: { kind: 'logo' as const, w: 2078, h: 1027 },
};
const base = (): Layout => ({
  canvas: { w: 5400, h: 1350, slides: 5, duration: 6 },
  guides: { h: [], v: [], show: true, lock: false },
  layers: [
    { id: 'bg', media: 'bg', x: 0, y: 0, w: 1080, h: 1350, zoom: 1.5 },
    { id: 'card', media: 'card', x: 1200, y: 300, w: 600, h: 400 },
    { id: 'cut', media: 'cut', x: 2300, y: 300, w: 600, h: 400 },
    { id: 'logo', media: 'logo', x: 4600, y: 547, w: 520, h: 257 },
  ],
});

test('dragging a background slides the picture; a card moves the box', () => {
  const L = base();
  assert.equal(isBg(L.layers[0], media), true);
  assert.equal(startBodyDrag(L.layers[0], media, false, false).mode, 'pan');
  assert.equal(startBodyDrag(L.layers[1], media, false, false).mode, 'move');
  assert.equal(startBodyDrag(L.layers[1], media, true, false).mode, 'pan'); // Reframe mode
});

test('a card snaps its left edge to the slide line within 12 screen pixels', () => {
  const L = base();
  const r = applyDrag({ mode: 'move', id: 'card', o: { x: 1200, y: 300 } }, L, media, -110, 0, { scale: 0.2, snap: true })!;
  assert.equal(r.layer.x, 1080); assert.equal(r.gx, 1080);
  const free = applyDrag({ mode: 'move', id: 'card', o: { x: 1200, y: 300 } }, L, media, -110, 0, { scale: 0.2, snap: false })!;
  assert.equal(free.layer.x, 1090);
});

test('a card dropped near its cutout locks onto it exactly', () => {
  const L = base();
  const r = applyDrag({ mode: 'move', id: 'card', o: { x: 1200, y: 300 } }, L, media, 1080, 30, { scale: 0.2, snap: true })!;
  assert.equal(r.paired, true);
  assert.deepEqual([r.layer.x, r.layer.y, r.layer.w, r.layer.h], [2300, 300, 600, 400]);
});

test('logos keep their shape when resized; cropping an edge never goes below 30px', () => {
  const L = base();
  const r = applyDrag({ mode: 'resize', id: 'logo', corner: 'se', o: { x: 4600, y: 547, w: 520, h: 257 }, ratio: 520 / 257 }, L, media, 300, 10, { scale: 0.2, snap: false })!;
  assert.ok(Math.abs(r.layer.w / r.layer.h - 520 / 257) < 0.02);
  const e = applyDrag({ mode: 'edge', id: 'card', edge: 'w', o: { l: 0, t: 0, r: 0, b: 0 } }, L, media, 900, 0, { scale: 0.2, snap: false })!;
  assert.equal(e.layer.inset!.l, 570);
});

test('panel actions: fill slide, duplicate, delete', () => {
  const L = base();
  const f = act(L, 'card', 'fill');
  assert.deepEqual(f.layout.layers[1], { ...L.layers[1], x: 1080, w: 1080, y: 0, h: 1350 });
  const d = act(L, 'card', 'dup');
  assert.equal(d.layout.layers.length, 5); assert.equal(d.layout.layers[2].x, 1240); assert.equal(d.select, d.layout.layers[2].id);
  assert.equal(act(L, 'card', 'del').layout.layers.length, 3);
  assert.equal(L.layers.length, 4, 'the original layout is never changed in place');
});

test('equal-gap measurement turns on when both sides match', () => {
  assert.equal(margins({ x: 1180, y: 100, w: 880, h: 1150 }).hEq, true);
  assert.equal(margins({ x: 1180, y: 100, w: 800, h: 1150 }).hEq, false);
});
