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

/**
 * Detect if the first row is a platform group header (e.g. "IG FEED POSTS", "IG STORIES")
 * rather than the actual column headers. If so, return row 1 as headers and data starting at row 2.
 * Otherwise, return row 0 as headers and data starting at row 1.
 */
function detectHeaderRow(lines: string[]): { headers: string[]; dataStartIndex: number } {
  const row0 = parseCSVLine(lines[0]);

  // Check if row 0 contains platform group labels (IG FEED POSTS, IG STORY, TIKTOK, etc.)
  // If so, it's always a group label row — even if it also has "First"/"Last" in the identity columns
  const hasPlatformGroups = row0.some((h) => {
    const clean = h.toLowerCase().replace(/[^a-z ]/g, "").trim();
    return /\b(ig feed|ig story|ig reel|tiktok|tt post)\b/.test(clean);
  });

  if (hasPlatformGroups && lines.length >= 2) {
    return { headers: parseCSVLine(lines[1]), dataStartIndex: 2 };
  }

  // Check if row 0 contains recognizable column headers
  const hasIdentityHeaders = row0.some((h) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    return ["first", "firstname", "last", "lastname", "fname", "lname"].includes(clean);
  });

  if (hasIdentityHeaders) {
    return { headers: row0, dataStartIndex: 1 };
  }

  // Row 0 has neither platform groups nor identity headers — try row 1
  if (lines.length >= 2) {
    return { headers: parseCSVLine(lines[1]), dataStartIndex: 2 };
  }

  return { headers: row0, dataStartIndex: 1 };
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
 * Parse an Info/Roster CSV — athlete identity data
 * Expected columns: First, Last, IG Handle, School, Sport, Gender, Notes (flexible matching)
 */
