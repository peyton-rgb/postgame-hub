// ─────────────────────────────────────────────────────────────────────────────
// pptx-export.ts
//
// Builds a fully editable .pptx file from a campaign's recap data.
// Mirrors the structure of the web recap page (src/components/CampaignRecap.tsx)
// but renders each section as native PowerPoint objects (text boxes, images,
// tables) rather than screenshots — so the deck is editable in PowerPoint.
//
// Public API:
//   buildRecapPptx(campaign, athletes, media) → Promise<Buffer>
//
// Slides generated (each respects campaign.settings.visible_sections):
//   1. Title
//   2. Campaign Overview
//   3. Key Takeaways (optional)
//   4. KPI Targets vs Actuals (optional)
//   5. Hero Metrics (8 stat boxes)
//   6. Platform Breakdown
//   7. Top Performers
//   8+. Content Gallery (3×3 photo grids, multiple slides)
//   N. Roster
// ─────────────────────────────────────────────────────────────────────────────

import PptxGenJS from "pptxgenjs";
import type { Campaign, Athlete, Media, VisibleSections } from "@/lib/types";
import {
  fmt,
  pct,
  dollar,
  computeStatsWithOverrides,
  getTopPerformers,
} from "@/lib/recap-helpers";
import { supabaseImageUrl } from "@/lib/supabase-image";

// ─── Brand constants (match the web page) ───────────────────────────────────
const BG_DARK = "111111";       // #111111 recap background
const TEXT_WHITE = "FFFFFF";
const TEXT_MUTED = "B3B3B3";    // approximate white/70
const TEXT_DIM = "808080";      // approximate white/50
const BRAND_ORANGE = "D73F09";  // Postgame brand accent
const PANEL_FILL = "1A1A1A";    // Slightly lighter than BG for stat boxes
const BORDER_DIM = "2E2E2E";    // Subtle border color

// Slide dimensions (16:9 widescreen — pptxgenjs LAYOUT_WIDE)
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

// Font stack — PowerPoint-safe fallbacks that look close to the web page's bold
// sans-serif. "Arial Black" for display headings, "Arial" for body text.
const FONT_HEAD = "Arial Black";
const FONT_BODY = "Arial";

// ─── Image pre-fetching ─────────────────────────────────────────────────────
// We pre-fetch every image up front with a strict per-image timeout and
// bounded concurrency, then hand pptxgenjs base64 data URLs instead of
// external URLs. This prevents pptxgenjs's internal fetcher from hanging
// on slow images, and lets us swap failed fetches for placeholders rather
// than killing the entire deck build.

const IMAGE_FETCH_TIMEOUT_MS = 6000;
const IMAGE_FETCH_CONCURRENCY = 8;

// 1×1 transparent PNG, used when an image fetch fails.
const PLACEHOLDER_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[pptx-export] Image ${res.status} for ${url.slice(0, 80)}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.warn(`[pptx-export] Image fetch failed for ${url.slice(0, 80)}: ${(e as Error).message}`);
    return null;
  }
}

async function prefetchImages(urls: string[]): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (unique.length === 0) return cache;

  let cursor = 0;
  const worker = async () => {
    while (cursor < unique.length) {
      const i = cursor++;
      const url = unique[i];
      const data = await fetchImageAsDataUrl(url);
      if (data) cache.set(url, data);
    }
  };
  const workers = Array.from(
    { length: Math.min(IMAGE_FETCH_CONCURRENCY, unique.length) },
    worker,
  );
  await Promise.all(workers);

  const missing = unique.length - cache.size;
  console.log(`[pptx-export] Prefetched ${cache.size}/${unique.length} images${missing > 0 ? ` (${missing} failed, will use placeholder)` : ""}`);
  return cache;
}

/** Look up a cached data URL or return the placeholder. Never throws. */
function imageDataOrPlaceholder(cache: Map<string, string>, url: string | null | undefined): string {
  if (!url) return PLACEHOLDER_DATA_URL;
  return cache.get(url) || PLACEHOLDER_DATA_URL;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Remove characters that break filenames on Windows/Mac. */
export function safeFileName(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, "-").trim();
}

/** Build the download filename: ClientName-CampaignName-Recap.pptx */
export function recapFileName(campaign: Campaign): string {
  const client = safeFileName(campaign.client_name || "Campaign");
  const name = safeFileName(campaign.name || "Recap");
  return `${client}-${name}-Recap.pptx`;
}

/** Shortcut for respecting settings.visible_sections (default true). */
function shown(vis: VisibleSections | undefined, key: keyof VisibleSections) {
  return !vis || vis[key] !== false;
}

