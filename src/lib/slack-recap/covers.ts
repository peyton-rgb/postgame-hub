// src/lib/slack-recap/covers.ts
// ─────────────────────────────────────────────────────────────
// Picks the cover (thumbnail) for an athlete's video, and the athlete's photo,
// the way a person would: the athlete clearly visible, ideally with the
// product or branding. Never a blurry, black, text-only or screen-recording
// frame.
//
//   1. Pull ~6 small stills from evenly spaced points in the video (ffmpeg).
//   2. Add small versions of up to 4 photos from the athlete's folder.
//   3. Ask a vision model which is the best cover, and which is the best photo.
//   4. If the AI call fails, fall back to the first still — never no cover.
//
// ffmpeg is the @ffmpeg-installer/linux-x64 binary, located by path rather
// than through @ffmpeg-installer/ffmpeg's index.js (its dynamic require() of
// the platform package.json breaks once webpack bundles it). It is pointed at
// a local copy of the video, not the URL: this build segfaults reading https.
// ─────────────────────────────────────────────────────────────

import { execFile } from "child_process";
import { accessSync, chmodSync, constants, copyFileSync, existsSync } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

// "claude-sonnet-5" (the old default) isn't a model this account can call, so
// every pick silently fell back to folder order until 2026-11-16 — Lexi's
// silhouette and Nate's shoe-only hero on Ghost Max 4. claude-sonnet-4-6 is
// the vision model the pitch generator already uses successfully.
const COVER_MODEL = process.env.RECAP_COVER_MODEL || "claude-sonnet-4-6";
const CANDIDATE_WIDTH = 384;
const COVER_WIDTH = 1080;
const FRAME_POINTS = [0.08, 0.24, 0.4, 0.56, 0.72, 0.9];

export type Candidate =
  | { kind: "frame"; t: number; small: Buffer }
  | { kind: "photo"; key: string; small: Buffer };

export interface CoverChoice {
  /** Index into the candidates for the video's cover. */
  cover: number;
  /** Index (into the candidates, kind "photo") of the athlete's best photo, or null. */
  photo: number | null;
  /** Candidate indexes (kind "photo") of the photos to use, best first, at most
   *  MAX_RECAP_PHOTOS, no near-duplicates. Empty when there are no photos. */
  photos: number[];
  /** True when the AI picked; false when this is the fallback. */
  judged: boolean;
  /** Why the AI didn't pick, when judged is false. */
  error?: string;
  /** Where the athlete is in each chosen image (cover + photos), keyed by
   *  candidate index: [left, top, right, bottom] as 0–1 fractions. Used to
   *  crop a copy centred on the athlete for the recap cards. */
  boxes?: Record<number, Box>;
}

/** [left, top, right, bottom], each a 0–1 fraction of the image. */
export type Box = [number, number, number, number];

/** Card crops are 4:5 — they sit in 9:16, 4:5 and 1:1 cards without losing the athlete. */
const CROP_RATIO = 4 / 5;
/** The athlete fills at most this much of the crop's height / width (room to breathe, and
 *  narrow enough to survive a 9:16 card trimming the sides of a 4:5 crop). */
const SUBJECT_MAX_H = 0.86;
const SUBJECT_MAX_W = 0.6;

function cleanBox(v: unknown): Box | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const n = v.map(Number);
  if (n.some((x) => !Number.isFinite(x))) return null;
  // Accept 0–100 percentages too.
  const f = n.some((x) => x > 1.5) ? n.map((x) => x / 100) : n;
  const [l, t, r, b] = f.map((x) => Math.min(1, Math.max(0, x)));
  if (r - l < 0.02 || b - t < 0.02) return null;
  return [l, t, r, b];
}

/**
 * A copy of `buf` cropped to 4:5 around the athlete's box, centred on them,
 * as a ≤1080px-wide jpeg. With no box, the photo is only resized — never a
 * blind crop that could cut the athlete off.
 */
export async function cropToSubject(buf: Buffer, box: Box | null | undefined): Promise<Buffer> {
  const img = sharp(buf).rotate();
  const meta = await img.metadata();
  // .rotate() swaps width/height for portrait EXIF orientations.
  const swap = (meta.orientation || 1) >= 5;
  const W = (swap ? meta.height : meta.width) || 0;
  const H = (swap ? meta.width : meta.height) || 0;
  const out = (s: sharp.Sharp) => s.resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
  if (!box || !W || !H) return out(img);

  const [l, t, r, b] = box;
  const sw = (r - l) * W, sh = (b - t) * H;
  const cx = ((l + r) / 2) * W, cy = ((t + b) / 2) * H;
  let ch = Math.max(sh / SUBJECT_MAX_H, sw / SUBJECT_MAX_W / CROP_RATIO);
  let cw = ch * CROP_RATIO;
  if (cw > W) { cw = W; ch = cw / CROP_RATIO; }
  if (ch > H) { ch = H; cw = ch * CROP_RATIO; }
  const left = Math.round(Math.min(Math.max(cx - cw / 2, 0), W - cw));
  // Centre on the athlete — but if they're taller than the crop, keep their
  // head in and lose the feet instead (a cut-off head is never acceptable).
  const headroom = t * H - 0.04 * ch;
  const top = Math.round(Math.min(Math.max(Math.min(cy - ch / 2, headroom), 0), H - ch));
  return out(sharp(await img.toBuffer()).extract({ left, top, width: Math.round(cw), height: Math.round(ch) }));
}

