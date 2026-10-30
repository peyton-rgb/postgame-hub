import { test } from "node:test";
import assert from "node:assert/strict";
import { hamming, pickBestPhotos, pickLatestVideo, versionOf } from "./pick-best.ts";

test("hamming", () => {
  assert.equal(hamming("0000000000000000", "0000000000000000"), 0);
  assert.equal(hamming("ffffffffffffffff", "0000000000000000"), 64);
  assert.equal(hamming("0000000000000001", "0000000000000003"), 1);
});

test("near-copies collapse to the best one", () => {
  const ids = pickBestPhotos([
    { id: "a", name: "a.jpg", hash: "f0f0f0f0f0f0f0f0", quality: 5 },
    { id: "a2", name: "a2.jpg", hash: "f0f0f0f0f0f0f0f1", quality: 9 }, // copy of a, sharper
    { id: "b", name: "b.jpg", hash: "0f0f0f0f0f0f0f0f", quality: 3 },
    { id: "s", name: "Screenshot 2026.png", hash: "ffff0000ffff0000", quality: 99 },
  ]);
  assert.deepEqual(ids, ["a2", "b"]);
});

test("a mirror-flipped Scrubbed copy replaces its original", () => {
  const ids = pickBestPhotos([
    { id: "orig", name: "IMG_2027.jpeg", hash: "aaaaaaaaaaaaaaaa", flipHash: "5555555555555555", quality: 9 },
    { id: "scrub", name: "Otis_Scrubbed_1.jpg", hash: "5555555555555555", flipHash: "aaaaaaaaaaaaaaaa", quality: 8 },
    { id: "other", name: "IMG_2025.jpeg", hash: "ff00ff00ff00ff00", flipHash: "00ff00ff00ff00ff", quality: 7 },
  ]);
  assert.deepEqual(ids, ["scrub", "other"]);
});

test("caps at max and tops up to min with unmeasured photos", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    name: `${i}.jpg`,
    hash: (i * 0x1111).toString(16).padStart(4, "0").repeat(4).slice(0, 16),
    quality: i,
  }));
  assert.ok(pickBestPhotos(many, 10).length <= 10);
  const few = pickBestPhotos([
    { id: "x", name: "x.jpg", hash: "1234567812345678", quality: 1 },
    { id: "y", name: "y.jpg", hash: null, quality: 0 },
    { id: "z", name: "z.jpg", hash: null, quality: 0 },
  ]);
  assert.deepEqual(few, ["x", "y", "z"]);
});

test("latest video: highest version beats raw clips and older versions", () => {
  assert.equal(versionOf("Yaseen V2 w Intro.mp4"), 2);
  assert.equal(versionOf("Tyus_Wills_Scrubbed_V2_w_Intro.mp4"), 2);
  assert.equal(versionOf("copy_A9E312AA-81CB.mov"), null);
  assert.equal(
    pickLatestVideo([
      { id: "raw", name: "copy_ABC - Matt.mov", modifiedTime: "2026-10-01T00:00:00Z" },
      { id: "v1", name: "Yaseen (V1).mov", modifiedTime: "2026-08-19T00:00:00Z" },
      { id: "v2", name: "Yaseen V2 w Intro.mp4", modifiedTime: "2026-09-17T00:00:00Z" },
    ]),
    "v2",
  );
  assert.equal(
    pickLatestVideo([
      { id: "old", name: "a.mov", modifiedTime: "2026-08-01T00:00:00Z" },
      { id: "new", name: "b.mov", modifiedTime: "2026-09-01T00:00:00Z" },
    ]),
    "new",
  );
  assert.equal(pickLatestVideo([]), null);
  assert.equal(
    pickLatestVideo([
      { id: "raw", name: "62EF0B53-4511-49FD-B48B-528EC63C1646 - Xavier Harris.mp4", modifiedTime: "2026-10-01T00:00:00Z" },
      { id: "edit", name: "Xavier Harris No End Card .mp4", modifiedTime: "2026-09-01T00:00:00Z" },
    ]),
    "edit",
  );
});
