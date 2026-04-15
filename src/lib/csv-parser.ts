import type { AthleteMetrics } from "./types";

export interface ParsedAthlete {
  first: string;
  last: string;
  name: string;
  ig_handle: string;
  ig_followers: number;
  content_rating: string;
  reach_level: string;
  school: string;
  sport: string;
  gender: string;
  notes: string;
  metrics: AthleteMetrics;
}

function parseNum(val: string | undefined): number | undefined {
  if (!val || val.trim() === "") return undefined;
  const n = parseFloat(val.replace(/[$,%]/g, "").trim());
  return isNaN(n) ? undefined : n;
}

function parseRate(val: string | undefined): number | undefined {
  if (!val || val.trim() === "") return undefined;
  const cleaned = val.replace(/,/g, "").replace(/%/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

/**
 * Detect if the first row is a platform group header (e.g. "IG FEED POSTS", "IG STORIES")
 * rather than the actual column headers. If so, return row 1 as headers and data starting at row 2.
 * Otherwise, return row 0 as headers and data starting at row 1.
 *
 * Also returns row0 (the group label row, when present) so callers can build a
 * column→platform map for scoped column resolution. row0 will be undefined when
 * the file has no group label row.
 */
function detectHeaderRow(
  lines: string[],
  delimiter = ","
): { headers: string[]; dataStartIndex: number; groupRow?: string[] } {
  const row0 = parseCSVLine(lines[0], delimiter);

  // Check if row 0 contains platform group labels (IG FEED POSTS, IG STORY, TIKTOK, etc.)
  // If so, it's always a group label row — even if it also has "First"/"Last" in the identity columns
  const hasPlatformGroups = row0.some((h) => {
    const clean = h.toLowerCase().replace(/[^a-z ]/g, "").trim();
    return /\b(ig feed|ig story|ig reel|tiktok|tt post)\b/.test(clean);
  });

  const hasIdentityHeadersInRow0 = row0.some((h) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    return ["first", "firstname", "last", "lastname", "fname", "lname", "name", "fullname"].includes(clean);
  });

  if (hasPlatformGroups && !hasIdentityHeadersInRow0 && lines.length >= 2) {
    return {
      headers: parseCSVLine(lines[1], delimiter),
      dataStartIndex: 2,
      groupRow: row0,
    };
  }

  // Check if row 0 contains recognizable column headers
  const hasIdentityHeaders = row0.some((h) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    return ["first", "firstname", "last", "lastname", "fname", "lname", "name", "fullname", "athletename", "athlete"].includes(clean);
  });

  if (hasIdentityHeaders) {
    return { headers: row0, dataStartIndex: 1 };
  }

  // Row 0 has neither platform groups nor identity headers — try row 1
  if (lines.length >= 2) {
    return {
      headers: parseCSVLine(lines[1], delimiter),
      dataStartIndex: 2,
      groupRow: row0,
    };
  }

  return { headers: row0, dataStartIndex: 1 };
}

type PlatformTag = "identity" | "ig_feed" | "ig_story" | "ig_reel" | "tiktok" | "other";

/**
 * Build a column index → platform tag map by walking the row-0 group labels
 * left-to-right and forward-filling across blank cells. Each non-empty cell
 * starts a new platform group; everything to its right (until the next label)
 * inherits that tag. Identity columns (before the first group label) are tagged
 * "identity".
 *
 * If no group row is provided, every column is tagged "identity" — meaning
 * scoped lookups won't filter anything out and the parser falls back to the
 * pre-existing global findCol behavior.
 */
function buildPlatformMap(headerCount: number, groupRow?: string[]): PlatformTag[] {
  const map: PlatformTag[] = new Array(headerCount).fill("identity");
  if (!groupRow) return map;

  const PLATFORM_PATTERNS: { tag: PlatformTag; patterns: string[] }[] = [
    // ORDER MATTERS: more-specific patterns first
    { tag: "ig_story", patterns: ["ig story", "ig stories", "story post"] },
    { tag: "ig_reel", patterns: ["ig reel", "reel post", "ig reels"] },
    { tag: "ig_feed", patterns: ["ig feed", "feed post"] },
    { tag: "tiktok", patterns: ["tiktok", "tik tok", "tt post"] },
    { tag: "other", patterns: ["other engagement", "clicks", "links", "web", "conversion"] },
  ];

  let current: PlatformTag = "identity";
  for (let i = 0; i < headerCount; i++) {
    const cell = (groupRow[i] || "").trim().toLowerCase();
    if (cell) {
      const matched = PLATFORM_PATTERNS.find(({ patterns }) =>
        patterns.some((p) => cell.includes(p))
      );
      if (matched) current = matched.tag;
      // If the cell has text but no platform match, keep current.
    }
    map[i] = current;
  }
  return map;
}