/** Recap content rule (Peyton, 2026-11-16): 1 video + 3–10 of the best photos. */
export const MIN_RECAP_PHOTOS = 3;
export const MAX_RECAP_PHOTOS = 10;

/**
 * Perceptual "difference hash": a 64-bit fingerprint that barely changes
 * between near-identical shots (burst frames, re-exports, light edits).
 * Two photos whose hashes differ in ≤ NEAR_DUPLICATE_BITS bits count as the
 * same picture.
 */
export const NEAR_DUPLICATE_BITS = 6;

export async function dHash(buf: Buffer): Promise<string | null> {
  try {
    const px = await sharp(buf).rotate().grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
    let bits = "";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
    return BigInt("0b" + bits).toString(16).padStart(16, "0");
  } catch {
    return null;
  }
}

export function hashDistance(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) {
    n += Number(x & BigInt(1));
    x >>= BigInt(1);
  }
  return n;
}

let resolvedFfmpeg: string | null = null;

function ffmpegPath(): string {
  if (resolvedFfmpeg) return resolvedFfmpeg;
  const candidates = [
    process.env.FFMPEG_PATH,
    join(process.cwd(), "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg"),
    "/var/task/node_modules/@ffmpeg-installer/linux-x64/ffmpeg",
  ].filter(Boolean) as string[];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`ffmpeg binary not found (looked in ${candidates.join(", ")})`);
  try {
    accessSync(found, constants.X_OK);
    resolvedFfmpeg = found;
  } catch {
    // The package's postinstall chmod may not have run (npm allowScripts), and
    // the deployed filesystem is read-only — run a copy from /tmp instead.
    const tmpCopy = join(tmpdir(), "ffmpeg");
    if (!existsSync(tmpCopy)) copyFileSync(found, tmpCopy);
    chmodSync(tmpCopy, 0o755);
    resolvedFfmpeg = tmpCopy;
  }
  return resolvedFfmpeg;
}

function ffmpeg(args: string[]): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath(),
      args,
      { encoding: "buffer", maxBuffer: 32 * 1024 * 1024, timeout: 60_000 },
      (err, stdout, stderr) => {
        const errText = Buffer.isBuffer(stderr) ? stderr.toString() : String(stderr || "");
        // `ffmpeg -i file` with no output always "fails" — the caller reads stderr.
        if (err && !(args.length === 3 && args[1] === "-i")) return reject(new Error(errText.slice(-400) || err.message));
        resolve({ stdout: stdout as Buffer, stderr: errText });
      },
    );
  });
}

/** A local working copy of a video, removed by `cleanup()`. */
export async function localVideo(url: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "recap-cover-"));
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`video download ${res.status}`);
  const path = join(dir, "video");
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

