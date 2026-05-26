import type { AthleteMetrics, CollabGroup, CollabSource as CollabPostSource } from "./types";

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
  /** IDs of the collab groups this athlete belongs to (set by collab detection). */
  collabGroupIds?: string[];
}

/** Minimal shape needed to detect collab groups — works on both
 *  ParsedAthlete (parse-time, no DB id) and Athlete (render-time, DB id). */
type CollabSource = {
  name: string;
  ig_followers?: number;
  metrics?: AthleteMetrics;
};

// djb2-style hash, plenty for generating stable short IDs from a URL.
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Detect collab posts — any post URL shared across 2+ athlete rows.
 * Returns the groups plus a map from "<id-of-athlete>" → array of collab
 * group IDs that athlete participates in, so callers can stamp athletes
 * with their collab membership.
 *
 * `getId` lets the caller decide which stable identifier to use. At parse
 * time the only thing available is the athlete name (ParsedAthlete has no
 * DB id). At render time the recap page passes the DB id.
 */
export function detectCollabGroups<T extends CollabSource>(
  athletes: T[],
  getId: (a: T, i: number) => string,
): { collabGroups: CollabGroup[]; idToGroupIds: Map<string, string[]> } {
  const platforms: { key: "ig_feed" | "ig_reel" | "tiktok" }[] = [
    { key: "ig_feed" }, { key: "ig_reel" }, { key: "tiktok" },
  ];

  // url+platform → list of { athlete, index }
  type Bucket = { athlete: T; index: number }[];
  const buckets = new Map<string, Bucket>();
  const keyFor = (platform: string, url: string) => `${platform}|${url}`;

  athletes.forEach((a, i) => {
    for (const { key } of platforms) {
      const url = a.metrics?.[key]?.post_url?.trim();
      if (!url) continue;
      const k = keyFor(key, url);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push({ athlete: a, index: i });
    }
    // Also scan Post 2 slots so multi-post collabs are detected: a URL shared
    // between two athletes' Post 2 (or between one athlete's Post 1 and another's
    // Post 2) is still a collab and should be deduplicated.
    const m2 = a.metrics;
    if (m2?.ig_feed_2?.post_url) {
      const url = m2.ig_feed_2.post_url.trim();
      if (url) { const k = keyFor("ig_feed", url); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push({ athlete: a, index: i }); }
    }
    if (m2?.ig_reel_2?.post_url) {
      const url = m2.ig_reel_2.post_url.trim();
      if (url) { const k = keyFor("ig_reel", url); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push({ athlete: a, index: i }); }
    }
    if (m2?.tiktok_2?.post_url) {
      const url = m2.tiktok_2.post_url.trim();
      if (url) { const k = keyFor("tiktok", url); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push({ athlete: a, index: i }); }
    }
  });

  // ── Pass 1: build one "post" per qualifying bucket (2+ athletes) ──
  type CollabMetrics = CollabGroup["metrics"];
  type Post = {
    platform: "ig_feed" | "ig_reel" | "tiktok";
    url: string;
    athleteIds: string[];
    athleteNames: string[];
    combinedFollowers: number;
    metrics: CollabMetrics;
    combinedEngagementRate: number;
  };

  const posts: Post[] = [];
  // Use forEach (not for-of) to avoid downlevelIteration on Map under the
  // project's current TS target.
  buckets.forEach((bucket: Bucket, k: string) => {
    if (bucket.length < 2) return;
    const [platform, url] = k.split("|") as ["ig_feed" | "ig_reel" | "tiktok", string];

    const athleteIds = bucket.map((b: { athlete: T; index: number }) => getId(b.athlete, b.index));
    const athleteNames = bucket.map((b: { athlete: T; index: number }) => b.athlete.name);
    const combinedFollowers = bucket.reduce<number>(
      (sum, b) => sum + (b.athlete.ig_followers || 0),
      0,
    );

    // Source platform-block from the first athlete that has any numeric metric
    // for this URL. Per the spec, the metrics are identical across all
    // participants — we just need one populated copy.
    const sourceBlock = (() => {
      // The _2 slot key that corresponds to this platform (for Post 2 collab metrics).
      const p2Key: "ig_feed_2" | "ig_reel_2" | "tiktok_2" =
        platform === "ig_feed" ? "ig_feed_2" : platform === "ig_reel" ? "ig_reel_2" : "tiktok_2";
      for (const b of bucket) {
        // Check Post 1 slot first; fall through to Post 2 slot if Post 1 is empty.
        const block = b.athlete.metrics?.[platform] ?? b.athlete.metrics?.[p2Key];
        if (!block) continue;
        const anyNumeric = ["views", "impressions", "likes", "comments", "shares", "reposts", "total_engagements"]
          .some((kk) => (block as Record<string, unknown>)[kk] != null);
        if (anyNumeric) return block;
      }
      return bucket[0].athlete.metrics?.[platform] ?? bucket[0].athlete.metrics?.[p2Key] ?? {};
    })();

    const block = sourceBlock as Record<string, number | undefined>;
    const totalEngagements = block.total_engagements;
    const combinedEngagementRate = combinedFollowers > 0 && totalEngagements != null
      ? (totalEngagements / combinedFollowers) * 100
      : 0;

    posts.push({
      platform,
      url,
      athleteIds,
      athleteNames,
      combinedFollowers,
      metrics: {
        views: block.views,
        impressions: block.impressions,
        likes: block.likes,
        comments: block.comments,
        shares: block.shares,
        reposts: block.reposts,
        totalEngagements: block.total_engagements,
        engagementRateFol: block.engagement_rate_followers,
        engagementRateImp: block.engagement_rate_impressions,
      },
      combinedEngagementRate,
    });
  });

  // ── Pass 2: group posts by EXACT athlete set (order-independent) and merge ──
  const setKeyOf = (ids: string[]) => [...ids].sort().join("|");
  const grouped = new Map<string, Post[]>();
  posts.forEach((p) => {
    const key = setKeyOf(p.athleteIds);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  });

  const PLATFORM_ORDER = ["ig_feed", "ig_reel", "tiktok"] as const;
  const PLATFORM_NAME: Record<"ig_feed" | "ig_reel" | "tiktok", string> = {
    ig_feed: "IG Feed", ig_reel: "IG Reel", tiktok: "TikTok",
  };
  const METRIC_KEYS = ["views", "impressions", "likes", "comments", "shares", "reposts", "totalEngagements"] as const;

  const collabGroups: CollabGroup[] = [];
  const idToGroupIds = new Map<string, string[]>();

  grouped.forEach((groupPosts: Post[]) => {
    const base = groupPosts[0];
    // Every raw platform|url pair — the recap uses these to skip per-athlete
    // double counting (must include BOTH columns when a URL is duplicated).
    const rawUrlKeys = groupPosts.map((p) => `${p.platform}|${p.url}`);

    // Dedupe by URL -> one source per unique post. Same URL in multiple columns
    // is a data-entry duplicate (counted once); prefer the IG Reel label for it.
    const byUrl = new Map<string, Post[]>();
    groupPosts.forEach((p) => {
      if (!byUrl.has(p.url)) byUrl.set(p.url, []);
      byUrl.get(p.url)!.push(p);
    });
    const sources: CollabPostSource[] = [];
    byUrl.forEach((dupes: Post[]) => {
      const reel = dupes.find((d) => d.platform === "ig_reel");
      const withMetrics = dupes.find((d) =>
        d.metrics.totalEngagements != null || d.metrics.impressions != null || d.metrics.views != null);
      const rep = reel || withMetrics || dupes[0];
      sources.push({
        platform: rep.platform,
        url: rep.url,
        metrics: rep.metrics,
        combinedEngagementRate: rep.combinedEngagementRate,
      });
    });

    // Display metrics: single post -> its metrics; multiple posts -> summed.
    let mergedMetrics: CollabMetrics;
    if (sources.length === 1) {
      mergedMetrics = { ...sources[0].metrics };
    } else {
      const acc: Record<string, number> = {};
      for (const s of sources) {
        for (const mk of METRIC_KEYS) {
          const v = (s.metrics as Record<string, number | undefined>)[mk];
          if (v != null) acc[mk] = (acc[mk] || 0) + v;
        }
      }
      mergedMetrics = acc as CollabMetrics;
    }

    // Combined followers is fixed per athlete set — never summed across posts.
    const combinedFollowers = base.combinedFollowers;
    const combinedEngagementRate = sources.length === 1
      ? sources[0].combinedEngagementRate
      : (combinedFollowers > 0 && mergedMetrics.totalEngagements != null
          ? (mergedMetrics.totalEngagements / combinedFollowers) * 100
          : 0);

    const distinctPlatforms = PLATFORM_ORDER.filter((pl) => sources.some((s) => s.platform === pl));
    const platformLabel = distinctPlatforms.map((pl) => PLATFORM_NAME[pl]).join(" + ");
    const primaryPlatform = distinctPlatforms[0] || base.platform;
    const uniqueUrls = Array.from(new Set(sources.map((s) => s.url))).sort();
    // Single-post groups keep the legacy id (`platform-hash(url)`) so collab
    // media keyed by the old id still resolves.
    const groupId = `${primaryPlatform}-${hashString(uniqueUrls.join("|"))}`;

    collabGroups.push({
      id: groupId,
      url: sources[0]?.url || base.url,
      platform: primaryPlatform,
      platformLabel,
      sources,
      rawUrlKeys,
      athleteIds: base.athleteIds,
      athleteNames: base.athleteNames,
      combinedFollowers,
      metrics: mergedMetrics,
      combinedEngagementRate,
    });

    for (const id of base.athleteIds) {
      if (!idToGroupIds.has(id)) idToGroupIds.set(id, []);
      idToGroupIds.get(id)!.push(groupId);
    }
  });

  return { collabGroups, idToGroupIds };
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
    // Rate guard: a non-rate search term ("impressions") must not match a rate
    // column ("engagement rate impressions" → contains the substring). Skip
    // "rate" columns unless the search term is itself a rate. Prevents an ER%
    // value from leaking into a metric slot (the phantom ig_feed_2 bug).
    const searchIsRate = lower.includes("rate");
    const idx = headers.findIndex((h) => {
      const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!hClean) return false; // Skip empty headers
      if (!searchIsRate && hClean.includes("rate")) return false;
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
    // Rate guard — see findCol.
    const searchIsRate = lower.includes("rate");
    for (let i = 0; i < headers.length; i++) {
      if (platformMap[i] !== platform) continue;
      const hClean = headers[i].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!hClean) continue;
      if (!searchIsRate && hClean.includes("rate")) continue;
      if (hClean === lower || hClean.includes(lower)) return i;
    }
  }
  return -1;
}

