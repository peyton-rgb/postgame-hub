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

const COVER_MODEL = process.env.RECAP_COVER_MODEL || "claude-sonnet-5";
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
  /** True when the AI picked; false when this is the fallback. */
  judged: boolean;
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
  `Pick:\n` +
  `- "cover": the best cover for the video. It must show the athlete clearly — face visible, in focus, well lit — ideally holding or using the product or with the brand visible. Prefer a natural, flattering, expressive moment. Reject phone screen recordings, app screens, text cards, black or blurry frames, frames where the athlete is tiny, cut off or mid-blink, and frames dominated by caption text.\n` +
  `- "photo": the best of the PHOTOS only by the same standard, or null if there are no photos.\n\n` +
  `Reply with JSON only: {"cover": <number>, "photo": <number or null>, "reason": "<one short sentence>"}`;

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
    judged: false,
  };
  if (candidates.length === 0) return fallback;
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

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
    const res = await client.messages.create({ model: COVER_MODEL, max_tokens: 200, messages: [{ role: "user", content }] });
    const text = res.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
    const json = JSON.parse(text.replace(/^[\s\S]*?\{/, "{").replace(/\}[\s\S]*$/, "}"));
    const cover = Number(json.cover) - 1;
    const photo = json.photo == null ? null : Number(json.photo) - 1;
    if (!Number.isInteger(cover) || cover < 0 || cover >= candidates.length) return fallback;
    const okPhoto = photo != null && photoIdx.includes(photo) ? photo : fallback.photo;
    console.log(`[slack-recap/covers] ${athlete}: cover #${cover + 1}, photo ${okPhoto == null ? "-" : `#${okPhoto + 1}`} — ${json.reason || ""}`);
    return { cover, photo: okPhoto, judged: true };
  } catch (e: any) {
    console.warn(`[slack-recap/covers] AI pick failed for ${athlete}, using fallback:`, e?.message || e);
    return fallback;
  }
}
