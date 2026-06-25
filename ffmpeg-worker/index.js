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
const { google } = require("googleapis");

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

// -- Google Drive upload (for the composited videos) -------------------------
//
// The worker uploads each composited MP4 straight to the athlete's Drive folder,
// server-side — no request-body size limit (the reason this lives in the worker
// and not a Vercel route). Same refresh-token auth + trash-not-delete dedup as
// the Hub's routes; supportsAllDrives on every op (the parent is a Shared Drive).

const DRAFTS_PARENT = "1NbLiNIFdCn311xCB1e6gToCBCZ39Mo7S";   // DRAFTS / 2026 NBA Draft (Shared Drive)
const SPEC_LABEL = { reels: "Reels", story: "Story", tiktok: "TikTok", shorts: "Shorts", igfeed: "IGfeed", linkedin: "LinkedIn" };

let _drive = null;
function getDrive() {
  if (_drive) return _drive;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN are required for Drive upload");
  }
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  _drive = google.drive({ version: "v3", auth: oauth2 });
  return _drive;
}

/** Find-or-create the athlete's folder under `parent`. Returns its id. */
async function driveEnsureFolder(drive, name, parent) {
  const safe = name.replace(/'/g, "\\'");
  const found = await drive.files.list({
    q: `'${parent}' in parents and mimeType='application/vnd.google-apps.folder' and name='${safe}' and trashed=false`,
    supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: "allDrives", fields: "files(id)", pageSize: 1,
  });
  if (found.data.files && found.data.files[0]) return found.data.files[0].id;
  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parent] },
    fields: "id",
  });
  return created.data.id;
}

/** Trash every file with this exact name in the folder (replace, don't duplicate). Trash, not delete. */
async function driveTrashByName(drive, name, parent) {
  const safe = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parent}' in parents and name='${safe}' and trashed=false`,
    supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: "allDrives", fields: "files(id)", pageSize: 100,
  });
  for (const f of res.data.files || []) {
    if (f.id) await drive.files.update({ fileId: f.id, supportsAllDrives: true, requestBody: { trashed: true } });
  }
}

/** Upload a local MP4 into the folder (server-side stream — no size limit). Returns {id, webViewLink}. */
async function driveUpload(drive, localPath, name, folderId) {
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name, mimeType: "video/mp4", parents: [folderId] },
    media: { mimeType: "video/mp4", body: fs.createReadStream(localPath) },
    fields: "id, webViewLink",
  });
  return { id: res.data.id, webViewLink: res.data.webViewLink };
}

// -- Overlay composite (Video w/ graphic) ------------------------------------
//
// Burns a transparent overlay PNG (the card graphic from the draft tool) onto a
// source video, sized per platform spec. Alpha-correct: both inputs are cast to
// rgba before the overlay, so the transparent photo area shows the video through
// — flattened to yuv420p only at the end for H.264. The filtergraph was validated
// locally for both geometries (9:16 2160x3840, 4:5 2160x2700) before shipping.
// Drive upload of each output is Checkpoint C; Hub wiring + async callback is
// Checkpoint D. Does NOT touch /process or /render-hero.

// Spec → output dimensions. Must match SIZES/PLATFORM_SPECS in the draft tool
// (and renderOverlayPNG's dims) so the overlay aligns 1:1.
const SPEC_DIMS = {
  reels:    { w: 2160, h: 3840 },   // 9:16
  story:    { w: 2160, h: 3840 },   // 9:16
  tiktok:   { w: 2160, h: 3840 },   // 9:16
  shorts:   { w: 2160, h: 3840 },   // 9:16
  igfeed:   { w: 2160, h: 2700 },   // 4:5
  linkedin: { w: 2160, h: 2700 },   // 4:5
};

/** Composite an overlay PNG onto a video at w x h (alpha-correct). */
function compositeOverlay(videoPath, overlayPath, w, h, outputPath) {
  return new Promise((resolve, reject) => {
    // Only the OVERLAY is cast to rgba (it needs alpha for the blend); the 4K
    // background stays in its native (yuv) format — converting the whole video to
    // rgba was the OOM hog (~33MB/frame). overlay respects the overlay's alpha
    // regardless of the bg format, so the transparent area still shows the video.
    const filter =
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[bg];` +
      `[1:v]format=rgba,scale=${w}:${h}[ovl];` +
      `[bg][ovl]overlay=0:0[comp];` +
      `[comp]format=yuv420p[out]`;
    const args = [
      "-y",
      "-i", videoPath,
      "-i", overlayPath,
      "-filter_complex", filter,
      "-map", "[out]",
      "-map", "0:a?",
      "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ];
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg composite exited ${code}: ${stderr.slice(-600)}`)));
    proc.on("error", reject);
  });
}

