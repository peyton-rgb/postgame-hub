import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoLook, cameraLook, greenShare, lookFor, needsScene, refineLook, sceneKind } from './grade.ts';

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
  assert.equal(lookFor({ grade: 'blackmagic' }, { ...fio, source: undefined }), 'blackmagic');
  assert.equal(lookFor({}, { ...fio, kind: 'image' }), null);
});

test('cameraLook: artifact clips read their camera from the label, source or key', () => {
  const v = (label: string, source?: string) => ({ kind: 'video' as const, w: 1, h: 1, label, source });
  const cases: [ReturnType<typeof v>, string, string | null][] = [
    [v('✨ s2 · A009_06290921_C704_BRAW-PREVIEW.mp4'), 'c3_x', 'blackmagic'],
    [v('✨ s3_bot · NINJAV_S001_S001_T112.MOV'), 'c3_x', 'canonstudio'],
    [v('✨ s2_bot · CK0026C226H260702_161246YM_CANON.MP4'), 'c3_x', 'btscanon'],
    [v('✨ s3_bot · C9646.MP4'), 'c3_x', 'sonystudio'],
    [v('✨ s3_bot · FAM_0259.MXF'), 'c3_x', 'sonystudio'],
    [v('✨ s5 · LWFX6_SRPOC_0261.MXF'), 'c3_x', 'sonystudio'],
    [v('✨ s5 · A004_07021015_C001.mp4'), 'c3_x', 'blackmagic'],
    [v('✨ s3_bot · shared'), 'c3_mackenzie_mgbako_s3_bot_food_C9927', 'sonystudio'],
    [v('4K · C036 (0:59)', '/home/claude/fio/ath/amari_C036.mp4'), 'g_amari_C036', 'blackmagic'],
    [v('4K · Dribbling (standing)', '/home/claude/fio/C012.mp4'), 'fv_dribble', 'blackmagic'],
    [v('✅ A004_07021042_C003_BRAW-PREVIEW (1:14)'), 'pk_x', 'blackmagic'],
    [v('✅ Ian_Jackson_SUPER8_026 (0:03)'), 'pk_ian_jackson_Ian_Jackson_SUPER8_026', null],
  ];
  for (const [m, key, want] of cases) assert.equal(cameraLook(m, key), want, m.label);
});

test("refineLook + scenes: Auto colours each clip with Andres's look for its camera", () => {
  assert.equal(refineLook('canonstudio', true, 'green'), 'canonstudio');   // Canon via Ninja: its look on any set
  assert.equal(refineLook('canonstudio', true, 'plain'), 'canonstudio');
  assert.equal(refineLook('canonstudio', true, undefined), 'canonstudio'); // no scene check needed
  assert.equal(refineLook('sonystudio', true, false), 'sonystudio');       // Sony
  assert.equal(refineLook('blackmagic', true, false), 'blackmagic');       // Blackmagic
  assert.equal(refineLook('btscanon', true, 'plain'), 'btscanon');         // Canon CK, bright interior
  assert.equal(refineLook('btscanon', true, 'green'), 'btscanon');
  assert.equal(refineLook('btscanon', true, 'dark'), 'canoncourt');        // Canon CK on the dark court set
  assert.equal(refineLook('btscanon', true, false), 'btscanon');           // no thumbnail to check
  assert.equal(refineLook('btscanon', true, undefined), null);             // not checked yet: as shot for a moment
  assert.equal(refineLook(null, true, 'dark'), null);                      // already graded / Super 8 / iPhone: left alone
  assert.equal(refineLook('btscanon', false, 'dark'), 'btscanon');         // picked by hand: kept
  assert.equal(refineLook('lift', false, 'green'), 'lift');
  assert.equal(needsScene('btscanon'), true);
  assert.equal(needsScene('canonstudio'), false);
  const px = (r: number, g: number, b: number, n: number) => Array.from({ length: n }, () => [r, g, b, 255]).flat();
  const screen = [...px(90, 170, 110, 40), ...px(200, 60, 60, 20), ...px(0, 0, 0, 40)];   // 2/3 of non-black is green
  assert.ok(greenShare(screen) > 0.6);
  const room = [...px(190, 170, 140, 50), ...px(150, 40, 40, 20), ...px(0, 0, 0, 30)];    // beige walls, red shirt
  assert.equal(greenShare(room), 0);
  assert.equal(sceneKind(screen), 'green');
  assert.equal(sceneKind(room), 'plain');
  assert.equal(sceneKind([...px(60, 52, 48, 60), ...px(0, 0, 0, 30)]), 'dark');   // dim court, black bars ignored
});
