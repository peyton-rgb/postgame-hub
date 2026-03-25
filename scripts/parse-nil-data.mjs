#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_PATH = resolve(__dirname, "nil-tracker-raw.txt");
const OUTPUT_DIR = resolve(__dirname, "..", "src", "data");
const OUTPUT_PATH = resolve(OUTPUT_DIR, "nil-tracker-entries.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Wix image URL to a static Wix CDN URL.
 * Input format:  wix:__image://v1/MEDIA_ID/filename#params__
 * Output format: https://static.wixstatic.com/media/MEDIA_ID/v1/fill/w_800,h_800,al_c,q_85/filename
 */
function convertWixImageUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(
    /^wix:__image:\/\/v1\/([^/]+)\/([^#]+)#.*__$/
  );
  if (!match) return null;
  const [, mediaId, filename] = match;
  return `https://static.wixstatic.com/media/${mediaId}/v1/fill/w_800,h_800,al_c,q_85/${filename}`;
}

/**
 * Convert a Wix video URL to a usable URL.
 * If the value doesn't look like a wix video URL we return it as-is (or null
 * if empty). We don't have a concrete wix video format spec, so we just pass
 * through non-empty values.
 */
function convertVideoUrl(raw) {
  if (!raw || typeof raw !== "string" || raw.trim() === "") return null;
  return raw.trim();
}

/**
 * Extract the first paragraph's plain text from Wix rich-text overview JSON.
 * The JSON structure has { nodes: [ { type: "PARAGRAPH", nodes: [ { type:
 * "TEXT", textData: { text: "..." } } ] } ] }.
 */
function extractExcerpt(overviewRaw) {
  if (!overviewRaw || typeof overviewRaw !== "string") return "";
  const trimmed = overviewRaw.trim();
  if (!trimmed.startsWith("{")) return "";

  try {
    const data = JSON.parse(trimmed);
    if (!data.nodes || !Array.isArray(data.nodes)) return "";

    for (const node of data.nodes) {
      if (node.type !== "PARAGRAPH") continue;
      if (!node.nodes || !Array.isArray(node.nodes)) continue;

      const texts = [];
      for (const child of node.nodes) {
        if (child.type === "TEXT") {
          const text =
            child.textData?.text ?? child.data?.text ?? child.text ?? "";
          if (text) texts.push(text);
        }
      }
      if (texts.length > 0) return texts.join("");
    }
  } catch {
    // Malformed JSON – return empty
  }
  return "";
}

/**
 * Safely parse a JSON array string, returning an empty array on failure.
 */
function parseJsonArray(raw) {
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return [];
  try {
    const arr = JSON.parse(trimmed);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Derive slug from an article path like "/nil-tracker/slug-here".
 */
function deriveSlug(articlePath) {
  if (!articlePath || typeof articlePath !== "string") return "";
  const trimmed = articlePath.trim();
  // Take the last non-empty segment
  const segments = trimmed.split("/").filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : "";
}

// ---------------------------------------------------------------------------
// Main parsing
// ---------------------------------------------------------------------------

function splitRecords(text) {
  // Records are separated by blank lines. Each record starts with PUBLISHED
  // or DRAFT on the first non-empty line.
  //
  // Strategy: split on blank-line boundaries that are followed by PUBLISHED
  // or DRAFT.
  const lines = text.split(/\r?\n/);
  const records = [];
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // If we hit a status line and already have accumulated lines, flush.
    if (
      (trimmed === "PUBLISHED" || trimmed === "DRAFT") &&
      current.length > 0
    ) {
      records.push(current);
      current = [trimmed];
    } else if (trimmed === "" && current.length === 0) {
      // skip leading blank lines
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    records.push(current);
  }

  return records;
}

function parseRecord(lines) {
  // We consume lines positionally, but some fields may be missing, so we
  // need a flexible approach. The first line is always the status.
  let i = 0;
  const next = () => (i < lines.length ? lines[i++] : "");

  const status = next().trim(); // PUBLISHED or DRAFT
  if (status !== "PUBLISHED" && status !== "DRAFT") return null;

  const playerName = next().trim();
  const collegeName = next().trim();
  const title = next().trim();
  const imageUrlRaw = next().trim();

  // Overview is a long JSON line starting with {"nodes":
  // But it could also be empty. Peek to decide.
  let overviewRaw = "";
  if (i < lines.length) {
    const peek = lines[i].trim();
    if (peek.startsWith("{")) {
      overviewRaw = next();
    }
  }

  const videoUrlRaw = next().trim();

  // Date field – YYYY-MM-DD
  const date = next().trim();

  // Category path
  next(); // category path – not used in output

  // Article slug path
  const articlePath = next().trim();

  // Tags arrays
  const sportTags = parseJsonArray(next());
  const brandTags = parseJsonArray(next());
  const industryTags = parseJsonArray(next());
  const campaignTypes = parseJsonArray(next());

  // Remaining optional fields – we don't need them for output, just consume
  // (caseStudyHighlight, altArticlePath, publishDate, unpublishDate,
  //  copyPath, id, createdDate, updatedDate, ownerId, collegeHtml,
  //  extraCollegeName, extraPlayerName)

  return {
    title: title || "",
    slug: deriveSlug(articlePath),
    player_name: playerName || "",
    college: collegeName || "",
    brand: brandTags.length > 0 ? brandTags[0] : "",
    sport: sportTags.length > 0 ? sportTags[0] : "",
    industry: industryTags.length > 0 ? industryTags[0] : "",
    campaign_types: campaignTypes,
    image_url: convertWixImageUrl(imageUrlRaw),
    excerpt: extractExcerpt(overviewRaw),
    date: date || "",
    published: status === "PUBLISHED",
    video_url: convertVideoUrl(videoUrlRaw),
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main() {
  let rawText;
  try {
    rawText = readFileSync(INPUT_PATH, "utf-8");
  } catch (err) {
    console.error(`Error reading input file: ${INPUT_PATH}`);
    console.error(err.message);
    process.exit(1);
  }

  const recordChunks = splitRecords(rawText);
  console.log(`Found ${recordChunks.length} raw record(s).`);

  const entries = [];
  let skipped = 0;

  for (const chunk of recordChunks) {
    const entry = parseRecord(chunk);
    if (entry) {
      entries.push(entry);
    } else {
      skipped++;
    }
  }

  console.log(
    `Parsed ${entries.length} entries (${skipped} skipped/invalid).`
  );

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(entries, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
