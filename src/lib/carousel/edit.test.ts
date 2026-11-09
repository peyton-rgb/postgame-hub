import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDrag, startBodyDrag, act, isBg, margins, moveLayerTo, swapMedia } from './edit.ts';
import type { Layout } from './layout.ts';

const media = {
  bg: { kind: 'image' as const, w: 3840, h: 2160 },
  card: { kind: 'image' as const, w: 1920, h: 1080, cutout: 'cut' },
  cut: { kind: 'cutout' as const, w: 1920, h: 1080 },
  logo_white: { kind: 'logo' as const, w: 2078, h: 1027 },
};
const base = (): Layout => ({
  canvas: { w: 5400, h: 1350, slides: 5, duration: 6 },
  guides: { h: [], v: [], show: true, lock: false },
  layers: [
    { id: 'bg', media: 'bg', x: 0, y: 0, w: 1080, h: 1350, zoom: 1.5 },
    { id: 'card', media: 'card', x: 1200, y: 300, w: 600, h: 400 },
    { id: 'cut', media: 'cut', x: 2300, y: 300, w: 600, h: 400 },
    { id: 'logo', media: 'logo_white', x: 4600, y: 547, w: 520, h: 257 },
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

import { setSection, zoomRange, newCard } from './edit.ts';
test('clip sections stay 1–6s, inside the clip, on whole frames', () => {
  assert.deepEqual(setSection(174.125, 101.375, 9), { vin: 101.375, vlen: 6 });
  assert.deepEqual(setSection(10, 9.5, 3), { vin: 7, vlen: 3 });
  assert.deepEqual(setSection(10, -2, 0.2), { vin: 0, vlen: 1 });
  assert.deepEqual(zoomRange(174.125, 101.375, 6), [92.375, 116.375]);
});
test('a new card lands centred on the chosen slide, under the logo', () => {
  const L = base();
  const r = newCard(L, 'fio_x', { kind: 'video', w: 1920, h: 1080 }, 'C001', 2);
  const c = r.layout.layers.find((l) => l.id === r.id)!;
  assert.deepEqual([c.x, c.w, c.h], [2160 + 540 - 340, 680, 383]);
  assert.equal(r.layout.layers[r.layout.layers.length - 1].id, 'logo');
});

import { startGroup, applyGroup, makeCutout, pairOf, snapGuide, newText } from './edit.ts';
test('group move keeps relative positions; group resize scales everything by one factor', () => {
  const L = base();
  const m = applyGroup(startGroup(L, ['card', 'cut'], 'gmove'), L, 37, 0, { scale: 0.2, snap: false });
  assert.deepEqual(m.layout.layers.slice(1, 3).map((l) => l.x), [1237, 2337]);
  const r = applyGroup(startGroup(L, ['card', 'cut'], 'gresize', 'se'), L, 1700, 0, { scale: 0.2, snap: false });
  const [a, b] = r.layout.layers.slice(1, 3);
  assert.equal(a.x, 1200); assert.equal(a.w, 1200); assert.equal(b.x, 3400); assert.equal(b.w, 1200);
});
test('make cutout copy lines up exactly on top and both stay selected; pair finds it', () => {
  const L = base();
  const r = makeCutout(L, 'card', media, false)!;
  const c = r.layout.layers[2];
  assert.equal(c.media, 'cut'); assert.deepEqual([c.x, c.y, c.w, c.h], [1200, 300, 600, 400]);
  assert.deepEqual(pairOf(r.layout, 'card'), ['card', c.id]);
  assert.equal(makeCutout(L, 'bg', media, true), null, 'no cutout file, no button');
});
test('guides snap to slide edges and centres; new text is centred on its slide', () => {
  assert.equal(snapGuide(base(), 'v', 1625, 0.2), 1620);
  assert.equal(snapGuide(base(), 'v', 1810, 0.2), 1800, 'snaps to a card edge');
  assert.equal(snapGuide(base(), 'v', 1700, 0.2), 1700);
  const t = newText(base(), 1);
  assert.equal(t.layout.layers.at(-1)!.x, 1620);
});

test('moveLayerTo: front-first index, everything else keeps its order', () => {
  const L = (id: string) => ({ id, media: 'bg', x: 0, y: 0, w: 10, h: 10 });
  const lay = { ...base(), layers: ['a', 'b', 'c', 'd'].map(L) } as Layout; // shown: d c b a
  const ids = (l: Layout) => l.layers.map((x) => x.id).join('');
  assert.equal(ids(moveLayerTo(lay, 'a', 0)), 'bcda');   // back-most to front
  assert.equal(ids(moveLayerTo(lay, 'd', 3)), 'dabc');   // front to back
  assert.equal(ids(moveLayerTo(lay, 'b', 1)), 'acbd');   // into second place
  assert.equal(ids(moveLayerTo(lay, 'c', 99)), 'cabd');  // past the end clamps
  assert.equal(moveLayerTo(lay, 'zz', 0), lay);          // unknown id: unchanged
  assert.equal(lay.layers.length, 4);                    // original untouched
});

test('swapMedia keeps frame, crop edges, zoom, look and order; resets focus and clip timing', () => {
  const lay = { ...base(), layers: [
    { id: 'a', media: 'bg', x: 0, y: 0, w: 1080, h: 1350 },
    { id: 'v', name: 'Old clip', media: 'old', x: 100, y: 200, w: 600, h: 400, inset: { l: 20 }, zoom: 1.4, cx: 0.2, cy: 0.9, bw: true, bright: 1.2, vin: 3, vlen: 2 },
    { id: 't', type: 'text' as const, media: '', text: 'HI', x: 0, y: 0, w: 10, h: 10 },
  ] } as Layout;
  const out = swapMedia(lay, 'v', 'fio_new', 'C9971');
  const v = out.layers[1];
  assert.deepEqual([v.media, v.name, v.x, v.y, v.w, v.h, v.zoom, v.bw, v.bright], ['fio_new', 'C9971', 100, 200, 600, 400, 1.4, true, 1.2]);
  assert.deepEqual(v.inset, { l: 20 });
  assert.deepEqual([v.cx, v.cy, v.vin, v.vlen], [0.5, 0.5, undefined, undefined]);
  assert.deepEqual(out.layers.map((l) => l.id), ['a', 'v', 't']);
  assert.equal(swapMedia(lay, 't', 'x', 'x').layers[2].media, '');   // text layers are left alone
  assert.equal(lay.layers[1].media, 'old');                           // original untouched
});
