import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeLayer, visRect, vlenOf, filterOf, clipRange, type Layer } from './layout.ts';

// Billy's top-left card, straight from his saved layout.
const card: Layer = { id: 'card_vr7hh', media: 'f', x: 614, y: -294, w: 3271, h: 2090, cx: 0.7266686354050578, cy: 1, zoom: 1, inset: { b: 451, l: 294, r: 618, t: 294 }, shadow: true };

test('cropped card frame matches the artifact', () => {
  const p = placeLayer(card, { kind: 'image', w: 3840, h: 2160 });
  assert.deepEqual(p.frame, { left: 908, top: 0, width: 2359, height: 1345 });
  assert.equal(p.shadowBox, true);
});

test('seam split keeps one side of the nearest slide edge', () => {
  const seam: Layer = { id: 's', media: 'f', x: 4040, y: 850, w: 560, h: 440, clip: 'right' };
  assert.deepEqual(clipRange(seam), [280, 560]);
  assert.deepEqual(visRect({ ...seam, clip: 'left' }), { x0: 0, y0: 0, x1: 280, y1: 440 });
});

test('clip length clamps to the 6s loop and the source length', () => {
  assert.equal(vlenOf({ id: 'v', media: 'm', x: 0, y: 0, w: 1, h: 1, vin: 101.375, vlen: 6 }, { kind: 'video', w: 1, h: 1, dur: 174.125 }), 6);
  assert.equal(vlenOf({ id: 'v', media: 'm', x: 0, y: 0, w: 1, h: 1, vin: 3 }, { kind: 'video', w: 1, h: 1, dur: 5 }), 2);
});

test('black and white, dimming and blur become one CSS filter; logos stay untouched', () => {
  assert.equal(filterOf({ id: 'b', media: 'm', x: 0, y: 0, w: 1, h: 1, bw: true, bright: 0.5, blur: 2 }, { kind: 'image', w: 1, h: 1 }), 'brightness(0.5) contrast(1) saturate(0) blur(2px)');
  assert.equal(filterOf({ id: 'l', media: 'm', x: 0, y: 0, w: 1, h: 1, bw: true }, { kind: 'logo', w: 1, h: 1 }), 'none');
});
