// ffmpeg-worker/detect.js
// ─────────────────────────────────────────────────────────────
// Finds the people in a photo so the Hub can crop recap photos tight and
// centred on the athlete. The vision AI is good at CHOOSING photos but marks
// where a person is only loosely (Ghost Max 4, 2026-11-16: athletes left small
// in wide crops, feet cut off). A purpose-built person detector gives exact
// boxes.
//
//   Model: YOLOX-Tiny (Megvii, Apache-2.0), downloaded at image build time to
//          /app/models/yolox_tiny.onnx (see Dockerfile).
//   Input: any image ffmpeg can read. iPhone HEIC files (heif-convert) and
//          camera raw files (dcraw) are converted to JPEG first, and the JPEG is
//          handed back to the caller (browsers can't show either).
//   Output: { width, height, persons: [{ box: [l,t,r,b] (0–1), score }], jpeg? }
// ─────────────────────────────────────────────────────────────

const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const heicConvert = require("heic-convert");

const SIZE = 416; // YOLOX-Tiny input
const STRIDES = [8, 16, 32];
const MIN_SCORE = 0.35;
const NMS_IOU = 0.5;
const MODEL_PATH = process.env.PERSON_MODEL_PATH || path.join(__dirname, "models", "yolox_tiny.onnx");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

let sessionPromise = null;
function session() {
  if (!sessionPromise) {
    const ort = require("onnxruntime-node");
    sessionPromise = ort.InferenceSession.create(MODEL_PATH);
  }
  return sessionPromise;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, encoding: "buffer", ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(cmd)} failed: ${String(stderr || err.message).slice(0, 300)}`));
      else resolve(stdout);
    });
  });
}

/** ISO-BMFF "ftyp" brand check — HEIC/HEIF from iPhones. */
function isHeic(buf) {
  if (buf.length < 12 || buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand);
}

/**
 * Camera raw photo? Canon CR2 has "CR" after its TIFF header; other raws are
 * TIFF-based too, so for those dcraw is asked (dcraw -i exits 0 only on raw).
 */
async function isCameraRaw(buf, file) {
  if (buf.length < 12) return false;
  const tiff = buf.toString("hex", 0, 4) === "49492a00" || buf.toString("hex", 0, 4) === "4d4d002a";
  if (!tiff) return false;
  if (buf.toString("ascii", 8, 10) === "CR") return true;
  try {
    await run("dcraw", ["-i", file]);
    return true;
  } catch {
    return false; // a plain TIFF — ffmpeg reads it directly
  }
}

/** Raw → upright JPEG. Half-size decode (still ~2700px on a 20MP body). */
async function rawToJpeg(file, dir) {
  const tiff = path.join(dir, "raw.tiff");
  // -w camera white balance, -h half size, -T TIFF out, -c to stdout. dcraw
  // applies the camera's orientation flag itself, so portraits come out upright.
  await fs.writeFile(tiff, await run("dcraw", ["-c", "-w", "-h", "-T", file]));
  const out = path.join(dir, "converted.jpg");
  await run(FFMPEG, ["-v", "error", "-y", "-i", tiff, "-q:v", "2", out]);
  return out;
}

async function imageSize(file) {
  const out = (await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file]))
    .toString()
    .trim()
    .split("\n")[0];
  const [w, h] = out.split("x").map(Number);
  if (!w || !h) throw new Error(`couldn't read image size (${out})`);
  return { width: w, height: h };
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return ua > 0 ? inter / ua : 0;
}

/**
 * People in an image (Buffer). HEIC and camera raw are converted to JPEG first; the JPEG is
 * returned as `jpeg` so the caller can store a browser-friendly copy.
 */
async function detectPersons(input) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "person-"));
  try {
    let file = path.join(dir, "in");
    let jpeg = null;
    await fs.writeFile(file, input);
    if (isHeic(input)) {
      const out = path.join(dir, "converted.jpg");
      try {
        await run("heif-convert", ["-q", "92", file, out]);
        jpeg = await fs.readFile(out);
      } catch (e) {
        // Some iPhone files (portrait-mode depth maps) trip libheif's checks;
        // heic-convert (libheif compiled to wasm) reads them fine.
        console.warn("[detect] heif-convert failed, using heic-convert:", e.message);
        jpeg = Buffer.from(await heicConvert({ buffer: input, format: "JPEG", quality: 0.92 }));
        await fs.writeFile(out, jpeg);
      }
      file = out;
    } else if (await isCameraRaw(input, file)) {
      const out = await rawToJpeg(file, dir);
      jpeg = await fs.readFile(out);
      file = out;
    }
    const { width, height } = await imageSize(file);

    // Letterbox into SIZE×SIZE, top-left aligned, grey (114) padding, BGR —
    // exactly YOLOX's own preprocessing.
    const r = Math.min(SIZE / width, SIZE / height);
    const rw = Math.max(1, Math.floor(width * r)), rh = Math.max(1, Math.floor(height * r));
    const raw = await run(FFMPEG, [
      "-v", "error", "-i", file, "-frames:v", "1",
      "-vf", `scale=${rw}:${rh}:flags=bilinear,pad=${SIZE}:${SIZE}:0:0:color=0x727272`,
      "-f", "rawvideo", "-pix_fmt", "bgr24", "pipe:1",
    ]);
    if (raw.length !== SIZE * SIZE * 3) throw new Error(`unexpected pixel data (${raw.length} bytes)`);

    const plane = SIZE * SIZE;
    const data = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      data[i] = raw[i * 3];
      data[plane + i] = raw[i * 3 + 1];
      data[2 * plane + i] = raw[i * 3 + 2];
    }
    const ort = require("onnxruntime-node");
    const sess = await session();
    const feeds = { [sess.inputNames[0]]: new ort.Tensor("float32", data, [1, 3, SIZE, SIZE]) };
    const out = (await sess.run(feeds))[sess.outputNames[0]];
    const o = out.data;
    const stride = out.dims[2]; // 85: cx, cy, w, h, objectness, 80 class scores

    // Decode the grids (YOLOX demo_postprocess) and keep "person" (class 0).
    const found = [];
    let idx = 0;
    for (const s of STRIDES) {
      const n = SIZE / s;
      for (let gy = 0; gy < n; gy++) {
        for (let gx = 0; gx < n; gx++, idx++) {
          const base = idx * stride;
          const score = o[base + 4] * o[base + 5];
          if (score < MIN_SCORE) continue;
          const cx = (o[base] + gx) * s, cy = (o[base + 1] + gy) * s;
          const w = Math.exp(o[base + 2]) * s, h = Math.exp(o[base + 3]) * s;
          found.push({
            score,
            box: [
              Math.max(0, (cx - w / 2) / r / width),
              Math.max(0, (cy - h / 2) / r / height),
              Math.min(1, (cx + w / 2) / r / width),
              Math.min(1, (cy + h / 2) / r / height),
            ],
          });
        }
      }
    }
    found.sort((a, b) => b.score - a.score);
    const persons = [];
    for (const p of found) if (persons.every((k) => iou(k.box, p.box) < NMS_IOU)) persons.push(p);
    return { width, height, persons: persons.slice(0, 10), jpeg };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { detectPersons, isHeic, isCameraRaw };