/** Check if a row should be skipped (CALCULATIONS, totals, blank first name, header leak) */
function isJunkRow(first: string, last: string): boolean {
  if (!first) return true;
  const upper = first.toUpperCase();
  if (upper.includes("CALCULATIONS") || upper.includes("DO NOT")) return true;
  // catch header row leaking as data
  if (first.toLowerCase() === "first" && last.toLowerCase() === "last") return true;
  return false;
}

function parseCSVLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Split CSV text into logical rows, respecting quoted cells that may contain
 * embedded newlines. The naive split(/\r?\n/) is wrong for any CSV exported
 * from Excel/Google Sheets when a cell contains a line break — those line
 * breaks live INSIDE quoted cells and a row split must skip over them.
 *
 * Returns logical rows as strings (each still needs to be passed through
 * parseCSVLine to be split into columns). Empty rows are filtered out.
 */
function splitCSVRows(csvText: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      // Track quote state. Doubled quotes "" inside a quoted cell stay quoted.
      if (inQuotes && csvText[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      // Row terminator outside any quoted cell. Handle \r\n as one terminator.
      if (ch === "\r" && csvText[i + 1] === "\n") i++;
      if (current.trim().length > 0) rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) rows.push(current);
  return rows;
}

// Find the column index by matching against possible header names (case-insensitive)
function findCol(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!lower) continue;
    const idx = headers.findIndex((h) => {
      const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!hClean) return false; // Skip empty headers
      // Exact match or header contains the full search term
      // NOTE: We intentionally do NOT check lower.includes(hClean) because
      // generic headers like "Views" would falsely match "tiktokviews",
      // "igfeedreach" would match "reach", etc., causing cross-platform data duplication.
      return hClean === lower || hClean.includes(lower);
    });
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Find a column index, but ONLY among columns whose platform tag matches.
 * Used for trackers like the EVO Performance Tracker where IG Feed / IG Reel /
 * TikTok all use bare column names ("Likes", "Comments", "Total Engagements")
 * and rely on row-0 group labels ("IG FEED POSTS", "TIK TOK POSTS") to
 * disambiguate which platform each column belongs to.
 *
 * If platformMap is all "identity" (no group row was present), this falls back
 * to a normal global findCol so behavior is unchanged for trackers without
 * group rows.
 */
function findColInPlatform(
  headers: string[],
  platformMap: PlatformTag[],
  platform: PlatformTag,
  ...names: string[]
): number {
  const hasGroupRow = platformMap.some((p) => p !== "identity");
  if (!hasGroupRow) return findCol(headers, ...names);

  for (const name of names) {
    const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!lower) continue;
    for (let i = 0; i < headers.length; i++) {
      if (platformMap[i] !== platform) continue;
      const hClean = headers[i].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!hClean) continue;
      if (hClean === lower || hClean.includes(lower)) return i;
    }
  }
  return -1;
}

/**
 * Parse an Info/Roster CSV — athlete identity data
 * Expected columns: First, Last, IG Handle, School, Sport, Gender, Notes (flexible matching)
 */