/**
 * Like findColInPlatform, but finds the Nth occurrence (0-based) of a column
 * within the given platform group. Used to distinguish Post 1 vs Post 2 columns
 * in v2 templates where the same metric names repeat for each post under the same
 * platform group tag (e.g. "ig_reel" → "IG REEL POST 1" and "IG REEL POST 2").
 *
 * When no group row is present, only occurrence=0 is supported (equivalent to
 * findCol); occurrence>0 returns -1 (no Post 2 data for single-post templates).
 */
function findColInPlatformNth(
  headers: string[],
  platformMap: PlatformTag[],
  platform: PlatformTag,
  occurrence: number,
  ...names: string[]
): number {
  const hasGroupRow = platformMap.some((p) => p !== "identity");
  if (!hasGroupRow) return occurrence === 0 ? findCol(headers, ...names) : -1;

  for (const name of names) {
    const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!lower) continue;
    // Rate guard — see findCol. Critical here: occurrence 1 of "impressions"
    // would otherwise resolve to "Engagement Rate Impressions" and fabricate a
    // phantom ig_feed_2 / tiktok_2 from a leaked ER% value.
    const searchIsRate = lower.includes("rate");
    let count = 0;
    for (let i = 0; i < headers.length; i++) {
      if (platformMap[i] !== platform) continue;
      const hClean = headers[i].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!hClean) continue;
      if (!searchIsRate && hClean.includes("rate")) continue;
      if (hClean === lower || hClean.includes(lower)) {
        if (count === occurrence) return i;
        count++;
      }
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
export function parseMetricsCSV(csvText: string): { athletes: ParsedAthlete[]; collabGroups: CollabGroup[] } {
  const lines = splitCSVRows(csvText);
  if (lines.length < 2) return { athletes: [], collabGroups: [] };

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
    : (() => {
      const r = findColInPlatformNth(headers, platformMap, "ig_feed", 0, "post 1", "post1");
      if (r !== -1) return r;
      return findCol(headers, "ig feed post url", "ig feed url", "ig feed post", "feed url", "feed post url", "feed post");
    })();
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
  // Story count: search for "post" FIRST (matches "IG STORY Post" at column T cleanly).
  // The previous order ("count", "post") incorrectly matched the unrelated "Review Count"
  // column at AR because the platform map forward-fills ig_story across all columns to
  // the right of the IG STORY group label, and "Review Count" contains the word "count".
  const iIgStoryCount = findColInPlatform(headers, platformMap, "ig_story", "post", "count")
    !== -1 ? findColInPlatform(headers, platformMap, "ig_story", "post", "count")
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
    : (() => {
      const r = findColInPlatformNth(headers, platformMap, "ig_reel", 0, "post 1", "post1");
      if (r !== -1) return r;
      return findCol(headers, "ig reel post url", "ig reel url", "reel url", "reel post url", "ig reels url", "ig reel post", "reel post");
    })();
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
    : (() => {
      const r = findColInPlatformNth(headers, platformMap, "tiktok", 0, "post 1", "post1");
      if (r !== -1) return r;
      return findCol(headers, "tiktok post url", "tiktok url", "tiktok post", "tt post url", "tt url");
    })();
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

  // ── IG Reel POST 2 columns ──
  // findColInPlatformNth with occurrence=1 finds the SECOND column with that name
  // inside the ig_reel platform group — i.e. the Post 2 columns.
  const iIgReelUrl2 = (() => {
    const r = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "post url", "url");
    if (r !== -1) return r;
    return findColInPlatformNth(headers, platformMap, "ig_reel", 0, "post 2", "post2");
  })();
  const iIgReelViews2 = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "views");
  const iIgReelLikes2 = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "likes");
  const iIgReelComments2 = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "comments");
  const iIgReelShares2 = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "shares");
  const iIgReelReposts2 = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "reposts");
  const iIgReelEngagements2 = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "total engagements", "engagements");
  const iIgReelEngRateFollowers2 = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "engagement rate followers", "eng rate followers");
  const iIgReelEngRateImpressions2 = findColInPlatformNth(headers, platformMap, "ig_reel", 1, "engagement rate impressions", "eng rate impressions");

  // ── IG Feed POST 2 columns ──
  const iIgFeedUrl2 = (() => {
    const r = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "post url", "url");
    if (r !== -1) return r;
    return findColInPlatformNth(headers, platformMap, "ig_feed", 0, "post 2", "post2");
  })();
  const iIgFeedReach2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "reach");
  const iIgFeedImpressions2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "impressions");
  const iIgFeedLikes2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "likes");
  const iIgFeedComments2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "comments");
  const iIgFeedShares2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "shares");
  const iIgFeedReposts2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "reposts");
  const iIgFeedEngagements2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "total engagements", "engagements");
  const iIgFeedEngRateFollowers2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "engagement rate followers", "eng rate followers");
  const iIgFeedEngRateImpressions2 = findColInPlatformNth(headers, platformMap, "ig_feed", 1, "engagement rate impressions", "eng rate impressions");

  // ── TikTok POST 2 columns ──
  const iTiktokFollowers2 = findColInPlatformNth(headers, platformMap, "tiktok", 1, "followers");
  const iTiktokUrl2 = (() => {
    const r = findColInPlatformNth(headers, platformMap, "tiktok", 1, "post url", "url");
    if (r !== -1) return r;
    return findColInPlatformNth(headers, platformMap, "tiktok", 0, "post 2", "post2");
  })();
  const iTiktokViews2 = findColInPlatformNth(headers, platformMap, "tiktok", 1, "views");
  const iTiktokLikes2 = findColInPlatformNth(headers, platformMap, "tiktok", 1, "likes");
  const iTiktokComments2 = findColInPlatformNth(headers, platformMap, "tiktok", 1, "comments");
  const iTiktokSaves2 = findColInPlatformNth(headers, platformMap, "tiktok", 1, "saves");
  const iTiktokEngagements2 = findColInPlatformNth(headers, platformMap, "tiktok", 1, "total engagements", "engagements");
  const iTiktokEngRateFollowers2 = findColInPlatformNth(headers, platformMap, "tiktok", 1, "engagement rate followers", "eng rate followers");
  const iTiktokEngRateImpressions2 = findColInPlatformNth(headers, platformMap, "tiktok", 1, "engagement rate impressions", "eng rate impressions");

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

    // ── Post 2 slots — populated when the Post 2 URL column is non-empty OR
    //    when any metric column has a value (handles CSVs with metrics but no links). ──
    const reelUrl2Raw = iIgReelUrl2 !== -1 ? getVal(iIgReelUrl2)?.trim() : undefined;
    const reelUrl2 = reelUrl2Raw?.startsWith("http") ? reelUrl2Raw : undefined;
    const reelViews2 = parseNum(getVal(iIgReelViews2));
    const reelLikes2 = parseNum(getVal(iIgReelLikes2));
    const reelComments2 = parseNum(getVal(iIgReelComments2));
    const reelEngagements2 = parseNum(getVal(iIgReelEngagements2));
    if (reelUrl2 || reelViews2 || reelLikes2 || reelComments2 || reelEngagements2) {
      metrics.ig_reel_2 = {
        post_url: reelUrl2,
        views: reelViews2,
        likes: reelLikes2,
        comments: reelComments2,
        shares: parseNum(getVal(iIgReelShares2)),
        reposts: parseNum(getVal(iIgReelReposts2)),
        total_engagements: reelEngagements2,
        engagement_rate_followers: parseRate(getVal(iIgReelEngRateFollowers2)),
        engagement_rate_impressions: parseRate(getVal(iIgReelEngRateImpressions2)),
      };
    }
    const feedUrl2Raw = iIgFeedUrl2 !== -1 ? getVal(iIgFeedUrl2)?.trim() : undefined;
    const feedUrl2 = feedUrl2Raw?.startsWith("http") ? feedUrl2Raw : undefined;
    const feedImpressions2 = parseNum(getVal(iIgFeedImpressions2));
    const feedLikes2 = parseNum(getVal(iIgFeedLikes2));
    const feedComments2 = parseNum(getVal(iIgFeedComments2));
    const feedEngagements2 = parseNum(getVal(iIgFeedEngagements2));
    if (feedUrl2 || feedImpressions2 || feedLikes2 || feedComments2 || feedEngagements2) {
      metrics.ig_feed_2 = {
        post_url: feedUrl2,
        reach: parseNum(getVal(iIgFeedReach2)),
        impressions: feedImpressions2,
        likes: feedLikes2,
        comments: feedComments2,
        shares: parseNum(getVal(iIgFeedShares2)),
        reposts: parseNum(getVal(iIgFeedReposts2)),
        total_engagements: feedEngagements2,
        engagement_rate_followers: parseRate(getVal(iIgFeedEngRateFollowers2)),
        engagement_rate_impressions: parseRate(getVal(iIgFeedEngRateImpressions2)),
      };
    }
    const tiktokUrl2Raw = iTiktokUrl2 !== -1 ? getVal(iTiktokUrl2)?.trim() : undefined;
    const tiktokUrl2 = tiktokUrl2Raw?.startsWith("http") ? tiktokUrl2Raw : undefined;
    const tiktokViews2 = parseNum(getVal(iTiktokViews2));
    const tiktokLikes2 = parseNum(getVal(iTiktokLikes2));
    const tiktokComments2 = parseNum(getVal(iTiktokComments2));
    const tiktokEngagements2 = parseNum(getVal(iTiktokEngagements2));
    if (tiktokUrl2 || tiktokViews2 || tiktokLikes2 || tiktokComments2 || tiktokEngagements2) {
      metrics.tiktok_2 = {
        post_url: tiktokUrl2,
        followers: parseNum(getVal(iTiktokFollowers2)),
        views: tiktokViews2,
        likes: tiktokLikes2,
        comments: tiktokComments2,
        saves: parseNum(getVal(iTiktokSaves2)),
        total_engagements: tiktokEngagements2,
        engagement_rate_followers: parseRate(getVal(iTiktokEngRateFollowers2)),
        engagement_rate_impressions: parseRate(getVal(iTiktokEngRateImpressions2)),
      };
    }

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

  // Collab detection. ParsedAthlete has no DB id, so we identify each row by
  // its name — that's what merges/lookups already use elsewhere in the parser.
  const { collabGroups, idToGroupIds } = detectCollabGroups(athletes, (a) => a.name);
  for (const a of athletes) {
    const ids = idToGroupIds.get(a.name);
    if (ids && ids.length) a.collabGroupIds = ids;
  }

  return { athletes, collabGroups };
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
export function parsePerformanceCSV(csvText: string): { athletes: ParsedAthlete[]; collabGroups: CollabGroup[] } {
  return parseMetricsCSV(csvText);
}
