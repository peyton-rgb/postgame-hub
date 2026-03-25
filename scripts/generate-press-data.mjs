#!/usr/bin/env node
/**
 * Generate press articles JSON from raw NIL Tracker data.
 *
 * Usage:
 *   1. Save raw Wix data to scripts/nil-tracker-raw.txt
 *   2. Run: node scripts/generate-press-data.mjs
 *   3. Output: src/data/press-articles.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_WIX_URL = "https://www.home.pstgm.com";

function convertWixImageUrl(wixUrl) {
  if (!wixUrl || !wixUrl.includes("wix:__image://")) return null;
  const match = wixUrl.match(/wix:__image:\/\/v1\/([^/]+)\/([^#]+)/);
  if (!match) return null;
  const [, mediaId, filename] = match;
  return `https://static.wixstatic.com/media/${mediaId}/${decodeURIComponent(filename)}`;
}

function extractExcerpt(overviewJson) {
  if (!overviewJson || !overviewJson.startsWith("{")) return null;
  try {
    const doc = JSON.parse(overviewJson);
    if (!doc.nodes) return null;
    const paragraphs = [];
    for (const node of doc.nodes) {
      if (node.type === "PARAGRAPH" && node.nodes) {
        const texts = [];
        for (const child of node.nodes) {
          if (child.type === "TEXT" && child.textData?.text) {
            const t = child.textData.text.trim();
            if (t && t !== "\n") texts.push(t);
          }
        }
        if (texts.length > 0) paragraphs.push(texts.join(""));
      }
      if (paragraphs.length >= 2) break;
    }
    return paragraphs.join(" ") || null;
  } catch {
    return null;
  }
}

function parseJsonArray(text) {
  if (!text || !text.startsWith("[")) return [];
  try { return JSON.parse(text); } catch { return []; }
}

function slugFromPath(p) {
  if (!p) return null;
  return p.replace(/^\/nil-tracker\//, "").replace(/^\/nil-tracker-1\//, "").replace(/\/$/, "");
}

function parseRawData(rawText) {
  const lines = rawText.split("\n");
  const records = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]?.trim();
    if (line !== "PUBLISHED" && line !== "DRAFT") { i++; continue; }

    const record = { status: line };
    i++;
    const readLine = () => { if (i >= lines.length) return ""; const l = lines[i]; i++; return l ?? ""; };

    record.playerName = readLine().trim();
    record.college = readLine().trim();
    record.title = readLine().trim();

    let nextLine = readLine();
    if (nextLine.includes("wix:__image://")) { record.imageUrl = nextLine.trim(); nextLine = readLine(); }
    else record.imageUrl = "";

    if (nextLine.trim().startsWith('{"nodes"')) { record.overview = nextLine.trim(); nextLine = readLine(); }
    else record.overview = "";

    if (nextLine.includes("wix:__video://")) { record.videoUrl = nextLine.trim(); nextLine = readLine(); }
    else record.videoUrl = "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(nextLine.trim())) { record.date = nextLine.trim(); nextLine = readLine(); }
    else record.date = "";

    if (nextLine.trim().startsWith("/niltracker")) { nextLine = readLine(); }

    if (nextLine.trim().startsWith("/nil-tracker/")) { record.slugPath = nextLine.trim(); nextLine = readLine(); }
    else record.slugPath = "";

    if (nextLine.trim().startsWith("[")) { record.sportTags = nextLine.trim(); nextLine = readLine(); }
    else record.sportTags = "[]";

    if (nextLine.trim().startsWith("[")) { record.brandTags = nextLine.trim(); nextLine = readLine(); }
    else record.brandTags = "[]";

    if (nextLine.trim().startsWith("[")) { record.industryTags = nextLine.trim(); nextLine = readLine(); }
    else record.industryTags = "[]";

    if (nextLine.trim().startsWith("[")) { record.campaignType = nextLine.trim(); nextLine = readLine(); }
    else record.campaignType = "[]";

    // Skip remaining fields until next record
    if (nextLine.trim().startsWith("[")) { nextLine = readLine(); }
    if (nextLine.trim().startsWith("/nil-tracker-1/")) { record.altSlugPath = nextLine.trim(); nextLine = readLine(); }
    else record.altSlugPath = "";

    records.push(record);
  }

  return records;
}

function toPressArticle(record, index) {
  const brands = parseJsonArray(record.brandTags);
  const sports = parseJsonArray(record.sportTags);
  const campaignTypes = parseJsonArray(record.campaignType);
  const brand = brands[0] || null;
  const sport = sports[0] || null;

  const slug = slugFromPath(record.slugPath) || slugFromPath(record.altSlugPath) ||
    record.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `article-${index}`;

  const externalUrl = record.altSlugPath ? `${BASE_WIX_URL}${record.altSlugPath}` :
    record.slugPath ? `${BASE_WIX_URL}${record.slugPath}` : null;

  return {
    id: `nil-${index.toString().padStart(4, "0")}`,
    title: record.title || `${record.playerName} Campaign`,
    slug: slug.substring(0, 200),
    publication: brand,
    author: record.playerName || null,
    excerpt: extractExcerpt(record.overview)?.substring(0, 500) || null,
    content: null,
    external_url: externalUrl,
    image_url: convertWixImageUrl(record.imageUrl),
    category: sport,
    featured: false,
    published: record.status === "PUBLISHED",
    published_date: record.date || null,
    sort_order: index,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Main
const rawPath = path.join(__dirname, "nil-tracker-raw.txt");
if (!fs.existsSync(rawPath)) {
  console.error("❌ Place raw data in scripts/nil-tracker-raw.txt first");
  process.exit(1);
}

const rawText = fs.readFileSync(rawPath, "utf-8");
const records = parseRawData(rawText);
console.log(`Parsed ${records.length} records`);

const articles = records.filter(r => r.title).map((r, i) => toPressArticle(r, i));
console.log(`Generated ${articles.length} press articles`);

const outPath = path.join(__dirname, "..", "src", "data", "press-articles.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(articles, null, 2));
console.log(`✅ Wrote to ${outPath}`);
