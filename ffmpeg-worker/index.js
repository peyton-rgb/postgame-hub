const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const { createClient } = require("@supabase/supabase-js");
// supabase-js initializes a realtime client that expects a WebSocket impl.
// Node 20 doesn't expose a global WebSocket by default, so we hand it `ws`
// to silence the runtime warning that was killing /render-hero uploads.
// We never actually subscribe to a channel — Storage is the only thing used.
const WebSocketImpl = require("ws");

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;
const FFMPEG_WORKER_SECRET = process.env.FFMPEG_WORKER_SECRET;
const HUB_URL = process.env.HUB_URL || "https://postgame-hub.vercel.app";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
      .outputOptions(["-vf", "fps=1,scale='min(768,iw)':-2", "-q:v", "5"])
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

// -- Hero 16:9 render --------------------------------------------------------
//
// Converts a vertical (or any aspect) source clip into a 1920x1080 mp4 with a
// side-fill treatment so it fits horizontal hero slots without cropping the
// subject. Two looks, both validated in the build brief; filtergraphs are
// copied verbatim so the worker output matches the planning sample.
//
//   blur   — feathered blur side-fill + faint chromatic fringe (default)
//   mirror — flipped, lightly-blurred side echo
//
// Cache: campaign-media/_hero169/{mediaId}_{look}.mp4 (idempotent).

const BUCKET = "campaign-media";
const HERO_CACHE_PREFIX = "_hero169";

const FILTERGRAPH_BLUR = `[0:v]split=2[bg][fg];
[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=30,eq=brightness=-0.02[bgb];
[fg]scale=-2:1080,format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='clip(min(X,(W-X))/110*255,0,255)'[fgf];
[bgb][fgf]overlay=(W-w)/2:(H-h)/2,rgbashift=rh=3:bh=-3`;

const FILTERGRAPH_MIRROR = `[0:v]split=2[bg][fg];
[bg]hflip,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=7,eq=brightness=-0.02[bgb];
[fg]scale=-2:1080,format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='clip(min(X,(W-X))/110*255,0,255)'[fgf];
[bgb][fgf]overlay=(W-w)/2:(H-h)/2`;

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for /render-hero");
  }
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: WebSocketImpl },
  });
  return _supabase;
}

function heroCachePath(mediaId, look) {
  return `${HERO_CACHE_PREFIX}/${mediaId}_${look}.mp4`;
}
function heroCachePublicUrl(mediaId, look) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${heroCachePath(mediaId, look)}`;
}

/** HEAD the public URL — cheaper than a Storage list() and works with the anon CDN. */
function cachedAssetExists(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const client = u.protocol === "https:" ? https : http;
      const req = client.request(
        { method: "HEAD", hostname: u.hostname, path: u.pathname + u.search, port: u.port || undefined },
        (resp) => resolve(resp.statusCode === 200),
      );
      req.on("error", () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Run ffmpeg with the exact arg shape from the build brief:
 *   ffmpeg -y -i INPUT -filter_complex_script SCRIPT -an -pix_fmt yuv420p -crf 20 OUTPUT
 * Using a script file (not -filter_complex) avoids any quoting surprises with
 * the geq alpha expression's single quotes.
 */
function renderHero169(inputPath, scriptPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", inputPath,
      "-filter_complex_script", scriptPath,
      "-an",
      "-pix_fmt", "yuv420p",
      "-crf", "20",
      outputPath,
    ];
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
    proc.on("error", reject);
  });
}

app.post("/render-hero", authenticate, async (req, res) => {
  const { sourceUrl, look, mediaId } = req.body || {};

  if (!sourceUrl || !look || !mediaId) {
    return res.status(400).json({ error: "sourceUrl, look, and mediaId are required" });
  }
  if (look !== "blur" && look !== "mirror") {
    return res.status(400).json({ error: "look must be 'blur' or 'mirror'" });
  }

  const renderedUrl = heroCachePublicUrl(mediaId, look);

  // Cache hit — return immediately, no work to do.
  if (await cachedAssetExists(renderedUrl)) {
    console.log(`[render-hero] cache hit ${mediaId}/${look}`);
    return res.json({ cached: true, rendered_url: renderedUrl });
  }

  let inputPath = null;
  let scriptPath = null;
  let outputPath = null;
  const t0 = Date.now();

  try {
    console.log(`[render-hero] ${mediaId}/${look} downloading ${sourceUrl}`);
    inputPath = await downloadToTemp(sourceUrl);

    const filtergraph = look === "blur" ? FILTERGRAPH_BLUR : FILTERGRAPH_MIRROR;
    scriptPath = path.join(os.tmpdir(), `pg-fg-${Date.now()}-${look}.txt`);
    fs.writeFileSync(scriptPath, filtergraph);

    outputPath = path.join(os.tmpdir(), `pg-hero-${mediaId}-${look}-${Date.now()}.mp4`);

    console.log(`[render-hero] ${mediaId}/${look} rendering`);
    await renderHero169(inputPath, scriptPath, outputPath);

    console.log(`[render-hero] ${mediaId}/${look} uploading ${fs.statSync(outputPath).size}B`);
    const body = fs.readFileSync(outputPath);
    const { error: upErr } = await getSupabase()
      .storage
      .from(BUCKET)
      .upload(heroCachePath(mediaId, look), body, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

    const ms = Date.now() - t0;
    console.log(`[render-hero] ${mediaId}/${look} done in ${ms}ms → ${renderedUrl}`);
    res.json({ cached: false, rendered_url: renderedUrl, render_ms: ms });
  } catch (err) {
    console.error(`[render-hero] ${mediaId}/${look} ERROR: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    cleanup(inputPath, scriptPath, outputPath);
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`FFmpeg worker listening on :${PORT}`));