async function durationOf(path: string): Promise<number> {
  const { stderr } = await ffmpeg(["-hide_banner", "-i", path]);
  const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export async function frameAt(path: string, t: number, width: number): Promise<Buffer> {
  const { stdout } = await ffmpeg([
    "-hide_banner", "-loglevel", "error",
    "-ss", t.toFixed(2), "-i", path,
    "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "3",
    "-f", "image2", "-vcodec", "mjpeg", "pipe:1",
  ]);
  if (!stdout?.length) throw new Error(`no frame at ${t.toFixed(1)}s`);
  return stdout;
}

/** Small stills spread across the video. Skips any that fail. */
export async function frameCandidates(path: string): Promise<Candidate[]> {
  const dur = await durationOf(path);
  const points = dur > 1 ? FRAME_POINTS.map((p) => p * dur) : [0];
  const out: Candidate[] = [];
  for (const t of points) {
    try {
      out.push({ kind: "frame", t, small: await frameAt(path, t, CANDIDATE_WIDTH) });
    } catch (e: any) {
      console.warn("[slack-recap/covers] frame failed:", e?.message || e);
    }
  }
  return out;
}

/** Normalise any image buffer (jpeg/png/webp; HEIC if sharp supports it) to a small jpeg. */
export async function smallJpeg(buf: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buf).rotate().resize({ width: CANDIDATE_WIDTH, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  } catch {
    return null;
  }
}

/** Full-size cover jpeg for a chosen frame. */
export async function coverFrame(path: string, t: number): Promise<Buffer> {
  return frameAt(path, t, COVER_WIDTH);
}

const PROMPT = (athlete: string, brand: string, n: number) =>
  `You are choosing images for a client-facing campaign recap. The athlete is ${athlete}` +
  (brand ? `, and the brand is ${brand}` : "") +
  `. The ${n} images are numbered in order. Each is either a still from the athlete's video or one of their photos (labelled).\n\n` +
  `Every image you pick must pass ALL of these:\n` +
  `- The athlete is clearly visible — them, not just their feet, hands or the product. A shoe/product close-up with no athlete in it does not pass.\n` +
  `- Good lighting: the athlete is well lit and their face is readable. No silhouettes or backlit shots where they are dark against the sky or sun, no underexposed or blown-out shots.\n` +
  `- Sharp and in focus. Not a screen recording, app screen, text card, or a frame dominated by caption text. Not mid-blink or caught in an awkward pose.\n\n` +
  `Pick:\n` +
  `- "cover": the best cover for the video (a video still or a photo). Face visible, the athlete large in the frame, ideally with the product or brand visible.\n` +
  `- "photos": the PHOTOS for the athlete's recap card, best first — up to ${MAX_RECAP_PHOTOS}. The FIRST photo is the athlete's hero image on the recap: face clearly visible, well lit, the athlete filling a good part of the frame, shoes/product in shot if possible. Leave out near-duplicates (same moment, pose or framing — keep only the best one) and anything failing the rules above. Fewer good photos beat padding with weak ones. [] if no photo passes.\n` +
  `- "boxes": for the cover and EVERY photo you picked, a tight box around the athlete's whole body (head to feet, or as much of them as is in the frame), as fractions of the image: {"<image number>": [left, top, right, bottom]}, each 0–1.\n\n` +
  `Reply with JSON only: {"cover": <number>, "photos": [<numbers>], "boxes": {"<number>": [l, t, r, b]}, "reason": "<one short sentence>"}`;

/**
 * Ask the vision model to choose. Falls back to the first frame (or first
 * photo) — and the first photo — if the call fails or returns nonsense.
 */
export async function chooseCover(athlete: string, brand: string, candidates: Candidate[]): Promise<CoverChoice> {
  const photoIdx = candidates.map((c, i) => (c.kind === "photo" ? i : -1)).filter((i) => i >= 0);
  // Fallback: a photo from their folder if there is one (photos almost always
  // show the athlete), else the middle still.
  const frameIdx = candidates.map((c, i) => (c.kind === "frame" ? i : -1)).filter((i) => i >= 0);
  const fallback: CoverChoice = {
    cover: photoIdx[0] ?? frameIdx[Math.floor(frameIdx.length / 2)] ?? 0,
    photo: photoIdx[0] ?? null,
    photos: photoIdx.slice(0, MAX_RECAP_PHOTOS),
    judged: false,
  };
  if (candidates.length === 0) return fallback;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[slack-recap/covers] ANTHROPIC_API_KEY is not set — photos fall back to folder order");
    return { ...fallback, error: "ANTHROPIC_API_KEY is not set" };
  }

  const content: Anthropic.ContentBlockParam[] = [];
  candidates.forEach((c, i) => {
    content.push({
      type: "text",
      text: `Image ${i + 1} — ${c.kind === "frame" ? `video still at ${c.t.toFixed(0)}s` : "PHOTO"}`,
    });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: c.small.toString("base64") } });
  });
  content.push({ type: "text", text: PROMPT(athlete, brand, candidates.length) });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({ model: COVER_MODEL, max_tokens: 900, messages: [{ role: "user", content }] });
    const text = res.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
    const json = JSON.parse(text.replace(/^[\s\S]*?\{/, "{").replace(/\}[\s\S]*$/, "}"));
    const cover = Number(json.cover) - 1;
    if (!Number.isInteger(cover) || cover < 0 || cover >= candidates.length) {
      console.error(`[slack-recap/covers] AI reply for ${athlete} had no usable cover:`, text.slice(0, 300));
      return { ...fallback, error: "the AI reply couldn't be read" };
    }
    const picked: number[] = [];
    for (const n of Array.isArray(json.photos) ? json.photos : json.photo != null ? [json.photo] : []) {
      const i = Number(n) - 1;
      if (photoIdx.includes(i) && !picked.includes(i)) picked.push(i);
      if (picked.length >= MAX_RECAP_PHOTOS) break;
    }
    // Never fewer than MIN_RECAP_PHOTOS when the folder has that many: top up
    // from the remaining (already de-duplicated) photos in folder order.
    for (const i of photoIdx) {
      if (picked.length >= Math.min(MIN_RECAP_PHOTOS, photoIdx.length)) break;
      if (!picked.includes(i)) picked.push(i);
    }
    const boxes: Record<number, Box> = {};
    if (json.boxes && typeof json.boxes === "object") {
      for (const [k, v] of Object.entries(json.boxes)) {
        const i = Number(k) - 1;
        const b = cleanBox(v);
        if (b && Number.isInteger(i) && i >= 0 && i < candidates.length) boxes[i] = b;
      }
    }
    console.log(`[slack-recap/covers] ${athlete}: cover #${cover + 1}, photos [${picked.map((i) => i + 1).join(", ")}], ${Object.keys(boxes).length} boxes — ${json.reason || ""}`);
    return { cover, photo: picked[0] ?? null, photos: picked, judged: true, boxes };
  } catch (e: any) {
    console.error(`[slack-recap/covers] AI pick failed for ${athlete} (model ${COVER_MODEL}), using fallback:`, e?.message || e);
    return { ...fallback, error: String(e?.message || e).slice(0, 200) };
  }
}
