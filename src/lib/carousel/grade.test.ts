import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoLook, lookFor } from './grade.ts';

test('autoLook: camera → look, per the grade README', () => {
  const cases: [string, string | null][] = [
    ['LWFX6_SRPOC_0255.mp4', 'sonystudio'], ['LWFX6_SRPOC_0255.MXF', 'sonystudio'], ['FAM_0241.MXF', 'sonystudio'],
    ['C0045.MP4', 'sonystudio'], ['C9536.MP4', 'sonystudio'],
    ['A004_07021042_C003_BRAW-PREVIEW.mp4', 'blackmagic'],
    ['CK0025C688H260629_1527289D_CANON.MP4', 'btscanon'],
    ['NINJAV_S001_S001_T013.MOV', 'canonstudio'],
    ['Ian_Jackson_SUPER8_026.mp4', null], ['SUPER8_030.mp4', null], ['IMG_4411.MOV', null],
    ['LWFX6_SRPOC_0255_GRADED_1080.mp4', null], ['hannah-hidalgo-signature-animation.mp4', null], ['L1580872.jpg', null],
  ];
  for (const [n, want] of cases) assert.equal(autoLook(n), want, n);
});

test('lookFor: only Frame.io videos on auto; overrides win', () => {
  const fio = { kind: 'video' as const, w: 1, h: 1, label: 'C9536.MP4', source: 'frameio' };
  assert.equal(lookFor({}, fio), 'sonystudio');
  assert.equal(lookFor({ grade: 'off' }, fio), null);
  assert.equal(lookFor({ grade: 'canoncourt' }, fio), 'canoncourt');
  assert.equal(lookFor({}, { ...fio, source: undefined }), null);            // artifact-cut clip: left alone
  assert.equal(lookFor({ grade: 'blackmagic' }, { ...fio, source: undefined }), 'blackmagic');
  assert.equal(lookFor({}, { ...fio, kind: 'image' }), null);
});
