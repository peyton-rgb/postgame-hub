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
