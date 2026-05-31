const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const FFMPEG_WORKER_SECRET = process.env.FFMPEG_WORKER_SECRET;
const HUB_URL = process.env.HUB_URL || "https://postgame-hub.vercel.app";

// The app's tagging endpoint sits behind a hard 4.5 MB request-size limit.
// Sending one full-resolution frame per second blows past that on longer
// clips, so the request is rejected before tagging can run. We extract 1
// frame/sec (so we still know the true duration), then send only a small,
// evenly-spaced sample. The app only needs a few frames to tag, and reads
// resolution/duration from the frames' real dimensions + timestamps, so this
// keeps all the specs intact while keeping the package small.
const MAX_FRAMES_TO_SEND = 8;

// -- Auth middleware -----------------------------------------------------------

function authenticate(req, res, next) {
  if (!FFMPEG_WORKER_SECRET) {
    return res.status(500).json({ error: "FFMPEG_WORKER_SECRET not configured" });
  }
  if (req.headers["x-ffmpeg-secret"] !== FFMPEG_WORKER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// -- Helpers ------------------------------------------------------------------

/** Download a URL to a local temp file. Returns the file path. */
function downloadToTemp(url) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(new URL(url).pathname) || ".mp4";
    const tmpPath = path.join(os.tmpdir(), `pg-${Date.now()}${ext}`);
    const file = fs.createWriteStream(tmpPath);
    const client = url.startsWith("https") ? https : http;

    client.get(url, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        // Follow one redirect
        file.close();
        fs.unlinkSync(tmpPath);
        return resolve(downloadToTemp(resp.headers.location));
      }
      if (resp.statusCode !== 200) {
        file.close();
        fs.unlinkSync(tmpPath);
        return reject(new Error(`Download failed: HTTP ${resp.statusCode}`));
      }
      resp.pipe(file);
      file.on("finish", () => file.close(() => resolve(tmpPath)));
      file.on("error", (err) => {
        fs.unlinkSync(tmpPath);
        reject(err);
      });
    }).on("error", (err) => {
      fs.unlinkSync(tmpPath);
      reject(err);
    });
  });
}

/** Extract 1 frame/sec as JPEGs into a temp directory. Returns sorted file paths. */
function extractFrames(videoPath) {
  return new Promise((resolve, reject) => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "pg-frames-"));
    ffmpeg(videoPath)
      .outputOptions(["-vf", "fps=1", "-q:v", "5"])
      .output(path.join(outDir, "frame-%04d.jpg"))
      .on("end", () => {
        const files = fs.readdirSync(outDir)
          .filter((f) => f.endsWith(".jpg"))
          .sort()
          .map((f) => path.join(outDir, f));
        resolve({ outDir, files });
      })
      .on("error", (err) => reject(err))
      .run();
  });
}

/** Clean up temp files/dirs, ignoring errors. */
function cleanup(...paths) {
  for (const p of paths) {
    try {
      if (fs.statSync(p).isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true });
      } else {
        fs.unlinkSync(p);
      }
    } catch {
      // ignore
    }
  }
}

// -- Route --------------------------------------------------------------------

app.post("/process", authenticate, async (req, res) => {
  const { video_url, inspo_item_id, human_tags, brief_context } = req.body;

  if (!video_url || !inspo_item_id) {
    return res.status(400).json({ error: "video_url and inspo_item_id are required" });
  }

  let videoPath;
  let framesDir;

  try {
    console.log(`[process] Downloading ${video_url}`);
    videoPath = await downloadToTemp(video_url);

    console.log(`[process] Extracting frames from ${videoPath}`);
    const { outDir, files } = await extractFrames(videoPath);
    framesDir = outDir;
    console.log(`[process] Extracted ${files.length} frames`);

    // Pick at most MAX_FRAMES_TO_SEND frames, evenly spread from first to last.
    // Each keeps its true second (its position in the 1-per-second list), so
    // the app can still read the real duration from the highest timestamp.
    let selected;
    if (files.length <= MAX_FRAMES_TO_SEND) {
      selected = files.map((filePath, i) => ({ filePath, second: i + 1 }));
    } else {
      const step = (files.length - 1) / (MAX_FRAMES_TO_SEND - 1);
      const picked = [];
      for (let k = 0; k < MAX_FRAMES_TO_SEND; k++) {
        const idx = Math.round(k * step);
        picked.push({ filePath: files[idx], second: idx + 1 });
      }
      // Drop any duplicate seconds that rounding may have produced.
      selected = picked.filter(
        (s, i, arr) => arr.findIndex((x) => x.second === s.second) === i
      );
    }

    // Convert the selected frames to base64
    const frames = selected.map(({ filePath, second }) => ({
      data: fs.readFileSync(filePath).toString("base64"),
      media_type: "image/jpeg",
      timestamp_seconds: second,
    }));

    // POST to /api/tag
    console.log(`[process] Sending ${frames.length} frames to ${HUB_URL}/api/tag`);
    const tagRes = await fetch(`${HUB_URL}/api/tag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inspo_item_id,
        frames,
        human_tags: human_tags || {},
        brief_context,
      }),
    });

    const tagData = await tagRes.json();

    if (!tagRes.ok) {
      throw new Error(`/api/tag responded ${tagRes.status}: ${tagData.error || "unknown"}`);
    }

    console.log(`[process] Done — tagged ${inspo_item_id}`);
    res.json({ success: true, inspo_item_id, tag_result: tagData });
  } catch (err) {
    console.error(`[process] Error:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    cleanup(videoPath, framesDir);
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`FFmpeg worker listening on :${PORT}`));
