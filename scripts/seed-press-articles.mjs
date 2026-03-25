#!/usr/bin/env node
/**
 * Seed script: Parse NIL Tracker raw data and insert into Supabase press_articles table.
 *
 * Usage:
 *   1. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *   2. Place raw data in scripts/nil-tracker-raw.txt
 *   3. Run: node scripts/seed-press-articles.mjs
 *
 * The raw data file should contain the Wix CMS export (tab/line-delimited records).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_WIX_URL = "https://www.home.pstgm.com";
const BATCH_SIZE = 50;

// ─── Wix Image URL Converter ─────────────────────────────
function convertWixImageUrl(wixUrl) {
  if (!wixUrl || !wixUrl.includes("wix:__image://")) return null;
  // Pattern: wix:__image://v1/MEDIA_ID/filename#params__
  const match = wixUrl.match(/wix:__image:\/\/v1\/([^/]+)\/([^#]+)/);
  if (!match) return null;
  const [, mediaId, filename] = match;
  const decodedFilename = decodeURIComponent(filename);
  return `https://static.wixstatic.com/media/${mediaId}/${decodedFilename}`;
}

// ─── Extract plain text from Wix Rich Text JSON ──────────
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
        if (texts.length > 0) {
          paragraphs.push(texts.join(""));
        }
      }
      // Only take first 2 paragraphs for excerpt
      if (paragraphs.length >= 2) break;
    }
    return paragraphs.join(" ") || null;
  } catch {
    return null;
  }
}

// ─── Parse JSON arrays from raw text ─────────────────────
function parseJsonArray(text) {
  if (!text || !text.startsWith("[")) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// ─── Slug from path ──────────────────────────────────────
function slugFromPath(p) {
  if (!p) return null;
  return p.replace(/^\/nil-tracker\//, "").replace(/^\/nil-tracker-1\//, "").replace(/\/$/, "");
}

// ─── Parse raw data file into records ────────────────────
function parseRawData(rawText) {
  const lines = rawText.split("\n");
  const records = [];
  let i = 0;

  while (i < lines.length) {
    // Skip blank lines until we find PUBLISHED or DRAFT
    const line = lines[i]?.trim();
    if (line !== "PUBLISHED" && line !== "DRAFT") {
      i++;
      continue;
    }

    const record = { status: line };
    i++;

    // Helper: read next non-undefined line
    const readLine = () => {
      if (i >= lines.length) return "";
      const l = lines[i];
      i++;
      return l ?? "";
    };

    // Player Name
    record.playerName = readLine().trim();

    // College Name
    record.college = readLine().trim();

    // Title
    record.title = readLine().trim();

    // Image URL (starts with wix:__image:// or empty)
    let nextLine = readLine();
    if (nextLine.includes("wix:__image://")) {
      record.imageUrl = nextLine.trim();
      nextLine = readLine();
    } else {
      record.imageUrl = "";
    }

    // Overview JSON (starts with {"nodes": or could be empty)
    if (nextLine.trim().startsWith('{"nodes"')) {
      record.overview = nextLine.trim();
      nextLine = readLine();
    } else {
      record.overview = "";
    }

    // Video URL (starts with wix:__video:// or empty)
    if (nextLine.includes("wix:__video://")) {
      record.videoUrl = nextLine.trim();
      nextLine = readLine();
    } else {
      record.videoUrl = "";
    }

    // Date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(nextLine.trim())) {
      record.date = nextLine.trim();
      nextLine = readLine();
    } else {
      record.date = "";
    }

    // Category path (/niltracker/)
    if (nextLine.trim().startsWith("/niltracker")) {
      record.categoryPath = nextLine.trim();
      nextLine = readLine();
    } else {
      record.categoryPath = "";
    }

    // Article slug path (/nil-tracker/)
    if (nextLine.trim().startsWith("/nil-tracker/")) {
      record.slugPath = nextLine.trim();
      nextLine = readLine();
    } else {
      record.slugPath = "";
    }

    // Sport Tags (JSON array)
    if (nextLine.trim().startsWith("[")) {
      record.sportTags = nextLine.trim();
      nextLine = readLine();
    } else {
      record.sportTags = "[]";
    }

    // Brand Tags (JSON array)
    if (nextLine.trim().startsWith("[")) {
      record.brandTags = nextLine.trim();
      nextLine = readLine();
    } else {
      record.brandTags = "[]";
    }

    // Industry Tags (JSON array)
    if (nextLine.trim().startsWith("[")) {
      record.industryTags = nextLine.trim();
      nextLine = readLine();
    } else {
      record.industryTags = "[]";
    }

    // Campaign Type (JSON array)
    if (nextLine.trim().startsWith("[")) {
      record.campaignType = nextLine.trim();
      nextLine = readLine();
    } else {
      record.campaignType = "[]";
    }

    // Case Study Highlight (optional, JSON array or empty)
    if (nextLine.trim().startsWith("[")) {
      record.caseStudyHighlight = nextLine.trim();
      nextLine = readLine();
    } else {
      record.caseStudyHighlight = "";
    }

    // Alt article path (/nil-tracker-1/)
    if (nextLine.trim().startsWith("/nil-tracker-1/")) {
      record.altSlugPath = nextLine.trim();
      nextLine = readLine();
    } else {
      record.altSlugPath = "";
    }

    // Publish Date (ISO)
    if (/^\d{4}-\d{2}-\d{2}T/.test(nextLine.trim())) {
      record.publishDate = nextLine.trim();
      nextLine = readLine();
    } else {
      record.publishDate = "";
    }

    // Unpublish Date (ISO or empty)
    if (/^\d{4}-\d{2}-\d{2}T/.test(nextLine.trim())) {
      record.unpublishDate = nextLine.trim();
      nextLine = readLine();
    } else {
      record.unpublishDate = "";
    }

    // Copy path (/copy-of-niltracker/)
    if (nextLine.trim().startsWith("/copy-of-niltracker/")) {
      record.copyPath = nextLine.trim();
      nextLine = readLine();
    } else {
      record.copyPath = "";
    }

    // ID (UUID)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(nextLine.trim())) {
      record.wixId = nextLine.trim();
      nextLine = readLine();
    } else {
      record.wixId = "";
    }

    // Created Date
    if (/^\d{4}-\d{2}-\d{2}T/.test(nextLine.trim())) {
      record.createdDate = nextLine.trim();
      nextLine = readLine();
    } else {
      record.createdDate = "";
    }

    // Updated Date
    if (/^\d{4}-\d{2}-\d{2}T/.test(nextLine.trim())) {
      record.updatedDate = nextLine.trim();
      nextLine = readLine();
    } else {
      record.updatedDate = "";
    }

    // Owner ID (UUID)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(nextLine.trim())) {
      record.ownerId = nextLine.trim();
      nextLine = readLine();
    } else {
      record.ownerId = "";
    }

    // Remaining optional fields (college HTML, extra names) - skip until next record
    // These are identified by <p> tags or plain text that isn't a status marker

    records.push(record);
  }

  return records;
}

// ─── Convert parsed record to PressArticle ───────────────
function toPressArticle(record, index) {
  const brands = parseJsonArray(record.brandTags);
  const sports = parseJsonArray(record.sportTags);
  const industries = parseJsonArray(record.industryTags);
  const campaignTypes = parseJsonArray(record.campaignType);

  const brand = brands[0] || null;
  const sport = sports[0] || null;
  const category = sport || (campaignTypes[0] || null);

  const slug = slugFromPath(record.slugPath) ||
               slugFromPath(record.altSlugPath) ||
               record.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
               `article-${index}`;

  const imageUrl = convertWixImageUrl(record.imageUrl);
  const excerpt = extractExcerpt(record.overview);

  const externalUrl = record.altSlugPath
    ? `${BASE_WIX_URL}${record.altSlugPath}`
    : record.slugPath
    ? `${BASE_WIX_URL}${record.slugPath}`
    : null;

  return {
    title: record.title || `${record.playerName} Campaign`,
    slug: slug.substring(0, 200), // Supabase text limit safety
    publication: brand,
    author: record.playerName || null,
    excerpt: excerpt ? excerpt.substring(0, 500) : null,
    content: record.overview || null,
    external_url: externalUrl,
    image_url: imageUrl,
    category: category,
    featured: false,
    published: record.status === "PUBLISHED",
    published_date: record.date || null,
    sort_order: index,
  };
}

// ─── Insert into Supabase ────────────────────────────────
async function insertBatch(articles) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/press_articles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(articles),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${err}`);
  }

  return res.status;
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  // Check env
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    console.log("\nUsage:");
    console.log("  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \\");
    console.log("  SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \\");
    console.log("  node scripts/seed-press-articles.mjs");
    console.log("\nOr to just generate JSON output:");
    console.log("  node scripts/seed-press-articles.mjs --dry-run");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const rawPath = path.join(__dirname, "nil-tracker-raw.txt");

  if (!fs.existsSync(rawPath)) {
    console.error(`❌ Raw data file not found: ${rawPath}`);
    console.log("Place the Wix NIL Tracker export data in scripts/nil-tracker-raw.txt");
    process.exit(1);
  }

  console.log("📖 Reading raw data...");
  const rawText = fs.readFileSync(rawPath, "utf-8");

  console.log("🔍 Parsing records...");
  const records = parseRawData(rawText);
  console.log(`   Found ${records.length} records`);

  const published = records.filter((r) => r.status === "PUBLISHED");
  const drafts = records.filter((r) => r.status === "DRAFT");
  console.log(`   ${published.length} published, ${drafts.length} drafts`);

  console.log("🔄 Converting to press articles...");
  const articles = records
    .filter((r) => r.title) // Skip records without titles
    .map((r, i) => toPressArticle(r, i));

  console.log(`   ${articles.length} articles ready`);

  if (dryRun) {
    const outPath = path.join(__dirname, "..", "src", "data", "press-articles.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(articles, null, 2));
    console.log(`\n✅ Dry run: wrote ${articles.length} articles to ${outPath}`);
    return;
  }

  // Insert in batches
  console.log(`\n📤 Inserting ${articles.length} articles in batches of ${BATCH_SIZE}...`);
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    try {
      const status = await insertBatch(batch);
      console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} articles (HTTP ${status})`);
    } catch (err) {
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err.message);
      // Try inserting one by one
      for (const article of batch) {
        try {
          await insertBatch([article]);
        } catch (e2) {
          console.error(`      ❌ Failed: "${article.title}" - ${e2.message}`);
        }
      }
    }
  }

  console.log("\n🎉 Done! Press articles seeded successfully.");
}

main().catch(console.error);