// POST /composite
// Body: { videoUrl, overlays: [{ spec, pngBase64 }] }
// Composites each requested spec's overlay onto the video. Checkpoint C adds the
// Drive upload of each output (and returns the links); Checkpoint D wires the Hub
// + the async status/callback. For now it composites and reports per-spec size.
// Serialize ffmpeg runs across ALL requests — one composite at a time, so two
// jobs can't collide on RAM (the OOM was two 4K composites running at once).
// Essential for "Render All", which fires many jobs.
let _ffmpegQueue = Promise.resolve();
function runSerial(task) {
  const result = _ffmpegQueue.then(task, task);
  _ffmpegQueue = result.then(() => {}, () => {});   // keep the chain alive past failures
  return result;
}

// POST the per-spec results back to the Hub when a job finishes (async pattern,
// like /process → /api/tag). Carries x-ffmpeg-secret so the Hub can verify it.
async function postCallback(url, payload) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ffmpeg-secret": FFMPEG_WORKER_SECRET },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error(`[composite] callback POST failed: ${e.message}`);
  }
}

app.post(
  "/composite",
  // PHASE-1 CONFIRM LOG — fires on any arrival, before auth (remove after fix verified).
  (req, _res, next) => {
    console.log("[composite] request received", {
      jobId: req.body && req.body.jobId,
      specs: req.body && Array.isArray(req.body.overlays) ? req.body.overlays.length : 0,
    });
    next();
  },
  authenticate,
  async (req, res) => {
  const { athleteName, videoUrl, overlays, callbackUrl, jobId } = req.body || {};
  if (!athleteName || !videoUrl || !Array.isArray(overlays) || overlays.length === 0) {
    return res.status(400).json({ error: "athleteName, videoUrl and a non-empty overlays[] are required" });
  }
  for (const o of overlays) {
    if (!o || !SPEC_DIMS[o.spec] || !o.overlayUrl) {
      return res.status(400).json({ error: `each overlay needs a known spec + overlayUrl (got: ${o && o.spec})` });
    }
  }

  let videoPath = null;
  const tmp = [];
  try {
    const drive = getDrive();
    const folderId = await driveEnsureFolder(drive, String(athleteName).trim(), DRAFTS_PARENT);
    const safeName = String(athleteName).trim().replace(/\s+/g, "_");

    console.log(`[composite] downloading ${videoUrl}`);
    videoPath = await downloadToTemp(videoUrl);

    const results = [];
    for (const { spec, overlayUrl } of overlays) {
      const { w, h } = SPEC_DIMS[spec];
      const overlayPath = await downloadToTemp(overlayUrl);   // tiny PNG — reuse the same downloader as the video
      const outputPath = path.join(os.tmpdir(), `pg-comp-${spec}-${Date.now()}.mp4`);
      tmp.push(overlayPath, outputPath);

      console.log(`[composite] ${spec} ${w}x${h} — compositing`);
      await runSerial(() => compositeOverlay(videoPath, overlayPath, w, h, outputPath));

      const fname = `${safeName}_${SPEC_LABEL[spec]}_video.mp4`;
      await driveTrashByName(drive, fname, folderId);                 // replace, don't duplicate
      console.log(`[composite] ${spec} — uploading ${fname} (${fs.statSync(outputPath).size}B)`);
      const up = await driveUpload(drive, outputPath, fname, folderId);

      results.push({ spec, fileId: up.id, webViewLink: up.webViewLink, name: fname });
    }

    // Async pattern: when the Hub fired this fire-and-forget with a callbackUrl,
    // report the per-spec Drive links back so it can flip the job row to done.
    if (callbackUrl) await postCallback(callbackUrl, { jobId, ok: true, folderId, results });
    res.json({ ok: true, folderId, results });
  } catch (err) {
    console.error(`[composite] Error: ${err.message}`);
    if (callbackUrl) await postCallback(callbackUrl, { jobId, ok: false, error: err.message });
    res.status(500).json({ error: err.message });
  } finally {
    cleanup(videoPath, ...tmp);
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`FFmpeg worker listening on :${PORT}`));