/** Add the Postgame footer bar at the bottom of a slide. */
function addFooter(slide: PptxGenJS.Slide, label: string) {
  slide.addText("POSTGAME", {
    x: 0.4, y: SLIDE_H - 0.4, w: 2, h: 0.25,
    fontFace: FONT_HEAD, fontSize: 9, color: TEXT_DIM,
    charSpacing: 2,
  });
  slide.addText(label, {
    x: SLIDE_W - 4.4, y: SLIDE_H - 0.4, w: 4, h: 0.25,
    fontFace: FONT_HEAD, fontSize: 9, color: TEXT_DIM,
    align: "right", charSpacing: 2,
  });
}

/** Add a section heading in the top-left of a slide. */
function addSectionHeading(slide: PptxGenJS.Slide, text: string) {
  slide.addText(text.toUpperCase(), {
    x: 0.5, y: 0.4, w: SLIDE_W - 1, h: 0.7,
    fontFace: FONT_HEAD, fontSize: 28, color: TEXT_WHITE, bold: true,
    charSpacing: 2,
  });
  // Thin orange underline under the heading
  slide.addShape("rect", {
    x: 0.5, y: 1.15, w: 0.8, h: 0.05,
    fill: { color: BRAND_ORANGE }, line: { color: BRAND_ORANGE },
  });
}

/** Create a slide with the standard dark background. */
function newSlide(pres: PptxGenJS): PptxGenJS.Slide {
  const slide = pres.addSlide();
  slide.background = { color: BG_DARK };
  return slide;
}

// ─── Slide builders ─────────────────────────────────────────────────────────

function addTitleSlide(pres: PptxGenJS, campaign: Campaign, imageCache: Map<string, string>) {
  const slide = newSlide(pres);
  const settings = campaign.settings || {};

  // Subtle top gradient band using a large semi-transparent rectangle
  slide.addShape("rect", {
    x: 0, y: 0, w: SLIDE_W, h: 2.5,
    fill: { color: "1A1A1A" }, line: { color: "1A1A1A" },
  });

  // Brand logo (if provided and cached) — centered, above the campaign name
  const logoUrl = settings.brand_logo_url || campaign.client_logo_url;
  const logoData = logoUrl ? imageCache.get(logoUrl) : null;
  if (logoData) {
    slide.addImage({
      data: logoData,
      x: SLIDE_W / 2 - 1.5, y: 1.5, w: 3, h: 1.5,
      sizing: { type: "contain", w: 3, h: 1.5 },
    });
  }

  // Campaign name — big uppercase headline
  slide.addText(campaign.name || "Campaign Recap", {
    x: 0.5, y: 3.3, w: SLIDE_W - 1, h: 1.2,
    fontFace: FONT_HEAD, fontSize: 48, color: TEXT_WHITE, bold: true,
    align: "center", charSpacing: 2,
  });

  // Client name underline
  slide.addText(campaign.client_name || "", {
    x: 0.5, y: 4.5, w: SLIDE_W - 1, h: 0.5,
    fontFace: FONT_BODY, fontSize: 18, color: TEXT_MUTED,
    align: "center", charSpacing: 4,
  });

  // "NIL Campaign Recap" pill in Postgame orange
  const pillW = 3, pillH = 0.5;
  slide.addShape("roundRect", {
    x: SLIDE_W / 2 - pillW / 2, y: 5.4, w: pillW, h: pillH,
    fill: { color: BRAND_ORANGE }, line: { color: BRAND_ORANGE },
    rectRadius: 0.25,
  });
  slide.addText("NIL CAMPAIGN RECAP", {
    x: SLIDE_W / 2 - pillW / 2, y: 5.4, w: pillW, h: pillH,
    fontFace: FONT_HEAD, fontSize: 14, color: TEXT_WHITE, bold: true,
    align: "center", valign: "middle", charSpacing: 3,
  });

  addFooter(slide, "CAMPAIGN RECAP");
}

