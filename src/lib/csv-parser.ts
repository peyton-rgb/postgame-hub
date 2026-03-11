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
    const lower = name.toLowerCase();
    const idx = headers.findIndex((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "").includes(lower.replace(/[^a-z0-9]/g, "")));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parsePerformanceCSV(csvText: string): ParsedAthlete[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header row to find column indices by name
  const headers = parseCSVLine(lines[0]);

  // Core identity columns
  const iFirst = findCol(headers, "first", "firstname", "first name");
  const iLast = findCol(headers, "last", "lastname", "last name");
  const iHandle = findCol(headers, "ig handle", "handle", "instagram handle", "ig_handle");
  const iFollowers = findCol(headers, "ig followers", "followers", "ig_followers");
  const iReachLevel = findCol(headers, "reach level", "reach_level", "reachlevel");
  const iSchool = findCol(headers, "school", "university", "college");
  const iSport = findCol(headers, "sport", "sports");
  const iGender = findCol(headers, "gender", "sex");

  // IG Feed columns
  const iIgFeedUrl = findCol(headers, "ig feed post url", "ig feed url", "ig feed post", "feed url", "feed post url");
  const iIgFeedReach = findCol(headers, "ig feed reach", "feed reach");
  const iIgFeedImpressions = findCol(headers, "ig feed impressions", "feed impressions");
  const iIgFeedLikes = findCol(headers, "ig feed likes", "feed likes");
  const iIgFeedComments = findCol(headers, "ig feed comments", "feed comments");
  const iIgFeedEngagements = findCol(headers, "ig feed total engagements", "feed total engagements", "ig feed engagements", "feed engagements");
  const iIgFeedEngRate = findCol(headers, "ig feed engagement rate", "feed engagement rate", "ig feed eng rate", "feed eng rate");

  // IG Story columns
  const iIgStoryCount = findCol(headers, "ig story count", "story count", "ig stories count", "stories count", "ig story");
  const iIgStoryImpressions = findCol(headers, "ig story impressions", "story impressions", "ig stories impressions", "stories impressions");

  // IG Reel columns
  const iIgReelUrl = findCol(headers, "ig reel post url", "ig reel url", "reel url", "reel post url", "ig reels url");
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

  // Fallback: if header matching failed, use positional indices (original layout)
  const col = (found: number, fallback: number) => found !== -1 ? found : fallback;

  const cFirst = col(iFirst, 0);
  const cLast = col(iLast, 1);
  const cHandle = col(iHandle, 2);
  const cFollowers = col(iFollowers, 3);
  const cReachLevel = col(iReachLevel, 4);
  const cSchool = col(iSchool, 27);
  const cSport = col(iSport, 28);
  const cGender = col(iGender, 29);

  const cIgFeedUrl = col(iIgFeedUrl, 5);
  const cIgFeedReach = col(iIgFeedReach, 6);
  const cIgFeedImpressions = col(iIgFeedImpressions, 7);
  const cIgFeedLikes = col(iIgFeedLikes, 8);
  const cIgFeedComments = col(iIgFeedComments, 9);
  const cIgFeedEngagements = col(iIgFeedEngagements, 10);
  const cIgFeedEngRate = col(iIgFeedEngRate, 11);

  const cIgStoryCount = col(iIgStoryCount, 12);
  const cIgStoryImpressions = col(iIgStoryImpressions, 13);

  const cIgReelUrl = col(iIgReelUrl, 15);
  const cIgReelViews = col(iIgReelViews, 16);
  const cIgReelLikes = col(iIgReelLikes, 17);
  const cIgReelComments = col(iIgReelComments, 18);
  const cIgReelEngagements = col(iIgReelEngagements, 19);
  const cIgReelEngRate = col(iIgReelEngRate, 20);

  const cTiktokUrl = col(iTiktokUrl, 21);
  const cTiktokViews = col(iTiktokViews, 22);
  const cTiktokLikesComments = col(iTiktokLikesComments, 23);
  const cTiktokSavesShares = col(iTiktokSavesShares, 24);
  const cTiktokEngagements = col(iTiktokEngagements, 25);
  const cTiktokEngRate = col(iTiktokEngRate, 26);

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

    const school = cols[cSchool]?.trim() || "";
    const sport = cols[cSport]?.trim() || "";
    if (!school && !sport) continue;

    const igFeedUrl = cols[cIgFeedUrl]?.trim() || undefined;
    const igReelUrl = cols[cIgReelUrl]?.trim() || undefined;
    const tiktokUrl = cols[cTiktokUrl]?.trim() || undefined;

    const metrics: AthleteMetrics = {
      ig_feed: {
        post_url: igFeedUrl,
        reach: parseNum(cols[cIgFeedReach]),
        impressions: parseNum(cols[cIgFeedImpressions]),
        likes: parseNum(cols[cIgFeedLikes]),
        comments: parseNum(cols[cIgFeedComments]),
        total_engagements: parseNum(cols[cIgFeedEngagements]),
        engagement_rate: parseRate(cols[cIgFeedEngRate]),
      },
      ig_story: {
        count: parseNum(cols[cIgStoryCount]),
        impressions: parseNum(cols[cIgStoryImpressions]),
      },
      ig_reel: {
        post_url: igReelUrl,
        views: parseNum(cols[cIgReelViews]),
        likes: parseNum(cols[cIgReelLikes]),
        comments: parseNum(cols[cIgReelComments]),
        total_engagements: parseNum(cols[cIgReelEngagements]),
        engagement_rate: parseRate(cols[cIgReelEngRate]),
      },
      tiktok: {
        post_url: tiktokUrl,
        views: parseNum(cols[cTiktokViews]),
        likes_comments: parseNum(cols[cTiktokLikesComments]),
        saves_shares: parseNum(cols[cTiktokSavesShares]),
        total_engagements: parseNum(cols[cTiktokEngagements]),
        engagement_rate: parseRate(cols[cTiktokEngRate]),
      },
    };

    const titleCase = (s: string) =>
      s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    athletes.push({
      first: titleCase(first),
      last: titleCase(last),
      name: `${titleCase(first)} ${titleCase(last)}`,
      ig_handle: cols[cHandle]?.trim() || "",
      ig_followers: parseNum(cols[cFollowers]) || 0,
      reach_level: cols[cReachLevel]?.trim() || "",
      school,
      sport,
      gender: cols[cGender]?.trim() || "",
      metrics,
    });
  }

  return athletes;
}
