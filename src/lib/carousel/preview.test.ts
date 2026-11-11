import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREVIEW, previewLength, previewPlan, previewState, slideClips, slideOf, slideStart, clipAt } from './preview.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('preview timeline: profile, push, then one swipe per slide', () => {
  const plan = previewPlan(5);
  assert.ok(near(previewLength(5), 15));               // no clips: the standard holds
  assert.deepEqual(previewState(0, plan), { push: 0, offset: 0, shown: 1 });
  assert.ok(near(previewState(PREVIEW.profile + PREVIEW.push / 2, plan).push, 0.5));
  const s1 = PREVIEW.profile + PREVIEW.push + PREVIEW.first;
  assert.deepEqual(previewState(s1 - 0.01, plan), { push: 1, offset: 0, shown: 1 });
  assert.ok(near(previewState(s1 + PREVIEW.swipe / 2, plan).offset, 0.5));
  assert.equal(previewState(s1 + PREVIEW.swipe + 0.1, plan).offset, 1);
  assert.deepEqual(previewState(plan.len, plan), { push: 1, offset: 4, shown: 5 });
  assert.equal(previewState(99, plan).offset, 4);                 // never past the last slide
  assert.equal(previewState(99, previewPlan(1)).offset, 0);       // one-slide carousel never swipes
});

test('preview clips start when their slide arrives and never loop mid-slide', () => {
  const plan = previewPlan(5);
  const s2 = PREVIEW.profile + PREVIEW.push + PREVIEW.first;
  assert.equal(slideStart(1, plan), PREVIEW.profile);
  assert.ok(near(slideStart(2, plan), s2));
  assert.ok(near(slideStart(5, plan), s2 + 3 * (PREVIEW.swipe + PREVIEW.hold)));
  assert.deepEqual(clipAt(1, 2, 3, plan), { at: 0, playing: false });          // not arrived: parked on frame 1
  assert.ok(near(clipAt(s2 + 1.5, 2, 3, plan).at, 1.5));
  // the old bug: a 3 s clip jumped back to its start at 6 s, mid-slide 2
  for (let t = s2; t < s2 + PREVIEW.swipe * 2 + PREVIEW.hold; t += 0.05)
    assert.ok(clipAt(t + 0.05, 2, 3, plan).at >= clipAt(t, 2, 3, plan).at, `no jump back at ${t}`);
  assert.equal(clipAt(s2 + 10, 2, 3, plan).playing, false);                     // holds last frame
});

test('a slide holds until its longest clip has played all the way through', () => {
  // slide 1: 6 s clip · slide 2: 4 s · slide 3: photos only · slide 4: 1 s (shorter than the standard hold) · slide 5: 6 s
  const clips = [6, 4, 0, 1, 6];
  const plan = previewPlan(5, clips);
  for (let k = 1; k <= 5; k++) {
    const start = slideStart(k, plan);
    const leaves = k < 5 ? slideStart(k + 1, plan) : plan.len;      // when the next swipe begins / the video ends
    const c = clips[k - 1];
    if (c) {
      // one frame before the slide leaves, the clip has already reached its last frame…
      assert.equal(clipAt(leaves - 1 / 30, k, c, plan).playing, false, `slide ${k} clip finished before the swipe`);
      // …and the slide is still fully on screen then (not mid-swipe)
      assert.equal(previewState(leaves - 1 / 30, plan).offset, k - 1, `slide ${k} still showing`);
      // and it stays exactly as long as the clip plus the beat, when that is longer than the standard hold
      const std = k === 1 ? PREVIEW.push + PREVIEW.first : PREVIEW.swipe + PREVIEW.hold;
      assert.ok(near(leaves - start, Math.max(std, c + PREVIEW.tail)), `slide ${k} length`);
    }
  }
  assert.ok(near(slideStart(4, plan) - slideStart(3, plan), PREVIEW.swipe + PREVIEW.hold));   // photo slide: unchanged
  assert.ok(near(plan.len, PREVIEW.profile + 6.3 + 4.3 + 2.6 + 2.6 + 6.3));
  // the old timing would have left slide 1 at 4.6 s with 3.6 s of its clip unplayed
  assert.ok(slideStart(2, plan) > slideStart(2, previewPlan(5)) + 3.5);
});

test('slideClips: longest visible clip per slide; hidden layers, text and photos do not count', () => {
  const media = {
    a: { kind: 'video' as const, w: 1, h: 1, dur: 20, src: 'a.mp4' },
    short: { kind: 'video' as const, w: 1, h: 1, dur: 2.5, src: 's.mp4' },
    nosrc: { kind: 'video' as const, w: 1, h: 1, dur: 20 },
    pic: { kind: 'image' as const, w: 1, h: 1, src: 'p.jpg' },
  };
  const L = (id: string, m: string, x: number, extra: object = {}) => ({ id, media: m, x, y: 0, w: 1080, h: 1350, ...extra });
  const layers = [
    L('hero', 'a', 0),                                  // slide 1, full 6 s loop
    L('b1', 'a', 1080, { h: 450, vlen: 3 }), L('b2', 'a', 1080, { y: 450, h: 450, vlen: 4.5 }),   // slide 2: longest wins
    L('p', 'pic', 2160),                                // slide 3: photo
    L('gone', 'a', 3240, { hidden: true }), L('none', 'nosrc', 3240),   // slide 4: nothing playable
    L('s', 'short', 4320),                              // slide 5: the file is only 2.5 s long
    L('far', 'a', 9000, { vlen: 2 }),                   // off the end: counts for the last slide
  ] as never[];
  assert.deepEqual(slideClips(layers, media, 5), [6, 4.5, 0, 0, 2.5]);
  assert.equal(slideOf({ x: 1000, w: 400 }, 5), 2);
  assert.equal(slideOf({ x: -900, w: 100 }, 5), 1);
});