function addOverviewSlide(pres: PptxGenJS, campaign: Campaign, autoContentTypes: string) {
  const slide = newSlide(pres);
  const settings = campaign.settings || {};
  // content_type lives in the settings JSON at runtime but isn't declared on
  // the Campaign type — read it loosely to match the web page's behavior.
  const settingsLoose = settings as Record<string, unknown>;
  addSectionHeading(slide, "Campaign Overview");

  // Left column — description
  if (settings.description) {
    slide.addText(settings.description, {
      x: 0.5, y: 1.6, w: 6, h: 5,
      fontFace: FONT_BODY, fontSize: 14, color: TEXT_MUTED,
      valign: "top", paraSpaceAfter: 8,
    });
  }

  // Right column — key/value rows
  type Row = [label: string, value: string | undefined];
  const rows: Row[] = ([
    ["CAMPAIGN NAME", campaign.name],
    ["TIMEFRAME", settings.quarter],
    ["PLATFORM(S)", settings.platform],
    ["CONTENT TYPE", (settingsLoose.content_type as string | undefined) || autoContentTypes],
    ["CAMPAIGN TYPE", settings.campaign_type],
  ] as Row[]).filter(([, v]) => !!v);

  const colX = 7, colW = SLIDE_W - 7 - 0.5;
  let rowY = 1.6;
  const rowH = 0.7;
  for (const [label, value] of rows) {
    slide.addText(label, {
      x: colX, y: rowY, w: 2.2, h: rowH,
      fontFace: FONT_HEAD, fontSize: 9, color: TEXT_MUTED, bold: true,
      charSpacing: 2, valign: "middle",
    });
    slide.addText(String(value ?? ""), {
      x: colX + 2.2, y: rowY, w: colW - 2.2, h: rowH,
      fontFace: FONT_BODY, fontSize: 12, color: TEXT_WHITE, bold: true,
      valign: "middle",
    });
    // Row divider
    slide.addShape("line", {
      x: colX, y: rowY + rowH, w: colW, h: 0,
      line: { color: BORDER_DIM, width: 0.75 },
    });
    rowY += rowH;
  }

  addFooter(slide, "CAMPAIGN OVERVIEW");
}

function addKeyTakeawaysSlide(pres: PptxGenJS, takeaways: string) {
  const slide = newSlide(pres);
  addSectionHeading(slide, "Key Takeaways");

  // A single framed panel for the text
  slide.addShape("roundRect", {
    x: 0.5, y: 1.6, w: SLIDE_W - 1, h: 5.2,
    fill: { color: PANEL_FILL }, line: { color: BORDER_DIM, width: 1 },
    rectRadius: 0.1,
  });
  slide.addText(takeaways, {
    x: 0.9, y: 1.9, w: SLIDE_W - 1.8, h: 4.6,
    fontFace: FONT_BODY, fontSize: 16, color: TEXT_WHITE,
    valign: "top", paraSpaceAfter: 8,
  });

  addFooter(slide, "KEY TAKEAWAYS");
}

function addKpiSlide(pres: PptxGenJS, campaign: Campaign, stats: ReturnType<typeof computeStatsWithOverrides>) {
  const settings = campaign.settings || {};
  const t = settings.kpi_targets || {};
  const hasBudget = settings.budget != null && settings.budget > 0;

  // Build the list of KPI rows: label, target, actual
  const rows: Array<{ label: string; target: string; actual: string }> = [];
  if (hasBudget) {
    rows.push({ label: "BUDGET", target: dollar(settings.budget), actual: "—" });
    const actualCpm = settings.budget! > 0 && stats.totalImpressions > 0
      ? (settings.budget! / stats.totalImpressions) * 1000
      : 0;
    rows.push({
      label: "CPM",
      target: t.cpm ? dollar(t.cpm) : "—",
      actual: actualCpm > 0 ? dollar(actualCpm) : "—",
    });
  }
  if (t.athlete_quantity) rows.push({ label: "ATHLETES", target: fmt(t.athlete_quantity), actual: fmt(stats.athleteCount) });
  if (t.content_units) rows.push({ label: "CONTENT UNITS", target: fmt(t.content_units), actual: fmt(stats.totalPosts) });
  if (t.posts) rows.push({ label: "POSTS", target: fmt(t.posts), actual: fmt(stats.totalPosts) });
  if (t.impressions) rows.push({ label: "IMPRESSIONS", target: fmt(t.impressions), actual: fmt(stats.totalImpressions) });
  if (t.engagements) rows.push({ label: "ENGAGEMENTS", target: fmt(t.engagements), actual: fmt(stats.totalEngagements) });
  if (t.engagement_rate) rows.push({ label: "ENGAGEMENT RATE", target: pct(t.engagement_rate), actual: pct(stats.avgEngRate) });
  if (t.other_kpis) rows.push({ label: "OTHER KPIS", target: t.other_kpis, actual: "—" });

  if (rows.length === 0) return;

  const slide = newSlide(pres);
  addSectionHeading(slide, "KPI Targets vs Actuals");

  // Column headers
  const tableY = 1.6, rowH = Math.min(0.6, (SLIDE_H - 1.6 - 0.6) / (rows.length + 1));
  const colLabel = 0.5, colTarget = 6.5, colActual = 10.0, colW = 3;
  slide.addText("KPI", {
    x: colLabel, y: tableY, w: 6, h: rowH,
    fontFace: FONT_HEAD, fontSize: 10, color: TEXT_MUTED, bold: true, charSpacing: 2, valign: "middle",
  });
  slide.addText("TARGET", {
    x: colTarget, y: tableY, w: colW, h: rowH,
    fontFace: FONT_HEAD, fontSize: 10, color: TEXT_MUTED, bold: true, charSpacing: 2, valign: "middle",
  });
  slide.addText("ACTUAL", {
    x: colActual, y: tableY, w: colW, h: rowH,
    fontFace: FONT_HEAD, fontSize: 10, color: TEXT_MUTED, bold: true, charSpacing: 2, valign: "middle",
  });
  slide.addShape("line", {
    x: 0.5, y: tableY + rowH, w: SLIDE_W - 1, h: 0,
    line: { color: BORDER_DIM, width: 1 },
  });

  // Data rows
  let y = tableY + rowH;
  for (const r of rows) {
    slide.addText(r.label, {
      x: colLabel, y, w: 6, h: rowH,
      fontFace: FONT_HEAD, fontSize: 12, color: TEXT_WHITE, bold: true, charSpacing: 1, valign: "middle",
    });
    slide.addText(r.target, {
      x: colTarget, y, w: colW, h: rowH,
      fontFace: FONT_BODY, fontSize: 14, color: TEXT_MUTED, valign: "middle",
    });
    slide.addText(r.actual, {
      x: colActual, y, w: colW, h: rowH,
      fontFace: FONT_HEAD, fontSize: 16, color: BRAND_ORANGE, bold: true, valign: "middle",
    });
    slide.addShape("line", {
      x: 0.5, y: y + rowH, w: SLIDE_W - 1, h: 0,
      line: { color: BORDER_DIM, width: 0.5 },
    });
    y += rowH;
  }

  addFooter(slide, "KPI TARGETS");
}

