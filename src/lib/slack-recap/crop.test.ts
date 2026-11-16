// Framed recap crops (cropToSubject): 4:5, centred on the athlete, never
// cutting their head off. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { cropToSubject } from "./covers.ts";

/** A 1000×1500 grey image with a white "athlete" block at the given box (fractions). */
async function scene(box: [number, number, number, number]): Promise<Buffer> {
  const W = 1000, H = 1500;
  const [l, t, r, b] = box;
  const block = await sharp({
    create: { width: Math.round((r - l) * W), height: Math.round((b - t) * H), channels: 3, background: "#ffffff" },
  }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: "#404040" } })
    .composite([{ input: block, left: Math.round(l * W), top: Math.round(t * H) }])
    .jpeg()
    .toBuffer();
}

/** Bounding box of the bright pixels in a jpeg, as fractions. */
async function brightBox(buf: Buffer): Promise<[number, number, number, number]> {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  let l = info.width, t = info.height, r = 0, b = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[y * info.width + x] > 200) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  return [l / info.width, t / info.height, r / info.width, b / info.height];
}

test("crop is 4:5 and centres a small, off-centre athlete", async () => {
  const box: [number, number, number, number] = [0.1, 0.5, 0.3, 0.8];
  const out = await cropToSubject(await scene(box), box);
  const m = await sharp(out).metadata();
  assert.ok(Math.abs(m.width! / m.height! - 0.8) < 0.01);
  const [l, t, r, b] = await brightBox(out);
  assert.ok(Math.abs((l + r) / 2 - 0.5) < 0.03, `horizontal centre ${(l + r) / 2}`);
  assert.ok(Math.abs((t + b) / 2 - 0.5) < 0.03, `vertical centre ${(t + b) / 2}`);
  assert.ok(r - l <= 0.62, "athlete narrow enough to survive a 9:16 card");
});

test("an athlete taller than the crop keeps their head in", async () => {
  const box: [number, number, number, number] = [0.3, 0.05, 0.7, 1.0];
  const out = await cropToSubject(await scene(box), box);
  const [, t] = await brightBox(out);
  assert.ok(t > 0.005 && t < 0.08, `top of athlete at ${t}`);
});

test("no box → resized only, never blind-cropped", async () => {
  const out = await cropToSubject(await scene([0.4, 0.4, 0.6, 0.6]), null);
  const m = await sharp(out).metadata();
  assert.ok(Math.abs(m.width! / m.height! - 1000 / 1500) < 0.01);
});

import { parseAiJson } from "./covers.ts";

test("AI reply with nested boxes, prose and a code fence parses whole", () => {
  const reply =
    'Here you go:\n```json\n{"cover": 3, "photos": [2, 5], "boxes": {"3": [0.2, 0.1, 0.7, 0.95], "2": [0.3, 0.2, 0.6, 0.9]}, "reason": "face visible"}\n```';
  const j = parseAiJson(reply);
  assert.equal(j.cover, 3);
  assert.deepEqual(j.photos, [2, 5]);
  assert.deepEqual(j.boxes["2"], [0.3, 0.2, 0.6, 0.9]);
  assert.equal(j.reason, "face visible");
});

test("a reply with no JSON throws (so the build reports it)", () => {
  assert.throws(() => parseAiJson("sorry, I can't help with that"));
});