export function parseInfoCSV(csvText: string): ParsedAthlete[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const { headers, dataStartIndex } = detectHeaderRow(lines);

  const iFirst = findCol(headers, "first", "firstname", "first name", "fname");
  const iLast = findCol(headers, "last", "lastname", "last name", "lname");
  const iHandle = findCol(headers, "ig handle", "handle", "instagram handle", "ig_handle", "instagram username", "instagramusername");
  const iFollowers = findCol(headers, "ig followers", "followers", "ig_followers", "instagram followers");
  const iContentRating = findCol(headers, "content rating", "content_rating", "contentrating", "rating");
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

  for (const line of lines.slice(dataStartIndex)) {
    const cols = parseCSVLine(line);
    const first = cols[cFirst]?.trim() || "";
    if (first.toLowerCase().trim() === "first") continue;
    const last = cols[cLast]?.trim() || "";
    if (isJunkRow(first, last) || !last) continue;

    const rawHandle = iHandle !== -1 ? (cols[iHandle]?.trim() || "") : "";

    athletes.push({
      first: titleCase(first),
      last: titleCase(last),
      name: `${titleCase(first)} ${titleCase(last)}`,
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
 */
export function parseMetricsCSV(csvText: string): ParsedAthlete[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const { headers, dataStartIndex } = detectHeaderRow(lines);

  // Core identity columns
  const iFirst = findCol(headers, "first", "firstname", "first name", "fname");
  const iLast = findCol(headers, "last", "lastname", "last name", "lname");
  const iHandle = findCol(headers, "ig handle", "handle", "instagram handle", "ig_handle", "instagram username", "instagramusername");
  const iFollowers = findCol(headers, "ig followers", "followers", "ig_followers", "instagram followers");
  const iContentRating = findCol(headers, "content rating", "content_rating", "contentrating", "rating");
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
  const iIgFeedShares = findCol(headers, "ig feed shares", "feed shares");
  const iIgFeedReposts = findCol(headers, "ig feed reposts", "feed reposts");
  const iIgFeedEngagements = findCol(headers, "ig feed total engagements", "feed total engagements", "ig feed engagements", "feed engagements", "total ig feed engagements");
  const iIgFeedEngRate = findCol(headers, "ig feed engagement rate", "feed engagement rate", "ig feed eng rate", "feed eng rate");

  // IG Story columns
  const iIgStoryCount = findCol(headers, "ig story count", "story count", "ig stories count", "stories count", "ig story post", "ig story");
  const iIgStoryImpressions = findCol(headers, "ig story impressions", "story impressions", "ig stories impressions", "stories impressions", "total ig story impressions");

  // IG Reel columns
  const iIgReelUrl = findCol(headers, "ig reel post url", "ig reel url", "reel url", "reel post url", "ig reels url", "ig reel post", "reel post");
  const iIgReelViews = findCol(headers, "ig reel views", "reel views", "ig reels views", "reels views");
  const iIgReelLikes = findCol(headers, "ig reel likes", "reel likes", "ig reels likes", "reels likes");
  const iIgReelComments = findCol(headers, "ig reel comments", "reel comments", "ig reels comments", "reels comments");
  const iIgReelShares = findCol(headers, "ig reel shares", "reel shares");
  const iIgReelReposts = findCol(headers, "ig reel reposts", "reel reposts");
  const iIgReelEngagements = findCol(headers, "ig reel total engagements", "reel total engagements", "ig reel engagements", "reel engagements", "ig reels engagements", "total ig reel engagements");
  const iIgReelEngRate = findCol(headers, "ig reel engagement rate", "reel engagement rate", "ig reel eng rate", "reel eng rate", "ig reels engagement rate");

  // TikTok columns — support both combined and separate likes/comments
  const iTiktokUrl = findCol(headers, "tiktok post url", "tiktok url", "tiktok post", "tt post url", "tt url");
  const iTiktokViews = findCol(headers, "tiktok views", "tt views", "tiktok video views");
  const iTiktokLikes = findCol(headers, "tiktok likes", "tt likes");
  const iTiktokComments = findCol(headers, "tiktok comments", "tt comments");
  const iTiktokLikesComments = findCol(headers, "tiktok likes comments", "tiktok likes + comments", "tt likes comments", "tiktok likes/comments");
  const iTiktokSavesShares = findCol(headers, "tiktok saves shares", "tiktok saves + shares", "tt saves shares", "tiktok saves/shares");
  const iTiktokEngagements = findCol(headers, "tiktok total engagements", "tiktok engagements", "tt total engagements", "tt engagements", "total engagements");
  const iTiktokEngRate = findCol(headers, "tiktok engagement rate", "tiktok eng rate", "tt engagement rate", "tt eng rate", "engagement rate");

  // Clicks columns
  const iLinkClicks = findCol(headers, "link clicks", "clicks", "link click", "total clicks");
  const iClickThroughRate = findCol(headers, "click through rate", "ctr", "click rate", "clickthrough rate");
  const iLandingPageViews = findCol(headers, "landing page views", "lpv", "landing views", "page views");
  const iCostPerClick = findCol(headers, "cost per click", "cpc", "avg cpc", "average cpc");
  const iOrders = findCol(headers, "orders", "order", "total orders");
  const iSalesAmount = findCol(headers, "sales", "total sales", "sales amount");
  const iCpm = findCol(headers, "cpm", "cost per mille", "cost per thousand");

  console.log('CSV DEBUG:', JSON.stringify({ headerCount: headers.length, iLinkClicks, iOrders, iSalesAmount, headers: headers.slice(-10) }));

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

  // For columns that have duplicate names (e.g. two "Engagement Rate" columns),
  // find them positionally — first occurrence is feed, second is reel
  let feedEngRateIdx = iIgFeedEngRate;
  let reelEngRateIdx = iIgReelEngRate;
  let feedTotalEngIdx = iIgFeedEngagements;
  let reelTotalEngIdx = iIgReelEngagements;

  // Handle duplicate "Engagement Rate" columns by position
  // Also handles when both findCol calls matched the same column via fuzzy matching
  if (feedEngRateIdx === -1 || reelEngRateIdx === -1 || feedEngRateIdx === reelEngRateIdx) {
    const engRateIndices: number[] = [];
    headers.forEach((h, i) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean === "engagementrate") engRateIndices.push(i);
    });
    if (engRateIndices.length >= 1) feedEngRateIdx = engRateIndices[0];
    if (engRateIndices.length >= 2) reelEngRateIdx = engRateIndices[1];
  }

  // Handle duplicate "Engagements" / "Total Engagements" columns by position
  // Matches: "engagements", "totalengagement", "totalengagements"
  if (feedTotalEngIdx === -1 || reelTotalEngIdx === -1 || feedTotalEngIdx === reelTotalEngIdx) {
    const totalEngIndices: number[] = [];
    headers.forEach((h, i) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean === "engagements" || clean === "engagement" || clean === "totalengagement" || clean === "totalengagements") totalEngIndices.push(i);
    });
    if (totalEngIndices.length >= 1) feedTotalEngIdx = totalEngIndices[0];
    if (totalEngIndices.length >= 2) reelTotalEngIdx = totalEngIndices[1];
  }

  // Handle duplicate "Impressions" columns by position (first = feed, second = story)
  let feedImpressionsIdx = iIgFeedImpressions;
  let storyImpressionsIdx = iIgStoryImpressions;
  if (feedImpressionsIdx === -1 || storyImpressionsIdx === -1 || feedImpressionsIdx === storyImpressionsIdx) {
    const impIndices: number[] = [];
    headers.forEach((h, i) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean === "impressions") impIndices.push(i);
    });
    if (impIndices.length >= 1) feedImpressionsIdx = impIndices[0];
    if (impIndices.length >= 2) storyImpressionsIdx = impIndices[1];
  }

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
    const cols = parseCSVLine(line);

    const first = cols[cFirst]?.trim() || "";
    if (first.toLowerCase().trim() === "first") continue;
    const last = cols[cLast]?.trim() || "";

    // Skip junk rows (CALCULATIONS, totals, blank names)
    if (isJunkRow(first, last) || !last) continue;

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
      },
      ig_story: {
        count: parseNum(getVal(iIgStoryCount)),
        impressions: parseNum(getVal(storyImpressionsIdx)),
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
      },
      tiktok: {
        post_url: getVal(iTiktokUrl)?.trim() || undefined,
        views: parseNum(getVal(iTiktokViews)),
        likes: parseNum(getVal(iTiktokLikes)),
        comments: parseNum(getVal(iTiktokComments)),
        likes_comments: parseNum(getVal(iTiktokLikesComments)),
        saves_shares: parseNum(getVal(iTiktokSavesShares)),
        total_engagements: parseNum(getVal(iTiktokEngagements)),
        engagement_rate: parseRate(getVal(iTiktokEngRate)),
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
      name: `${titleCase(first)} ${titleCase(last)}`,
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