function addHeroMetricsSlide(pres: PptxGenJS, stats: ReturnType<typeof computeStatsWithOverrides>) {
  const slide = newSlide(pres);
  addSectionHeading(slide, "Campaign Metrics");

  // Average engagement rate: average only the platforms that actually posted.
  // (Earlier this was `(ig + tiktok) / 2`, which halved the rate on single-platform
  // campaigns — e.g. TikTok-only campaigns showed 4% instead of 8%.)
  const platformRates = [stats.igAvgEngRate, stats.tiktokAvgEngRate].filter((r) => r > 0);
  const avgEngagementRate = platformRates.length > 0
    ? platformRates.reduce((sum, r) => sum + r, 0) / platformRates.length
    : stats.avgEngRate;

  const boxes: Array<{ label: string; value: string }> = [
    { label: "ATHLETES", value: fmt(stats.athleteCount) },
    { label: "SCHOOLS", value: fmt(stats.schoolCount) },
    { label: "SPORTS", value: fmt(stats.sportCount) },
    { label: "TOTAL POSTS", value: fmt(stats.totalPosts) },
    { label: "COMBINED FOLLOWERS", value: fmt(stats.combinedFollowers) },
    { label: "TOTAL IMPRESSIONS", value: fmt(stats.totalImpressions) },
    { label: "TOTAL ENGAGEMENTS", value: fmt(stats.totalEngagements) },
    { label: "AVG ENGAGEMENT RATE", value: pct(avgEngagementRate) },
  ];

  // Grid: 4 columns × 2 rows
  const cols = 4, rows = 2;
  const gridX = 0.5, gridY = 1.6;
  const gridW = SLIDE_W - 1, gridH = SLIDE_H - gridY - 0.8;
  const gap = 0.2;
  const cellW = (gridW - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap * (rows - 1)) / rows;

  boxes.forEach((b, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const x = gridX + c * (cellW + gap);
    const y = gridY + r * (cellH + gap);
    slide.addShape("roundRect", {
      x, y, w: cellW, h: cellH,
      fill: { color: PANEL_FILL }, line: { color: BORDER_DIM, width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(b.value, {
      x, y: y + 0.3, w: cellW, h: cellH * 0.55,
      fontFace: FONT_HEAD, fontSize: 40, color: TEXT_WHITE, bold: true,
      align: "center", valign: "middle",
    });
    slide.addText(b.label, {
      x, y: y + cellH * 0.7, w: cellW, h: cellH * 0.25,
      fontFace: FONT_HEAD, fontSize: 10, color: TEXT_MUTED, bold: true,
      align: "center", charSpacing: 2,
    });
  });

  addFooter(slide, "CAMPAIGN METRICS");
}

function addPlatformBreakdownSlide(pres: PptxGenJS, stats: ReturnType<typeof computeStatsWithOverrides>) {
  // Skip if no platform activity
  if (stats.igFeedPosts + stats.igReelPosts + stats.tiktokPosts === 0) return;

  const slide = newSlide(pres);
  addSectionHeading(slide, "Platform Breakdown");

  type Col = { label: string; values: string[] };
  const avg = (sum: number, count: number) => count > 0 ? pct(sum / count) : "—";

  const cols: Col[] = [
    {
      label: "IG FEED",
      values: [
        fmt(stats.igFeedPosts),
        fmt(stats.igFeed.impressions),
        fmt(stats.igFeed.engagements),
        avg(stats.igFeed.engRateSum, stats.igFeed.engRateCount),
      ],
    },
    {
      label: "IG REELS",
      values: [
        fmt(stats.igReelPosts),
        fmt(stats.igReel.views),
        fmt(stats.igReel.engagements),
        avg(stats.igReel.engRateSum, stats.igReel.engRateCount),
      ],
    },
    {
      label: "TIKTOK",
      values: [
        fmt(stats.tiktokPosts),
        fmt(stats.tiktok.views),
        fmt(stats.tiktok.engagements),
        avg(stats.tiktok.engRateSum, stats.tiktok.engRateCount),
      ],
    },
  ];

  const rowLabels = ["POSTS", "IMPRESSIONS / VIEWS", "ENGAGEMENTS", "ENG. RATE"];
  const tableY = 1.6;
  const rowLabelW = 3;
  const colW = (SLIDE_W - 1 - rowLabelW) / cols.length;
  const headerH = 0.6;
  const rowH = (SLIDE_H - tableY - headerH - 0.8) / rowLabels.length;

  // Column headers
  cols.forEach((col, ci) => {
    const x = 0.5 + rowLabelW + ci * colW;
    slide.addText(col.label, {
      x, y: tableY, w: colW, h: headerH,
      fontFace: FONT_HEAD, fontSize: 12, color: BRAND_ORANGE, bold: true,
      align: "center", valign: "middle", charSpacing: 3,
    });
  });

  // Rows
  rowLabels.forEach((label, ri) => {
    const y = tableY + headerH + ri * rowH;
    slide.addText(label, {
      x: 0.5, y, w: rowLabelW, h: rowH,
      fontFace: FONT_HEAD, fontSize: 11, color: TEXT_MUTED, bold: true,
      valign: "middle", charSpacing: 2,
    });
    cols.forEach((col, ci) => {
      const x = 0.5 + rowLabelW + ci * colW;
      slide.addText(col.values[ri], {
        x, y, w: colW, h: rowH,
        fontFace: FONT_HEAD, fontSize: 20, color: TEXT_WHITE, bold: true,
        align: "center", valign: "middle",
      });
    });
    slide.addShape("line", {
      x: 0.5, y: y + rowH, w: SLIDE_W - 1, h: 0,
      line: { color: BORDER_DIM, width: 0.5 },
    });
  });

  addFooter(slide, "PLATFORM BREAKDOWN");
}

function addTopPerformersSlide(pres: PptxGenJS, athletes: Athlete[]) {
  const top = getTopPerformers(athletes, 5);
  if (top.length === 0) return;

  const slide = newSlide(pres);
  addSectionHeading(slide, "Top Performers");

  const startY = 1.6;
  const rowH = (SLIDE_H - startY - 0.8) / top.length;
  top.forEach((a, i) => {
    const y = startY + i * rowH;
    // Rank number
    slide.addText(String(i + 1), {
      x: 0.5, y, w: 1, h: rowH,
      fontFace: FONT_HEAD, fontSize: 48, color: BRAND_ORANGE, bold: true,
      align: "center", valign: "middle",
    });
    // Athlete name + school
    slide.addText(a.name, {
      x: 1.8, y: y + 0.1, w: 6, h: rowH * 0.45,
      fontFace: FONT_HEAD, fontSize: 20, color: TEXT_WHITE, bold: true,
      valign: "bottom",
    });
    slide.addText(`${a.school} · ${a.sport}${a.bestPlatform ? ` · ${a.bestPlatform}` : ""}`, {
      x: 1.8, y: y + rowH * 0.5, w: 6, h: rowH * 0.4,
      fontFace: FONT_BODY, fontSize: 12, color: TEXT_MUTED,
      valign: "top",
    });
    // Engagement rate (big) on the right
    slide.addText(pct(a.bestEngRate), {
      x: SLIDE_W - 3.5, y, w: 3, h: rowH,
      fontFace: FONT_HEAD, fontSize: 32, color: TEXT_WHITE, bold: true,
      align: "right", valign: "middle",
    });
    // Row divider
    slide.addShape("line", {
      x: 0.5, y: y + rowH, w: SLIDE_W - 1, h: 0,
      line: { color: BORDER_DIM, width: 0.5 },
    });
  });

  addFooter(slide, "TOP PERFORMERS");
}

/** Collect the gallery cover items (pure — no side effects). */
function collectGalleryCoverItems(
  galleryAthletes: Athlete[],
  media: Record<string, Media[]>,
): Array<{ athlete: Athlete; imageUrl: string }> {
  const coverItems: Array<{ athlete: Athlete; imageUrl: string }> = [];
  for (const a of galleryAthletes) {
    const items = media[a.id] || [];
    const img = items.find((m) => m.type === "image" && !m.is_video_thumbnail)
      || items.find((m) => m.type === "video" && m.thumbnail_url)
      || items[0];
    if (!img) continue;
    const url = img.type === "video" && img.thumbnail_url ? img.thumbnail_url : img.file_url;
    const resized = supabaseImageUrl(url, 1200) || url;
    if (resized) coverItems.push({ athlete: a, imageUrl: resized });
  }
  return coverItems;
}

function addGallerySlides(
  pres: PptxGenJS,
  galleryAthletes: Athlete[],
  media: Record<string, Media[]>,
  imageCache: Map<string, string>,
) {
  const coverItems = collectGalleryCoverItems(galleryAthletes, media);
  if (coverItems.length === 0) return;

  // ── Carousel build ────────────────────────────────────────────────────
  // Create N structurally-identical slides (one per photo). The first is
  // visible; the rest are hidden. Left/right arrow buttons hyperlink to the
  // previous/next slide in the chain (wrapping at the ends). Push transitions
  // make advancing feel like swiping. In presentation mode the viewer
  // experiences "one slide with a carousel"; hidden slides don't appear in
  // the normal click-advance sequence.
  const N = coverItems.length;

  // pres.slides is 0-indexed internally but PowerPoint's slide hyperlinks are
  // 1-indexed. Slides we add during this loop will land at positions
  // (currentLength + 1) through (currentLength + N).
  // Use `any` because pptxgenjs's public types don't expose .slides, even
  // though the property is always present and stable.
  const startSlideNum = ((pres as unknown as { slides: unknown[] }).slides.length) + 1;

  // Photo frame geometry — PORTRAIT orientation to match Instagram's 4:5 feed
  // and 9:16 Reel aspect ratios. The `contain` sizing below preserves each
  // image's own aspect ratio without cropping; a portrait frame means 4:5 and
  // 9:16 photos fill it naturally, and 1:1 squares still look right (small
  // bottom gutter only). Landscape photos would get side gutters, but NIL
  // campaign content is overwhelmingly vertical.
  const photoH = 4.8;
  const photoW = photoH * 0.8;               // 3.84" — matches 4:5 feed aspect
  const photoX = (SLIDE_W - photoW) / 2;     // centered horizontally
  const photoY = 1.25;

  // Arrow buttons — vertically centered on the photo
  const arrowSize = 0.75;
  const arrowY = photoY + photoH / 2 - arrowSize / 2;

  // Position dots row
  const dotSize = 0.14, dotGap = 0.16;
  const dotsY = 6.88;

  for (let i = 0; i < N; i++) {
    const slide = newSlide(pres);
    const thisNum = startSlideNum + i;
    const prevNum = i === 0 ? startSlideNum + N - 1 : thisNum - 1;
    const nextNum = i === N - 1 ? startSlideNum : thisNum + 1;

    // Slides 2..N are hidden from the normal click-advance sequence.
    // `hidden` / `transition` aren't in pptxgenjs's public TS types, but the
    // properties are honored at write time.
    const mutable = slide as unknown as {
      hidden?: boolean;
      transition?: { type: string; dir?: string; duration?: number };
    };
    if (i > 0) mutable.hidden = true;
    mutable.transition = { type: "push", dir: "r", duration: 400 };

    const heading = N > 1 ? `Best In Class (${i + 1}/${N})` : "Best In Class";
    addSectionHeading(slide, heading);

    const item = coverItems[i];

    // ── Main photo ─────────────────────────────────────────────────────
    slide.addImage({
      data: imageDataOrPlaceholder(imageCache, item.imageUrl),
      x: photoX, y: photoY, w: photoW, h: photoH,
      sizing: { type: "contain", w: photoW, h: photoH },
    });

    // Athlete name
    slide.addText(item.athlete.name, {
      x: 1, y: photoY + photoH + 0.08, w: SLIDE_W - 2, h: 0.38,
      fontFace: FONT_HEAD, fontSize: 20, color: TEXT_WHITE, bold: true,
      align: "center", charSpacing: 2,
    });
    // School · Sport
    slide.addText(
      `${item.athlete.school || ""}${item.athlete.sport ? ` · ${item.athlete.sport}` : ""}`,
      {
        x: 1, y: photoY + photoH + 0.48, w: SLIDE_W - 2, h: 0.26,
        fontFace: FONT_BODY, fontSize: 12, color: TEXT_MUTED,
        align: "center",
      },
    );

    // ── Left arrow button (hyperlinks to previous slide) ──────────────
    slide.addShape("ellipse", {
      x: 0.4, y: arrowY, w: arrowSize, h: arrowSize,
      fill: { color: PANEL_FILL }, line: { color: BORDER_DIM, width: 1.5 },
    });
    slide.addText("‹", {
      x: 0.4, y: arrowY - 0.05, w: arrowSize, h: arrowSize,
      fontFace: FONT_HEAD, fontSize: 32, color: TEXT_WHITE, bold: true,
      align: "center", valign: "middle",
      hyperlink: { slide: prevNum, tooltip: "Previous photo" },
    });

    // ── Right arrow button (hyperlinks to next slide) ─────────────────
    slide.addShape("ellipse", {
      x: SLIDE_W - 0.4 - arrowSize, y: arrowY, w: arrowSize, h: arrowSize,
      fill: { color: BRAND_ORANGE }, line: { color: BRAND_ORANGE, width: 1.5 },
    });
    slide.addText("›", {
      x: SLIDE_W - 0.4 - arrowSize, y: arrowY - 0.05, w: arrowSize, h: arrowSize,
      fontFace: FONT_HEAD, fontSize: 32, color: TEXT_WHITE, bold: true,
      align: "center", valign: "middle",
      hyperlink: { slide: nextNum, tooltip: "Next photo" },
    });

    // ── Position dots at the bottom ───────────────────────────────────
    const totalDotsW = N * dotSize + (N - 1) * dotGap;
    const dotsStartX = (SLIDE_W - totalDotsW) / 2;
    for (let j = 0; j < N; j++) {
      slide.addShape("ellipse", {
        x: dotsStartX + j * (dotSize + dotGap), y: dotsY,
        w: dotSize, h: dotSize,
        fill: { color: j === i ? BRAND_ORANGE : "333333" },
        line: { color: j === i ? BRAND_ORANGE : "333333" },
      });
    }

    // ── Small hint on the first slide only ───────────────────────────
    if (i === 0) {
      slide.addText("CLICK ARROWS TO ADVANCE · PRESENTATION MODE RECOMMENDED", {
        x: 1, y: 0.05, w: SLIDE_W - 2, h: 0.3,
        fontFace: FONT_BODY, fontSize: 8, color: TEXT_DIM, italic: true,
        align: "center", charSpacing: 2,
      });
    }

    addFooter(slide, "BEST IN CLASS");
  }
}

function addRosterSlides(pres: PptxGenJS, athletes: Athlete[]) {
  if (athletes.length === 0) return;

  // Roomier layout: 3 columns × 4 rows = 12 per slide.
  // Each card is ~3.9" wide × 1.2" tall — enough for name, school, and
  // followers stacked on their own lines with breathing room.
  const cols = 3, rows = 4, perSlide = cols * rows;
  const gridX = 0.5, gridY = 1.6;
  const gridW = SLIDE_W - 1, gridH = SLIDE_H - gridY - 0.8;
  const gap = 0.18;
  const cellW = (gridW - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap * (rows - 1)) / rows;

  // Card interior layout (absolute offsets from each card's top-left corner)
  const padL = 0.2;
  const nameTop = 0.18;
  const nameH = 0.32;
  const schoolTop = nameTop + nameH + 0.02;        // 0.52
  const schoolH = 0.26;
  const followersTop = schoolTop + schoolH + 0.08; // 0.86
  const followersH = 0.26;

  const pageCount = Math.ceil(athletes.length / perSlide);
  for (let p = 0; p < pageCount; p++) {
    const slide = newSlide(pres);
    const heading = pageCount > 1 ? `Roster (${p + 1}/${pageCount})` : "Roster";
    addSectionHeading(slide, heading);

    const pageItems = athletes.slice(p * perSlide, (p + 1) * perSlide);
    pageItems.forEach((a, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const x = gridX + c * (cellW + gap);
      const y = gridY + r * (cellH + gap);

      // Card background
      slide.addShape("roundRect", {
        x, y, w: cellW, h: cellH,
        fill: { color: PANEL_FILL }, line: { color: BORDER_DIM, width: 0.75 },
        rectRadius: 0.1,
      });

      // Name (bold, white)
      slide.addText(a.name, {
        x: x + padL, y: y + nameTop, w: cellW - 2 * padL, h: nameH,
        fontFace: FONT_HEAD, fontSize: 13, color: TEXT_WHITE, bold: true,
        valign: "middle",
      });
      // School · Sport (muted)
      slide.addText(`${a.school || ""}${a.sport ? ` · ${a.sport}` : ""}`, {
        x: x + padL, y: y + schoolTop, w: cellW - 2 * padL, h: schoolH,
        fontFace: FONT_BODY, fontSize: 10, color: TEXT_MUTED,
        valign: "middle",
      });
      // Followers (orange, only if known)
      if (a.ig_followers) {
        slide.addText(`${fmt(a.ig_followers)} IG FOLLOWERS`, {
          x: x + padL, y: y + followersTop, w: cellW - 2 * padL, h: followersH,
          fontFace: FONT_HEAD, fontSize: 10, color: BRAND_ORANGE, bold: true,
          charSpacing: 1, valign: "middle",
        });
      }
    });

    addFooter(slide, "ROSTER");
  }
}

// ─── Main entry point ───────────────────────────────────────────────────────

export async function buildRecapPptx(
  campaign: Campaign,
  athletes: Athlete[],
  media: Record<string, Media[]>,
): Promise<Buffer> {
  const tStart = Date.now();
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.333" × 7.5"
  pres.author = "Postgame";
  pres.company = "Postgame";
  pres.title = `${campaign.name || "Campaign"} Recap`;

  const settings = campaign.settings || {};
  const vis = settings.visible_sections;

  // Compute stats once — same call the web page makes
  const stats = computeStatsWithOverrides(athletes, campaign);

  // Auto-derived content types (mirrors CampaignRecap.tsx logic)
  const autoContentTypes = [
    stats.igFeedPosts > 0 && "IG Feed",
    stats.igReelPosts > 0 && "Reels",
    stats.tiktokPosts > 0 && "TikTok BTS",
  ].filter(Boolean).join(", ");

  // Gallery athletes: those with at least one real uploaded image (not just thumbnails)
  const galleryAthletes = athletes.filter((a) => {
    const items = media[a.id] || [];
    return items.some((m) => m.type === "image" && !m.is_video_thumbnail)
        || items.some((m) => m.type === "video" && m.thumbnail_url);
  });

  // ── Pre-fetch every image we'll embed ──────────────────────────────────
  // Collecting URLs first lets us fetch them in parallel with a strict
  // per-image timeout. pptxgenjs's own path-based fetcher is serial and
  // unbounded, which can hang the whole deck build on Vercel.
  const imageUrls: string[] = [];
  const logoUrl = settings.brand_logo_url || campaign.client_logo_url;
  if (logoUrl) imageUrls.push(logoUrl);

  const galleryCoverItems = collectGalleryCoverItems(galleryAthletes, media);
  galleryCoverItems.forEach((item) => imageUrls.push(item.imageUrl));

  console.log(`[pptx-export] Building "${campaign.name}" — ${athletes.length} athletes, ${galleryCoverItems.length} gallery photos`);
  const tFetchStart = Date.now();
  const imageCache = await prefetchImages(imageUrls);
  console.log(`[pptx-export] Image prefetch took ${Date.now() - tFetchStart}ms`);

  // ── Build slides ───────────────────────────────────────────────────────
  const tSlidesStart = Date.now();

  // 1. Title
  addTitleSlide(pres, campaign, imageCache);

  // 2. Overview
  if (shown(vis, "brief")) {
    addOverviewSlide(pres, campaign, autoContentTypes);
  }

  // 3. Key Takeaways
  if (shown(vis, "key_takeaways") && settings.key_takeaways) {
    addKeyTakeawaysSlide(pres, settings.key_takeaways);
  }

  // 4. KPIs
  if (shown(vis, "kpi_targets")) {
    addKpiSlide(pres, campaign, stats);
  }

  // 5. Hero metrics
  if (shown(vis, "metrics")) {
    addHeroMetricsSlide(pres, stats);
    addPlatformBreakdownSlide(pres, stats);
  }

  // 6. Top performers
  if (shown(vis, "top_performers")) {
    addTopPerformersSlide(pres, athletes);
  }

  // 7. Gallery carousel
  if (shown(vis, "content_gallery")) {
    addGallerySlides(pres, galleryAthletes, media, imageCache);
  }

  // 8. Roster
  if (shown(vis, "roster")) {
    addRosterSlides(pres, athletes);
  }
  console.log(`[pptx-export] Slide composition took ${Date.now() - tSlidesStart}ms`);

  // Write to Node Buffer so the API route can return it as a download
  const tWriteStart = Date.now();
  const out = await pres.write({ outputType: "nodebuffer" });
  console.log(`[pptx-export] PPTX serialization took ${Date.now() - tWriteStart}ms`);
  console.log(`[pptx-export] Total build: ${Date.now() - tStart}ms, output size ${(out as Buffer).length} bytes`);

  return out as Buffer;
}