export function parseInfoCSV(csvText: string): ParsedAthlete[] {
  const lines = splitCSVRows(csvText);
  if (lines.length < 2) return [];

  // Detect delimiter from the first line
  const _delimiter = lines[0].includes("\t") && lines[0].split("\t").length > lines[0].split(",").length ? "\t" : ",";

  const { headers, dataStartIndex } = detectHeaderRow(lines, _delimiter);

  const iFirst = findCol(headers, "first", "firstname", "first name", "fname");
  const iLast = findCol(headers, "last", "lastname", "last name", "lname");
  const iFullName = findCol(headers, "full name", "fullname", "athlete name", "athletename");
  // "name" column — only match if no first/last columns exist to avoid false matches
  const iName = (iFirst === -1 && iLast === -1) ? findCol(headers, "name", "athlete") : -1;
  const iHandle = findCol(headers, "ig handle", "handle", "instagram handle", "ig_handle", "instagram username", "instagramusername", "ig link", "ig url", "instagram link", "instagram url");
  const iFollowers = findCol(headers, "ig followers", "followers", "ig_followers", "instagram followers");
  const iContentRating = findCol(headers, "content rating", "content_rating", "contentrating", "rating");
  const iReachLevel = findCol(headers, "reach level", "reach_level", "reachlevel");
  const iSchool = findCol(headers, "school", "university", "college");
  const iSport = findCol(headers, "sport", "sports");
  const iGender = findCol(headers, "gender", "sex");
  const iNotes = findCol(headers, "notes", "note", "bio", "insight", "description");

  // Determine if we have a single "Name" column or separate First/Last
  const hasSingleNameCol = iFullName !== -1 || iName !== -1;
  const singleNameIdx = iFullName !== -1 ? iFullName : iName;
  const cFirst = iFirst !== -1 ? iFirst : 0;
  const cLast = iLast !== -1 ? iLast : 1;

  const UPPER_WORDS = new Set(["II", "III", "IV", "V", "JR", "SR", "JR.", "SR."]);
  const titleCase = (s: string) =>
    s.split(/\s+/).map((w) =>
      UPPER_WORDS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(" ");

  const athletes: ParsedAthlete[] = [];

  for (const line of lines.slice(dataStartIndex)) {
    const cols = parseCSVLine(line, _delimiter);

    let first: string, last: string, fullName: string;

    if (hasSingleNameCol) {
      // Single "Name" column — split into first/last
      const raw = cols[singleNameIdx]?.trim() || "";
      if (!raw) continue;
      const parts = raw.split(/\s+/);
      first = parts[0] || "";
      last = parts.slice(1).join(" ") || "";
      fullName = raw;
    } else {
      first = cols[cFirst]?.trim() || "";
      if (first.toLowerCase().trim() === "first") continue;
      last = cols[cLast]?.trim() || "";
      if (isJunkRow(first, last) || !last) continue;
      fullName = `${first} ${last}`;
    }

    if (!first) continue;

    const rawHandle = iHandle !== -1 ? (cols[iHandle]?.trim() || "") : "";

    athletes.push({
      first: titleCase(first),
      last: titleCase(last),
      name: titleCase(fullName),
      ig_handle: rawHandle.replace(/^\s+|\s+$/g, ""),
      ig_followers: iFollowers !== -1 ? (parseNum(cols[iFollowers]) || 0) : 0,
      content_rating: iContentRating !== -1 ? (cols[iContentRating]?.trim() || "") : "",
      reach_level: iReachLevel !== -1 ? (cols[iReachLevel]?.trim() || "") : "",
      school: iSchool !== -1 ? (cols[iSchool]?.trim() || "") : "",
      sport: iSport !== -1 ? (cols[iSport]?.trim() || "") : "",
      gender: iGender !== -1 ? (cols[iGender]?.trim() || "") : "",
      notes: iNotes !== -1 ? (cols[iNotes]?.trim() || "") : "",
      metrics: {},
    });
  }

  return athletes;
}

/**
 * Parse a Metrics/Performance CSV — engagement and post data
 * Expected columns: First, Last, IG Followers, IG Feed Post, Engagement Rate, etc.
 *
 * Supports two header layouts:
 *   1. Single header row with prefixed names ("IG Feed Likes", "Tiktok Views", etc.)
 *   2. Two-row layout with platform group labels in row 0 ("IG FEED POSTS", "TIK TOK POSTS")
 *      and bare column names in row 1 ("Likes", "Comments", "Total Engagements"). In this
 *      case the row-0 labels are used to build a column→platform map and every platform-
 *      scoped column lookup is constrained to its group's column range. This prevents
 *      cross-platform data leakage where, e.g., the IG Feed "Total Engagements" column
 *      was being read into metrics.tiktok.total_engagements.
 */
export function parseMetricsCSV(csvText: string): ParsedAthlete[] {
  const lines = splitCSVRows(csvText);
  if (lines.length < 2) return [];

  // Detect delimiter from the first line
  const _delimiter = lines[0].includes("\t") && lines[0].split("\t").length > lines[0].split(",").length ? "\t" : ",";

  const { headers, dataStartIndex, groupRow } = detectHeaderRow(lines, _delimiter);
  const platformMap = buildPlatformMap(headers.length, groupRow);

  // Core identity columns (always global)
  const iFirst = findCol(headers, "first", "firstname", "first name", "fname");
  const iLast = findCol(headers, "last", "lastname", "last name", "lname");
  const iFullName = findCol(headers, "full name", "fullname", "athlete name", "athletename");
  // "name" column — only match if no first/last columns exist to avoid false matches
  const iName = (iFirst === -1 && iLast === -1) ? findCol(headers, "name", "athlete") : -1;
  const iHandle = findCol(headers, "ig handle", "handle", "instagram handle", "ig_handle", "instagram username", "instagramusername", "ig link", "ig url", "instagram link", "instagram url");
  const iFollowers = findCol(headers, "ig followers", "followers", "ig_followers", "instagram followers");
  const iContentRating = findCol(headers, "content rating", "content_rating", "contentrating", "rating");
  const iReachLevel = findCol(headers, "reach level", "reach_level", "reachlevel");
  const iSchool = findCol(headers, "school", "university", "college");
  const iSport = findCol(headers, "sport", "sports");
  const iGender = findCol(headers, "gender", "sex");
  const iNotes = findCol(headers, "notes", "note", "bio", "insight", "description");

  // ── IG Feed columns ──
  // Try platform-scoped first (handles bare-name layouts), then fall back to prefixed search.
  const iIgFeedUrl = findColInPlatform(headers, platformMap, "ig_feed", "post url", "url")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "post url", "url")
    : findCol(headers, "ig feed post url", "ig feed url", "ig feed post", "feed url", "feed post url", "feed post");
  const iIgFeedReach = findColInPlatform(headers, platformMap, "ig_feed", "reach")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "reach")
    : findCol(headers, "ig feed reach", "feed reach");
  const iIgFeedImpressions = findColInPlatform(headers, platformMap, "ig_feed", "impressions")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "impressions")
    : findCol(headers, "ig feed impressions", "ig feed 1 impressions", "feed impressions");
  const iIgFeedLikes = findColInPlatform(headers, platformMap, "ig_feed", "likes")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "likes")
    : findCol(headers, "ig feed likes", "ig feed 1 likes", "feed likes");
  const iIgFeedComments = findColInPlatform(headers, platformMap, "ig_feed", "comments")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "comments")
    : findCol(headers, "ig feed comments", "ig feed 1 comments", "feed comments");
  const iIgFeedShares = findColInPlatform(headers, platformMap, "ig_feed", "shares")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "shares")
    : findCol(headers, "ig feed shares", "feed shares");
  const iIgFeedReposts = findColInPlatform(headers, platformMap, "ig_feed", "reposts")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "reposts")
    : findCol(headers, "ig feed reposts", "feed reposts");
  const iIgFeedEngagements = findColInPlatform(headers, platformMap, "ig_feed", "total engagements", "engagements")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "total engagements", "engagements")
    : findCol(headers, "ig feed total engagements", "feed total engagements", "ig feed engagements", "feed engagements", "total ig feed engagements");
  // Two separate engagement rates (2026 Performance Tracker template).
  // Followers-based and Impressions-based are now distinct columns.
  const iIgFeedEngRateFollowers = findColInPlatform(headers, platformMap, "ig_feed", "engagement rate followers", "eng rate followers")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "engagement rate followers", "eng rate followers")
    : findCol(headers, "ig feed engagement rate followers", "ig feed engagement rate (followers)", "feed engagement rate followers");
  const iIgFeedEngRateImpressions = findColInPlatform(headers, platformMap, "ig_feed", "engagement rate impressions", "eng rate impressions")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "engagement rate impressions", "eng rate impressions")
    : findCol(headers, "ig feed engagement rate impressions", "ig feed engagement rate (impressions)", "feed engagement rate impressions");
  // LEGACY: single engagement rate column (older spreadsheet format).
  // Only used when neither of the new dual-rate columns are present.
  const iIgFeedEngRate = (iIgFeedEngRateFollowers === -1 && iIgFeedEngRateImpressions === -1)
    ? (findColInPlatform(headers, platformMap, "ig_feed", "engagement rate", "eng rate")
        !== -1 ? findColInPlatform(headers, platformMap, "ig_feed", "engagement rate", "eng rate")
        : findCol(headers, "ig feed engagement rate", "feed engagement rate", "ig feed eng rate", "feed eng rate"))
    : -1;

  // ── IG Story columns ──
  // CRITICAL: search for the explicit TOTAL column first (most-specific patterns win).
  // The 2026 template provides a "Total IG Story Impressions" column that is the
  // multiplied-out total. If absent, we fall back to the per-story column and let
  // the formula multiply it by count downstream.
  const iIgStoryCount = findColInPlatform(headers, platformMap, "ig_story", "count", "post")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_story", "count", "post")
    : findCol(headers, "ig story count", "story count", "ig stories count", "stories count", "ig story post", "ig story");
  const iIgStoryTotalImpressions = findColInPlatform(headers, platformMap, "ig_story", "total impressions", "total ig story impressions")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_story", "total impressions", "total ig story impressions")
    : findCol(headers, "total ig story impressions", "ig story total impressions", "total story impressions", "story total impressions");
  const iIgStoryImpressions = findColInPlatform(headers, platformMap, "ig_story", "impressions")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_story", "impressions")
    : findCol(headers, "ig story impressions", "story impressions", "ig stories impressions", "stories impressions");

  // ── IG Reel columns ──
  const iIgReelUrl = findColInPlatform(headers, platformMap, "ig_reel", "post url", "url")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "post url", "url")
    : findCol(headers, "ig reel post url", "ig reel url", "reel url", "reel post url", "ig reels url", "ig reel post", "reel post");
  const iIgReelViews = findColInPlatform(headers, platformMap, "ig_reel", "views")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "views")
    : findCol(headers, "ig reel views", "reel views", "ig reels views", "reels views");
  const iIgReelLikes = findColInPlatform(headers, platformMap, "ig_reel", "likes")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "likes")
    : findCol(headers, "ig reel likes", "reel likes", "ig reels likes", "reels likes");
  const iIgReelComments = findColInPlatform(headers, platformMap, "ig_reel", "comments")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "comments")
    : findCol(headers, "ig reel comments", "reel comments", "ig reels comments", "reels comments");
  const iIgReelShares = findColInPlatform(headers, platformMap, "ig_reel", "shares")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "shares")
    : findCol(headers, "ig reel shares", "reel shares");
  const iIgReelReposts = findColInPlatform(headers, platformMap, "ig_reel", "reposts")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "reposts")
    : findCol(headers, "ig reel reposts", "reel reposts");
  const iIgReelEngagements = findColInPlatform(headers, platformMap, "ig_reel", "total engagements", "engagements")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "total engagements", "engagements")
    : findCol(headers, "ig reel total engagements", "reel total engagements", "ig reel engagements", "reel engagements", "ig reels engagements", "total ig reel engagements");
  const iIgReelEngRateFollowers = findColInPlatform(headers, platformMap, "ig_reel", "engagement rate followers", "eng rate followers")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "engagement rate followers", "eng rate followers")
    : findCol(headers, "ig reel engagement rate followers", "ig reel engagement rate (followers)", "reel engagement rate followers");
  const iIgReelEngRateImpressions = findColInPlatform(headers, platformMap, "ig_reel", "engagement rate impressions", "eng rate impressions")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "engagement rate impressions", "eng rate impressions")
    : findCol(headers, "ig reel engagement rate impressions", "ig reel engagement rate (impressions)", "reel engagement rate impressions");
  const iIgReelEngRate = (iIgReelEngRateFollowers === -1 && iIgReelEngRateImpressions === -1)
    ? (findColInPlatform(headers, platformMap, "ig_reel", "engagement rate", "eng rate")
        !== -1 ? findColInPlatform(headers, platformMap, "ig_reel", "engagement rate", "eng rate")
        : findCol(headers, "ig reel engagement rate", "reel engagement rate", "ig reel eng rate", "reel eng rate", "ig reels engagement rate"))
    : -1;

  // ── TikTok columns ──
  const iTiktokUrl = findColInPlatform(headers, platformMap, "tiktok", "post url", "url")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "post url", "url")
    : findCol(headers, "tiktok post url", "tiktok url", "tiktok post", "tt post url", "tt url");
  const iTiktokViews = findColInPlatform(headers, platformMap, "tiktok", "views")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "views")
    : findCol(headers, "tiktok views", "tt views", "tiktok video views");
  const iTiktokLikes = findColInPlatform(headers, platformMap, "tiktok", "likes")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "likes")
    : findCol(headers, "tiktok likes", "tt likes");
  const iTiktokComments = findColInPlatform(headers, platformMap, "tiktok", "comments")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "comments")
    : findCol(headers, "tiktok comments", "tt comments");
  const iTiktokLikesComments = findColInPlatform(headers, platformMap, "tiktok", "likes comments", "likes + comments")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "likes comments", "likes + comments")
    : findCol(headers, "tiktok likes comments", "tiktok likes + comments", "tt likes comments", "tiktok likes/comments");
  const iTiktokSavesShares = findColInPlatform(headers, platformMap, "tiktok", "saves shares", "saves + shares")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "saves shares", "saves + shares")
    : findCol(headers, "tiktok saves shares", "tiktok saves + shares", "tt saves shares", "tiktok saves/shares");
  const iTiktokEngagements = findColInPlatform(headers, platformMap, "tiktok", "total engagements", "engagements")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "total engagements", "engagements")
    : findCol(headers, "tiktok total engagements", "tiktok engagements", "tt total engagements", "tt engagements");
  // NEW: TikTok Followers (column AF in 2026 template — was previously not read at all,
  // which silently broke any downstream calculation that needed TikTok follower count).
  const iTiktokFollowers = findColInPlatform(headers, platformMap, "tiktok", "followers")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "followers")
    : findCol(headers, "tiktok followers", "tt followers");
  // NEW: TikTok Saves (standalone column in 2026 template — older sheets had a combined
  // "saves + shares" column captured as iTiktokSavesShares above).
  const iTiktokSaves = findColInPlatform(headers, platformMap, "tiktok", "saves")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "saves")
    : findCol(headers, "tiktok saves", "tt saves");
  const iTiktokEngRateFollowers = findColInPlatform(headers, platformMap, "tiktok", "engagement rate followers", "eng rate followers")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "engagement rate followers", "eng rate followers")
    : findCol(headers, "tiktok engagement rate followers", "tiktok engagement rate (followers)", "tt engagement rate followers");
  const iTiktokEngRateImpressions = findColInPlatform(headers, platformMap, "tiktok", "engagement rate impressions", "eng rate impressions")
    !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "engagement rate impressions", "eng rate impressions")
    : findCol(headers, "tiktok engagement rate impressions", "tiktok engagement rate (impressions)", "tt engagement rate impressions");
  const iTiktokEngRate = (iTiktokEngRateFollowers === -1 && iTiktokEngRateImpressions === -1)
    ? (findColInPlatform(headers, platformMap, "tiktok", "engagement rate", "eng rate")
        !== -1 ? findColInPlatform(headers, platformMap, "tiktok", "engagement rate", "eng rate")
        : findCol(headers, "tiktok engagement rate", "tiktok eng rate", "tt engagement rate", "tt eng rate"))
    : -1;

  // ── Other / Clicks / Sales / Targets columns ──
  // These are global because they're typically not duplicated across platforms,
  // but we still scope to "other" first when a group row exists.
  const iLinkClicks = findColInPlatform(headers, platformMap, "other", "link clicks", "clicks", "link click", "total clicks")
    !== -1 ? findColInPlatform(headers, platformMap, "other", "link clicks", "clicks", "link click", "total clicks")
    : findCol(headers, "link clicks", "clicks", "link click", "total clicks");
  const iClickThroughRate = findCol(headers, "click through rate", "ctr", "click rate", "clickthrough rate");
  const iLandingPageViews = findCol(headers, "landing page views", "lpv", "landing views", "page views");
  const iCostPerClick = findCol(headers, "cost per click", "cpc", "avg cpc", "average cpc");
  const iOrders = findColInPlatform(headers, platformMap, "other", "orders", "order", "total orders")
    !== -1 ? findColInPlatform(headers, platformMap, "other", "orders", "order", "total orders")
    : findCol(headers, "orders", "order", "total orders");
  const iSalesAmount = findColInPlatform(headers, platformMap, "other", "sales", "total sales", "sales amount")
    !== -1 ? findColInPlatform(headers, platformMap, "other", "sales", "total sales", "sales amount")
    : findCol(headers, "sales", "total sales", "sales amount");
  const iCpm = findCol(headers, "cpm", "cost per mille", "cost per thousand");

  // Sales columns
  const iConversions = findCol(headers, "conversions", "conversion", "total conversions", "purchases");
  const iRevenue = findCol(headers, "revenue", "total revenue", "sales revenue", "gmv", "gross revenue");
  const iConversionRate = findCol(headers, "conversion rate", "conv rate", "cvr");
  const iCostPerAcquisition = findCol(headers, "cost per acquisition", "cpa", "cost per conversion", "cost per purchase");
  const iRoas = findCol(headers, "roas", "return on ad spend", "return on spend");

  // Targets columns
  const iAthleteTarget = findCol(headers, "athlete target", "athlete_target", "athletetarget");
  const iContentUnitTarget = findCol(headers, "content unit target", "content_unit_target", "contentunittarget");
  const iPostTarget = findCol(headers, "post target", "post_target", "posttarget");
  const iCostPerPost = findCol(headers, "cost per post", "cost_per_post", "costperpost");
  const iCostPerAthlete = findCol(headers, "cost per athlete", "cost_per_athlete", "costperathlete");

  // Resolved final indices (no positional fallback needed — platform scoping handles
  // duplicate column names like multiple "Total Engagements" columns).
  const feedTotalEngIdx = iIgFeedEngagements;
  const reelTotalEngIdx = iIgReelEngagements;
  const feedEngRateIdx = iIgFeedEngRate;
  const reelEngRateIdx = iIgReelEngRate;
  const feedImpressionsIdx = iIgFeedImpressions;
  const storyImpressionsIdx = iIgStoryImpressions;

  // Determine if we have a single "Name" column or separate First/Last
  const hasSingleNameCol = iFullName !== -1 || iName !== -1;
  const singleNameIdx = iFullName !== -1 ? iFullName : iName;
  const cFirst = iFirst !== -1 ? iFirst : 0;
  const cLast = iLast !== -1 ? iLast : 1;

  const UPPER_WORDS = new Set(["II", "III", "IV", "V", "JR", "SR", "JR.", "SR."]);
  const titleCase = (s: string) =>
    s.split(/\s+/).map((w) =>
      UPPER_WORDS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(" ");

  const dataRows = lines.slice(dataStartIndex);
  const athletes: ParsedAthlete[] = [];

  for (const line of dataRows) {
    const cols = parseCSVLine(line, _delimiter);

    let first: string, last: string, fullName: string;

    if (hasSingleNameCol) {
      // Single "Name" column — split into first/last
      const raw = cols[singleNameIdx]?.trim() || "";
      if (!raw) continue;
      const parts = raw.split(/\s+/);
      first = parts[0] || "";
      last = parts.slice(1).join(" ") || "";
      fullName = raw;
    } else {
      first = cols[cFirst]?.trim() || "";
      if (first.toLowerCase().trim() === "first") continue;
      last = cols[cLast]?.trim() || "";
      if (isJunkRow(first, last) || !last) continue;
      fullName = `${first} ${last}`;
    }

    if (!first) continue;

    const getVal = (idx: number) => idx !== -1 ? cols[idx] : undefined;

    const metrics: AthleteMetrics = {
      ig_feed: {
        post_url: getVal(iIgFeedUrl)?.trim() || undefined,
        reach: parseNum(getVal(iIgFeedReach)),
        impressions: parseNum(getVal(feedImpressionsIdx)),
        likes: parseNum(getVal(iIgFeedLikes)),
        comments: parseNum(getVal(iIgFeedComments)),
        shares: parseNum(getVal(iIgFeedShares)),
        reposts: parseNum(getVal(iIgFeedReposts)),
        total_engagements: parseNum(getVal(feedTotalEngIdx)),
        engagement_rate: parseRate(getVal(feedEngRateIdx)),
        engagement_rate_followers: parseRate(getVal(iIgFeedEngRateFollowers)),
        engagement_rate_impressions: parseRate(getVal(iIgFeedEngRateImpressions)),
      },
      ig_story: {
        count: parseNum(getVal(iIgStoryCount)),
        impressions: parseNum(getVal(storyImpressionsIdx)),
        total_impressions: parseNum(getVal(iIgStoryTotalImpressions)),
      },
      ig_reel: {
        post_url: getVal(iIgReelUrl)?.trim() || undefined,
        views: parseNum(getVal(iIgReelViews)),
        likes: parseNum(getVal(iIgReelLikes)),
        comments: parseNum(getVal(iIgReelComments)),
        shares: parseNum(getVal(iIgReelShares)),
        reposts: parseNum(getVal(iIgReelReposts)),
        total_engagements: parseNum(getVal(reelTotalEngIdx)),
        engagement_rate: parseRate(getVal(reelEngRateIdx)),
        engagement_rate_followers: parseRate(getVal(iIgReelEngRateFollowers)),
        engagement_rate_impressions: parseRate(getVal(iIgReelEngRateImpressions)),
      },
      tiktok: {
        post_url: getVal(iTiktokUrl)?.trim() || undefined,
        followers: parseNum(getVal(iTiktokFollowers)),
        views: parseNum(getVal(iTiktokViews)),
        likes: parseNum(getVal(iTiktokLikes)),
        comments: parseNum(getVal(iTiktokComments)),
        likes_comments: parseNum(getVal(iTiktokLikesComments)),
        saves: parseNum(getVal(iTiktokSaves)),
        saves_shares: parseNum(getVal(iTiktokSavesShares)),
        total_engagements: parseNum(getVal(iTiktokEngagements)),
        engagement_rate: parseRate(getVal(iTiktokEngRate)),
        engagement_rate_followers: parseRate(getVal(iTiktokEngRateFollowers)),
        engagement_rate_impressions: parseRate(getVal(iTiktokEngRateImpressions)),
      },
      ...((iLinkClicks !== -1 || iClickThroughRate !== -1 || iLandingPageViews !== -1 || iCostPerClick !== -1 || iOrders !== -1 || iSalesAmount !== -1 || iCpm !== -1) ? {
        clicks: {
          link_clicks: parseNum(getVal(iLinkClicks)),
          click_through_rate: parseRate(getVal(iClickThroughRate)),
          landing_page_views: parseNum(getVal(iLandingPageViews)),
          cost_per_click: parseNum(getVal(iCostPerClick)),
          orders: parseNum(getVal(iOrders)),
          sales: parseNum(getVal(iSalesAmount)),
          cpm: parseNum(getVal(iCpm)),
        },
      } : {}),
      ...((iConversions !== -1 || iRevenue !== -1 || iConversionRate !== -1 || iCostPerAcquisition !== -1 || iRoas !== -1) ? {
        sales: {
          conversions: parseNum(getVal(iConversions)),
          revenue: parseNum(getVal(iRevenue)),
          conversion_rate: parseRate(getVal(iConversionRate)),
          cost_per_acquisition: parseNum(getVal(iCostPerAcquisition)),
          roas: parseNum(getVal(iRoas)),
        },
      } : {}),
      ...((iAthleteTarget !== -1 || iContentUnitTarget !== -1 || iPostTarget !== -1 || iCostPerPost !== -1 || iCostPerAthlete !== -1) ? {
        targets: {
          athlete_target: parseNum(getVal(iAthleteTarget)),
          content_unit_target: parseNum(getVal(iContentUnitTarget)),
          post_target: parseNum(getVal(iPostTarget)),
          cost_per_post: parseNum(getVal(iCostPerPost)),
          cost_per_athlete: parseNum(getVal(iCostPerAthlete)),
        },
      } : {}),
    };

    athletes.push({
      first: titleCase(first),
      last: titleCase(last),
      name: titleCase(fullName),
      ig_handle: iHandle !== -1 ? (cols[iHandle]?.replace(/^\s+|\s+$/g, "") || "") : "",
      ig_followers: iFollowers !== -1 ? (parseNum(cols[iFollowers]) || 0) : 0,
      content_rating: iContentRating !== -1 ? (cols[iContentRating]?.trim() || "") : "",
      reach_level: iReachLevel !== -1 ? (cols[iReachLevel]?.trim() || "") : "",
      school: iSchool !== -1 ? (cols[iSchool]?.trim() || "") : "",
      sport: iSport !== -1 ? (cols[iSport]?.trim() || "") : "",
      gender: iGender !== -1 ? (cols[iGender]?.trim() || "") : "",
      notes: iNotes !== -1 ? (cols[iNotes]?.trim() || "") : "",
      metrics,
    });
  }

  return athletes;
}

