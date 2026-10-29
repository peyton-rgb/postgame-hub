// src/lib/pick-best-measure.ts
// ─────────────────────────────────────────────────────────────
// Server-only image measurements for "Pick best" (uses sharp).
//   dHash()   — 64-bit fingerprint: shrink to 9×8 greyscale and record,
//               for each pixel, whether it's brighter than its right-hand
//               neighbour. Near-identical photos give near-identical bits.
//   quality() — sharpness (spread of an edge-detection filter), halved for
//               very dark or blown-out frames. Log-scaled so one hyper-
//               detailed shot doesn't dwarf everything else.
// ─────────────────────────────────────────────────────────────

import sharp from "sharp";

/** Pass flip=true for the mirrored fingerprint (see MeasuredPhoto.flipHash). */
export async function dHash(img: Buffer, flip = false): Promise<string> {
  let pipeline = sharp(img).rotate();
  if (flip) pipeline = pipeline.flop();
  const px = await pipeline.greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let hex = "";
  for (let row = 0; row < 8; row++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) {
      byte = (byte << 1) | (px[row * 9 + col] > px[row * 9 + col + 1] ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export async function quality(img: Buffer): Promise<number> {
  const base = sharp(img).rotate().greyscale().resize(320, 320, { fit: "inside" });
  const [edges, tone] = await Promise.all([
    base.clone().convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] }).stats(),
    base.clone().stats(),
  ]);
  const sharpness = edges.channels[0].stdev;
  const mean = tone.channels[0].mean; // 0–255
  const exposure = mean < 40 || mean > 225 ? 0.5 : 1;
  return Math.log1p(sharpness) * exposure;
}
