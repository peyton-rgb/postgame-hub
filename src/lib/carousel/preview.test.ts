import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREVIEW, previewLength, previewState } from './preview.ts';

test('preview timeline: profile, push, then one swipe per slide', () => {
  assert.equal(previewLength(5), 15);
  assert.deepEqual(previewState(0, 5), { push: 0, offset: 0, shown: 1 });
  assert.ok(Math.abs(previewState(PREVIEW.profile + PREVIEW.push / 2, 5).push - 0.5) < 1e-9);
  const s1 = PREVIEW.profile + PREVIEW.push + PREVIEW.first;
  assert.deepEqual(previewState(s1 - 0.01, 5), { push: 1, offset: 0, shown: 1 });
  assert.ok(Math.abs(previewState(s1 + PREVIEW.swipe / 2, 5).offset - 0.5) < 1e-9);
  assert.equal(previewState(s1 + PREVIEW.swipe + 0.1, 5).offset, 1);
  assert.deepEqual(previewState(previewLength(5), 5), { push: 1, offset: 4, shown: 5 });
  assert.equal(previewState(99, 5).offset, 4);          // never past the last slide
  assert.equal(previewState(99, 1).offset, 0);          // one-slide carousel never swipes
});

test('preview clips start when their slide arrives and never loop mid-slide', async () => {
  const { slideStart, clipAt } = await import('./preview.ts');
  const s2 = PREVIEW.profile + PREVIEW.push + PREVIEW.first;
  assert.equal(slideStart(1), PREVIEW.profile);
  assert.equal(slideStart(2), s2);
  assert.ok(Math.abs(slideStart(5) - (s2 + 3 * (PREVIEW.swipe + PREVIEW.hold))) < 1e-9);
  assert.deepEqual(clipAt(1, 2, 3), { at: 0, playing: false });          // not arrived: parked on frame 1
  assert.ok(Math.abs(clipAt(s2 + 1.5, 2, 3).at - 1.5) < 1e-9);
  // the old bug: a 3 s clip jumped back to its start at 6 s, mid-slide 2
  for (let t = s2; t < s2 + PREVIEW.swipe * 2 + PREVIEW.hold; t += 0.05)
    assert.ok(clipAt(t + 0.05, 2, 3).at >= clipAt(t, 2, 3).at, `no jump back at ${t}`);
  assert.equal(clipAt(s2 + 10, 2, 3).playing, false);                     // holds last frame
});