// Normalize name for matching — strips extra spaces, lowercases, handles suffixes
function normalizeNameKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Merge info and metrics parsed athletes by name match.
 * Info provides identity (school, sport, handle, etc.), metrics provides performance data.
 * Either can be empty — the other will be used as-is.
 */
export function mergeAthleteData(info: ParsedAthlete[], metrics: ParsedAthlete[]): ParsedAthlete[] {
  if (!info.length) return metrics;
  if (!metrics.length) return info;

  const merged: ParsedAthlete[] = [];
  const metricsMap = new Map<string, ParsedAthlete>();

  for (const m of metrics) {
    metricsMap.set(normalizeNameKey(m.name), m);
  }

  const usedMetrics = new Set<string>();

  for (const inf of info) {
    const key = normalizeNameKey(inf.name);
    const met = metricsMap.get(key);

    if (met) {
      usedMetrics.add(key);
      merged.push({
        ...inf,
        // Prefer info CSV for identity, but fill gaps from metrics
        ig_handle: inf.ig_handle || met.ig_handle,
        ig_followers: inf.ig_followers || met.ig_followers,
        content_rating: inf.content_rating || met.content_rating,
        reach_level: inf.reach_level || met.reach_level,
        school: inf.school || met.school,
        sport: inf.sport || met.sport,
        gender: inf.gender || met.gender,
        notes: inf.notes || met.notes,
        // Always use metrics CSV for performance data
        metrics: met.metrics,
      });
    } else {
      merged.push(inf);
    }
  }

  // Add any metrics athletes not in info CSV
  for (const met of metrics) {
    if (!usedMetrics.has(normalizeNameKey(met.name))) {
      merged.push(met);
    }
  }

  return merged;
}

// Legacy function — kept for backward compatibility
export function parsePerformanceCSV(csvText: string): ParsedAthlete[] {
  return parseMetricsCSV(csvText);
}
