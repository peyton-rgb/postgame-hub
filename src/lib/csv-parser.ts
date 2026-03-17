import type { AthleteMetrics } from "./types";

export interface ParsedAthlete {
  first: string;
  last: string;
  name: string;
  ig_handle: string;
  ig_followers: number;
  reach_level: string;
  school: string;
  sport: string;
  gender: string;
  notes: string;
  metrics: AthleteMetrics;
}

function parseNum(val: string | undefined): number | undefined {
  if (!val || val.trim() === "") return undefined;
  const cleaned = val.replace(/,/g, "").replace(/%/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function parseRate(val: string | undefined): number | undefined {
  if (!val || val.trim() === "") return undefined;
  const cleaned = val.replace(/,/g, "").replace(/%/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function parseCSVLine(line: string): string[] {
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
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Find the column index by matching against possible header names (case-insensitive)
function findCol(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!lower) continue;
    const idx = headers.findIndex((h) => {
      const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!hClean) return false; // Skip empty headers
      return hClean === lower || hClean.includes(lower) || lower.includes(hClean);
    });
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parse an Info/Roster CSV — athlete identity data
 * Expected columns: First, Last, IG Handle, School, Sport, Gender, Notes (flexible matching)
 */
export function parseInfoCSV(csvText: string): ParsedAthlete[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  const iFirst = findCol(headers, "first", "firstname", "first name", "fname");
  const iLast = findCol(headers, "last", "lastname", "last name", "lname");
  const iHandle = findCol(headers, "ig handle", "handle", "instagram handle", "ig_handle", "instagram username", "instagramusername");
  const iFollowers = findCol(headers, "ig followers", "followers", "ig_followers", "instagram followers");
  const iReachLevel = findCol(headers, "reach level", "reach_level", "reachlevel");
  const iSchool = findCol(headers, "school", "university", "college");
  const iSport = findCol(headers, "sport", "sports");
  const iGender = findCol(headers, "gender", "sex");
  const iNotes = findCol(headers, "notes", "note", "bio", "insight", "description");

  const cFirst = iFirst !== -1 ? iFirst : 0;
  const cLast = iLast !== -1 ? iLast : 1;

  const UPPER_WORDS = new Set(["II", "III", "IV", "V", "JR", "SR", "JR.", "SR."]);
  const titleCase = (s: string) =>
    s.split(/\s+/).map((w) =>
      UPPER_WORDS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(" ");

  const athletes: ParsedAthlete[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line);
    const first = cols[cFirst]?.trim() || "";
    const last = cols[cLast]?.trim() || "";
    if (!first || !last) continue;
    if (first.toUpperCase().includes("CALCULATIONS")) continue;
    if (first.toUpperCase().includes("DO NOT")) continue;

    athletes.push({
      first: titleCase(first),
      last: titleCase(last),
      name: `${titleCase(first)} ${titleCase(last)}`,
      ig_handle: iHandle !== -1 ? (cols[iHandle]?.trim() || "") : "",
      ig_followers: iFollowers !== -1 ? (parseNum(cols[iFollowers]) || 0) : 0,
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
 */
export function parseMetricsCSV(csvText: string): ParsedAthlete[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  // Core identity columns
  const iFirst = findCol(headers, "first", "firstname", "first name", "fname");
  const iLast = findCol(headers, "last", "lastname", "last name", "lname");
  const iHandle = findCol(headers, "ig handle", "handle", "instagram handle", "ig_handle", "instagram username", "instagramusername");
  const iFollowers = findCol(headers, "ig followers", "followers", "ig_followers", "instagram followers");
  const iReachLevel = findCol(headers, "reach level", "reach_level", "reachlevel");
  const iSchool = findCol(headers, "school", "university", "college");
  const iSport = findCol(headers, "sport", "sports");
  const iGender = findCol(headers, "gender", "sex");
  const iNotes = findCol(headers, "notes", "note", "bio", "insight", "description");

  // IG Feed columns — flexible matching for variations like "IG Feed 1 Impressions"
  const iIgFeedUrl = findCol(headers, "ig feed post url", "ig feed url", "ig feed post", "feed url", "feed post url", "feed post");
  const iIgFeedReach = findCol(headers, "ig feed reach", "feed reach");
  const iIgFeedImpressions = findCol(headers, "ig feed impressions", "ig feed 1 impressions", "feed impressions");
  const iIgFeedLikes = findCol(headers, "ig feed likes", "ig feed 1 likes", "feed likes");
  const iIgFeedComments = findCol(headers, "ig feed comments", "ig feed 1 comments", "feed comments");
  // Match "Total Engagement" (feed) — but be careful not to match the reel one
  // We find the first "total engagement" that appears after the feed columns
  const iIgFeedEngagements = findCol(headers, "ig feed total engagements", "feed total engagements", "ig feed engagements", "feed engagements");
  // Match first "Engagement Rate" column (feed)
  const iIgFeedEngRate = findCol(headers, "ig feed engagement rate", "feed engagement rate", "ig feed eng rate", "feed eng rate");

  // IG Story columns
  const iIgStoryCount = findCol(headers, "ig story count", "story count", "ig stories count", "stories count", "ig story post", "ig story");
  const iIgStoryImpressions = findCol(headers, "ig story impressions", "story impressions", "ig stories impressions", "stories impressions");

  // IG Reel columns
  const iIgReelUrl = findCol(headers, "ig reel post url", "ig reel url", "reel url", "reel post url", "ig reels url", "ig reel post", "reel post");
  const iIgReelViews = findCol(headers, "ig reel views", "reel views", "ig reels views", "reels views");
  const iIgReelLikes = findCol(headers, "ig reel likes", "reel likes", "ig reels likes", "reels likes");
  const iIgReelComments = findCol(headers, "ig reel comments", "reel comments", "ig reels comments", "reels comments");
  const iIgReelEngagements = findCol(headers, "ig reel total engagements", "reel total engagements", "ig reel engagements", "reel engagements", "ig reels engagements");
  const iIgReelEngRate = findCol(headers, "ig reel engagement rate", "reel engagement rate", "ig reel eng rate", "reel eng rate", "ig reels engagement rate");

  // TikTok columns
  const iTiktokUrl = findCol(headers, "tiktok post url", "tiktok url", "tiktok post", "tt post url", "tt url");
  const iTiktokViews = findCol(headers, "tiktok views", "tt views", "tiktok video views");
  const iTiktokLikesComments = findCol(headers, "tiktok likes comments", "tiktok likes + comments", "tt likes comments", "tiktok likes/comments");
  const iTiktokSavesShares = findCol(headers, "tiktok saves shares", "tiktok saves + shares", "tt saves shares", "tiktok saves/shares");
  const iTiktokEngagements = findCol(headers, "tiktok total engagements", "tiktok engagements", "tt total engagements", "tt engagements");
  const iTiktokEngRate = findCol(headers, "tiktok engagement rate", "tiktok eng rate", "tt engagement rate", "tt eng rate");

  // Clicks columns
  const iLinkClicks = findCol(headers, "link clicks", "clicks", "link click", "total clicks");
  const iClickThroughRate = findCol(headers, "click through rate", "ctr", "click rate", "clickthrough rate");
  const iLandingPageViews = findCol(headers, "landing page views", "lpv", "landing views", "page views");
  const iCostPerClick = findCol(headers, "cost per click", "cpc", "avg cpc", "average cpc");

  // Sales columns
  const iConversions = findCol(headers, "conversions", "conversion", "total conversions", "purchases", "sales");
  const iRevenue = findCol(headers, "revenue", "total revenue", "sales revenue", "gmv", "gross revenue");
  const iConversionRate = findCol(headers, "conversion rate", "conv rate", "cvr");
  const iCostPerAcquisition = findCol(headers, "cost per acquisition", "cpa", "cost per conversion", "cost per purchase");
  const iRoas = findCol(headers, "roas", "return on ad spend", "return on spend");

  // For columns that have duplicate names (e.g. two "Engagement Rate" columns),
  // find them positionally — first occurrence is feed, second is reel
  let feedEngRateIdx = iIgFeedEngRate;
  let reelEngRateIdx = iIgReelEngRate;
  let feedTotalEngIdx = iIgFeedEngagements;
  let reelTotalEngIdx = iIgReelEngagements;

  // Handle duplicate "Engagement Rate" columns by position
  if (feedEngRateIdx === -1 || reelEngRateIdx === -1) {
    const engRateIndices: number[] = [];
    headers.forEach((h, i) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean === "engagementrate") engRateIndices.push(i);
    });
    if (engRateIndices.length >= 1 && feedEngRateIdx === -1) feedEngRateIdx = engRateIndices[0];
    if (engRateIndices.length >= 2 && reelEngRateIdx === -1) reelEngRateIdx = engRateIndices[1];
  }

  // Handle duplicate "Total Engagements" columns by position
  if (feedTotalEngIdx === -1 || reelTotalEngIdx === -1) {
    const totalEngIndices: number[] = [];
    headers.forEach((h, i) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean === "totalengagement" || clean === "totalengagements") totalEngIndices.push(i);
    });
    if (totalEngIndices.length >= 1 && feedTotalEngIdx === -1) feedTotalEngIdx = totalEngIndices[0];
    if (totalEngIndices.length >= 2 && reelTotalEngIdx === -1) reelTotalEngIdx = totalEngIndices[1];
  }

  const cFirst = iFirst !== -1 ? iFirst : 0;
  const cLast = iLast !== -1 ? iLast : 1;

  const UPPER_WORDS = new Set(["II", "III", "IV", "V", "JR", "SR", "JR.", "SR."]);
  const titleCase = (s: string) =>
    s.split(/\s+/).map((w) =>
      UPPER_WORDS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(" ");

  const dataRows = lines.slice(1);
  const athletes: ParsedAthlete[] = [];

  for (const line of dataRows) {
    const cols = parseCSVLine(line);

    const first = cols[cFirst]?.trim() || "";
    const last = cols[cLast]?.trim() || "";

    // Skip junk rows
    if (!first || !last) continue;
    if (first.toUpperCase().includes("CALCULATIONS")) continue;
    if (first.toUpperCase().includes("DO NOT")) continue;

    const getVal = (idx: number) => idx !== -1 ? cols[idx] : undefined;

    const metrics: AthleteMetrics = {
      ig_feed: {
        post_url: getVal(iIgFeedUrl)?.trim() || undefined,
        reach: parseNum(getVal(iIgFeedReach)),
        impressions: parseNum(getVal(iIgFeedImpressions)),
        likes: parseNum(getVal(iIgFeedLikes)),
        comments: parseNum(getVal(iIgFeedComments)),
        total_engagements: parseNum(getVal(feedTotalEngIdx)),
        engagement_rate: parseRate(getVal(feedEngRateIdx)),
      },
      ig_story: {
        count: parseNum(getVal(iIgStoryCount)),
        impressions: parseNum(getVal(iIgStoryImpressions)),
      },
      ig_reel: {
        post_url: getVal(iIgReelUrl)?.trim() || undefined,
        views: parseNum(getVal(iIgReelViews)),
        likes: parseNum(getVal(iIgReelLikes)),
        comments: parseNum(getVal(iIgReelComments)),
        total_engagements: parseNum(getVal(reelTotalEngIdx)),
        engagement_rate: parseRate(getVal(reelEngRateIdx)),
      },
      tiktok: {
        post_url: getVal(iTiktokUrl)?.trim() || undefined,
        views: parseNum(getVal(iTiktokViews)),
        likes_comments: parseNum(getVal(iTiktokLikesComments)),
        saves_shares: parseNum(getVal(iTiktokSavesShares)),
        total_engagements: parseNum(getVal(iTiktokEngagements)),
        engagement_rate: parseRate(getVal(iTiktokEngRate)),
      },
      clicks: {
        link_clicks: parseNum(getVal(iLinkClicks)),
        click_through_rate: parseRate(getVal(iClickThroughRate)),
        landing_page_views: parseNum(getVal(iLandingPageViews)),
        cost_per_click: parseNum(getVal(iCostPerClick)),
      },
      sales: {
        conversions: parseNum(getVal(iConversions)),
        revenue: parseNum(getVal(iRevenue)),
        conversion_rate: parseRate(getVal(iConversionRate)),
        cost_per_acquisition: parseNum(getVal(iCostPerAcquisition)),
        roas: parseNum(getVal(iRoas)),
      },
    };

    athletes.push({
      first: titleCase(first),
      last: titleCase(last),
      name: `${titleCase(first)} ${titleCase(last)}`,
      ig_handle: iHandle !== -1 ? (cols[iHandle]?.trim() || "") : "",
      ig_followers: iFollowers !== -1 ? (parseNum(cols[iFollowers]) || 0) : 0,
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
