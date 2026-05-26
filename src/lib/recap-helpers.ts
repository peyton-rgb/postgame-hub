import type { Athlete, AthleteMetrics, Campaign, MetricOverrides, HeroMetricOverrideKey, Media, CollabGroup } from "@/lib/types";

// ─── Display formatters (unchanged) ──────────────────────────────────────────

export function fmt(n: number | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export function pct(n: number | undefined): string {
  if (n == null) return "0%";
  return Math.round(n) + "%";
}

export function dollar(n: number | undefined): string {
  if (n == null) return "$0";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Engagement-rate helpers (per the agreed source-of-truth rules) ──────────

type Platform = "ig_feed" | "ig_reel" | "tiktok";

/**
 * For a single athlete + platform, return the higher of the two engagement rates
 * (vs Followers, vs Impressions). Falls back to the legacy single `engagement_rate`
 * field when neither dual-rate field is present (older campaigns).
 *
 * Returns 0 when the athlete didn't post on this platform at all (no post_url AND
 * no view/impression activity). Returns 0 when no rate data of any kind exists.
 */
export function bestRateForPlatform(metrics: AthleteMetrics | undefined, platform: Platform): number {
  if (!metrics) return 0;

  // If there's no post and no engagement activity, treat as "didn't post" (0, will be excluded upstream).
  if (!athletePostedOn(metrics, platform)) return 0;

  const block = metrics[platform];
  if (!block) return 0;

  const rateF = block.engagement_rate_followers;
  const rateI = block.engagement_rate_impressions;
  const legacy = block.engagement_rate;

  const candidates: number[] = [];
  if (rateF != null && rateF > 0) candidates.push(rateF);
  if (rateI != null && rateI > 0) candidates.push(rateI);
  if (candidates.length === 0 && legacy != null && legacy > 0) candidates.push(legacy);

  if (candidates.length === 0) return 0;
  return Math.max(...candidates);
}

/**
 * Did this athlete post anything on this platform? Used to decide whether the
 * platform's engagement rate is included in the Hero average. Per the rule:
 * platforms with no posts are excluded (not counted as 0%).
 */
function athletePostedOn(metrics: AthleteMetrics | undefined, platform: Platform): boolean {
  if (!metrics) return false;
  if (platform === "ig_feed") {
    const b = metrics.ig_feed;
    if (!b) return false;
    return !!b.post_url || (b.impressions ?? 0) > 0 || (b.total_engagements ?? 0) > 0;
  }
  if (platform === "ig_reel") {
    const b = metrics.ig_reel;
    if (!b) return false;
    return !!b.post_url || (b.views ?? 0) > 0 || (b.total_engagements ?? 0) > 0;
  }
  // tiktok
  const b = metrics.tiktok;
  if (!b) return false;
  return !!b.post_url || (b.views ?? 0) > 0 || (b.total_engagements ?? 0) > 0;
}

// ─── Hero metric computation ─────────────────────────────────────────────────

export interface ComputedStats {
  // Hero metrics (the eight numbers shown at the top of every recap)
  athleteCount: number;
  schoolCount: number;
  sportCount: number;
  totalPosts: number;
  combinedFollowers: number;
  totalImpressions: number;
  totalEngagements: number;
  avgEngRate: number;
  igAvgEngRate: number;
  tiktokAvgEngRate: number;

  // Per-platform totals (used by the Platform Breakdown section)
  igFeedPosts: number;
  igReelPosts: number;
  tiktokPosts: number;
  igStoryPosts: number; // ADDED (Change 3): story post count for platform breakdown
  totalReach: number;
  igFeed: { reach: number; impressions: number; likes: number; comments: number; shares: number; reposts: number; engagements: number; engRateSum: number; engRateCount: number };
  igStory: { count: number; impressions: number };
  igReel: { views: number; likes: number; comments: number; shares: number; reposts: number; engagements: number; engRateSum: number; engRateCount: number };
  tiktok: { followers: number; views: number; likes: number; comments: number; saves: number; likes_comments: number; saves_shares: number; engagements: number; engRateSum: number; engRateCount: number };

  // Click & sales (unchanged from prior implementation)
  clicks: { link_clicks: number; click_through_rate_sum: number; click_through_rate_count: number; landing_page_views: number; cost_per_click_sum: number; cost_per_click_count: number; orders: number; salesAmount: number; cpm_sum: number; cpm_count: number };
  hasClicks: boolean;
  sales: { conversions: number; revenue: number; conversion_rate_sum: number; conversion_rate_count: number; cost_per_acquisition_sum: number; cost_per_acquisition_count: number; roas_sum: number; roas_count: number };
  hasSales: boolean;
}

export function computeStats(athletes: Athlete[], collabGroups: CollabGroup[] = []): ComputedStats {
  // Filter out blank/whitespace strings when counting uniques (was a bug — blanks counted as a unique value).
  const schools = new Set(athletes.map((a) => (a.school || "").trim()).filter(Boolean));
  const sports = new Set(athletes.map((a) => (a.sport || "").trim()).filter(Boolean));

  // Build a quick "is this athlete+platform a collab participant?" lookup.
  // Skipping the per-athlete metric block when its URL is in a collab keeps us
  // from counting the same post 5× when 5 athletes share it; the collab's
  // metrics are then added back once below.
  const collabUrlPlatforms = new Set<string>();
  for (const g of collabGroups) for (const k of g.rawUrlKeys) collabUrlPlatforms.add(k);
  const isCollabPost = (platform: "ig_feed" | "ig_reel" | "tiktok", url: string | undefined) =>
    !!url && collabUrlPlatforms.has(`${platform}|${url}`);

  let totalPosts = 0;
  let totalImpressions = 0;
  let totalEngagements = 0;
  let combinedFollowers = 0;
  let igFeedPosts = 0;
  let igReelPosts = 0;
  let tiktokPosts = 0;
  let totalReach = 0;

  // UPDATED (Change 2): Flat engagement rate accumulators — one entry per unique post,
  // instead of per-platform average-of-averages.
  let allRateSum = 0;
  let allRateCount = 0;
  let igRateSum = 0;
  let igRateCount = 0;
  let tiktokRateSum = 0;
  let tiktokRateCount = 0;

  const igFeed = { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, reposts: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };
  const igStory = { count: 0, impressions: 0 };
  const igReel = { views: 0, likes: 0, comments: 0, shares: 0, reposts: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };
  const tiktok = { followers: 0, views: 0, likes: 0, comments: 0, saves: 0, likes_comments: 0, saves_shares: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };
  const clicks = { link_clicks: 0, click_through_rate_sum: 0, click_through_rate_count: 0, landing_page_views: 0, cost_per_click_sum: 0, cost_per_click_count: 0, orders: 0, salesAmount: 0, cpm_sum: 0, cpm_count: 0 };
  const sales = { conversions: 0, revenue: 0, conversion_rate_sum: 0, conversion_rate_count: 0, cost_per_acquisition_sum: 0, cost_per_acquisition_count: 0, roas_sum: 0, roas_count: 0 };
  let hasClicks = false;
  let hasSales = false;

  for (const a of athletes) {
    const m = a.metrics || {};

    // ── Combined Followers (IG + TikTok per the Definitions doc) ──
    // Per-athlete value — not affected by collab dedupe; we still sum every
    // participating athlete's followers.
    combinedFollowers += (a.ig_followers || 0) + (m.tiktok?.followers || 0);

    const feedIsCollab = isCollabPost("ig_feed", m.ig_feed?.post_url);
    const reelIsCollab = isCollabPost("ig_reel", m.ig_reel?.post_url);
    const tiktokIsCollab = isCollabPost("tiktok", m.tiktok?.post_url);
    // Post 2 collab checks — same URL space, so a Post 2 URL in a collab group is skipped.
    const feed2IsCollab = isCollabPost("ig_feed", m.ig_feed_2?.post_url);
    const reel2IsCollab = isCollabPost("ig_reel", m.ig_reel_2?.post_url);
    const tiktok2IsCollab = isCollabPost("tiktok", m.tiktok_2?.post_url);

    // ── Post counting (skip collab posts here — added once below) ──
    if (m.ig_feed?.post_url && !feedIsCollab) { igFeedPosts++; totalPosts++; }
    if (m.ig_feed_2?.post_url && !feed2IsCollab) { igFeedPosts++; totalPosts++; }
    if (m.ig_reel?.post_url && !reelIsCollab) { igReelPosts++; totalPosts++; }
    if (m.ig_reel_2?.post_url && !reel2IsCollab) { igReelPosts++; totalPosts++; }
    if (m.tiktok?.post_url && !tiktokIsCollab) { tiktokPosts++; totalPosts++; }
    if (m.tiktok_2?.post_url && !tiktok2IsCollab) { tiktokPosts++; totalPosts++; }
    if (m.ig_story?.count) { totalPosts += m.ig_story.count; }

    // ── Total Impressions: Feed + Story + Reel + TikTok (Post 1 + Post 2) ──
    // UPDATED (Change 1): Always include every athlete's impressions/views, even for collab posts.
    // Collab post impressions = sum of ALL athletes' individual impressions in the collab.
    const storyTotalImp = m.ig_story?.total_impressions
      ?? ((m.ig_story?.impressions ?? 0) * (m.ig_story?.count ?? 0));
    totalImpressions +=
      (m.ig_feed?.impressions || 0) +
      (m.ig_feed_2?.impressions || 0) +
      storyTotalImp +
      (m.ig_reel?.views || 0) +
      (m.ig_reel_2?.views || 0) +
      (m.tiktok?.views || 0) +
      (m.tiktok_2?.views || 0);

    // ── Total Engagements: Feed + Reel + TikTok (Post 1 + Post 2; Story has none) ──
    totalEngagements +=
      (feedIsCollab ? 0 : (m.ig_feed?.total_engagements || 0)) +
      (feed2IsCollab ? 0 : (m.ig_feed_2?.total_engagements || 0)) +
      (reelIsCollab ? 0 : (m.ig_reel?.total_engagements || 0)) +
      (reel2IsCollab ? 0 : (m.ig_reel_2?.total_engagements || 0)) +
      (tiktokIsCollab ? 0 : (m.tiktok?.total_engagements || 0)) +
      (tiktok2IsCollab ? 0 : (m.tiktok_2?.total_engagements || 0));

    // ── Reach (legacy display field) ──
    totalReach += (feedIsCollab ? 0 : (m.ig_feed?.reach || 0)) + (a.ig_followers || 0);

    // ── Per-platform aggregations (Post 1) ──
    // UPDATED (Change 1): Impressions/views always included, even for collab athletes.
    // Engagement stats (likes, comments, etc.) still skip collab — counted via collab group.
    igFeed.impressions += m.ig_feed?.impressions || 0;
    if (!feedIsCollab) {
      igFeed.reach += m.ig_feed?.reach || 0;
      igFeed.likes += m.ig_feed?.likes || 0;
      igFeed.comments += m.ig_feed?.comments || 0;
      igFeed.shares += m.ig_feed?.shares || 0;
      igFeed.reposts += m.ig_feed?.reposts || 0;
      igFeed.engagements += m.ig_feed?.total_engagements || 0;
      const r = bestRateForPlatform(m, "ig_feed");
      if (r > 0) {
        igFeed.engRateSum += r; igFeed.engRateCount++;
        // UPDATED (Change 2): Flat average accumulation
        allRateSum += r; allRateCount++;
        igRateSum += r; igRateCount++;
      }
    }
    // Post 2
    igFeed.impressions += m.ig_feed_2?.impressions || 0;
    if (!feed2IsCollab && m.ig_feed_2?.post_url) {
      igFeed.reach += m.ig_feed_2.reach || 0;
      igFeed.likes += m.ig_feed_2.likes || 0;
      igFeed.comments += m.ig_feed_2.comments || 0;
      igFeed.shares += m.ig_feed_2.shares || 0;
      igFeed.reposts += m.ig_feed_2.reposts || 0;
      igFeed.engagements += m.ig_feed_2.total_engagements || 0;
      const r2f = Math.max(m.ig_feed_2.engagement_rate_followers ?? 0, m.ig_feed_2.engagement_rate_impressions ?? 0);
      if (r2f > 0) {
        igFeed.engRateSum += r2f; igFeed.engRateCount++;
        // UPDATED (Change 2): Flat average accumulation
        allRateSum += r2f; allRateCount++;
        igRateSum += r2f; igRateCount++;
      }
    }

    igStory.count += m.ig_story?.count || 0;
    igStory.impressions += m.ig_story?.total_impressions
      ?? ((m.ig_story?.impressions ?? 0) * (m.ig_story?.count ?? 0));

    igReel.views += m.ig_reel?.views || 0;
    if (!reelIsCollab) {
      igReel.likes += m.ig_reel?.likes || 0;
      igReel.comments += m.ig_reel?.comments || 0;
      igReel.shares += m.ig_reel?.shares || 0;
      igReel.reposts += m.ig_reel?.reposts || 0;
      igReel.engagements += m.ig_reel?.total_engagements || 0;
      const r = bestRateForPlatform(m, "ig_reel");
      if (r > 0) {
        igReel.engRateSum += r; igReel.engRateCount++;
        // UPDATED (Change 2): Flat average accumulation
        allRateSum += r; allRateCount++;
        igRateSum += r; igRateCount++;
      }
    }
    // Post 2
    igReel.views += m.ig_reel_2?.views || 0;
    if (!reel2IsCollab && m.ig_reel_2?.post_url) {
      igReel.likes += m.ig_reel_2.likes || 0;
      igReel.comments += m.ig_reel_2.comments || 0;
      igReel.shares += m.ig_reel_2.shares || 0;
      igReel.reposts += m.ig_reel_2.reposts || 0;
      igReel.engagements += m.ig_reel_2.total_engagements || 0;
      const r2r = Math.max(m.ig_reel_2.engagement_rate_followers ?? 0, m.ig_reel_2.engagement_rate_impressions ?? 0);
      if (r2r > 0) {
        igReel.engRateSum += r2r; igReel.engRateCount++;
        // UPDATED (Change 2): Flat average accumulation
        allRateSum += r2r; allRateCount++;
        igRateSum += r2r; igRateCount++;
      }
    }

    tiktok.followers += m.tiktok?.followers || 0;
    tiktok.views += m.tiktok?.views || 0;
    if (!tiktokIsCollab) {
      tiktok.likes += m.tiktok?.likes || 0;
      tiktok.comments += m.tiktok?.comments || 0;
      tiktok.saves += m.tiktok?.saves || 0;
      tiktok.likes_comments += m.tiktok?.likes_comments || 0;
      tiktok.saves_shares += m.tiktok?.saves_shares || 0;
      tiktok.engagements += m.tiktok?.total_engagements || 0;
      const r = bestRateForPlatform(m, "tiktok");
      if (r > 0) {
        tiktok.engRateSum += r; tiktok.engRateCount++;
        // UPDATED (Change 2): Flat average accumulation
        allRateSum += r; allRateCount++;
        tiktokRateSum += r; tiktokRateCount++;
      }
    }
    // Post 2
    tiktok.views += m.tiktok_2?.views || 0;
    if (!tiktok2IsCollab && m.tiktok_2?.post_url) {
      tiktok.followers += m.tiktok_2.followers || 0;
      tiktok.likes += m.tiktok_2.likes || 0;
      tiktok.comments += m.tiktok_2.comments || 0;
      tiktok.saves += m.tiktok_2.saves || 0;
      tiktok.engagements += m.tiktok_2.total_engagements || 0;
      const r2t = Math.max(m.tiktok_2.engagement_rate_followers ?? 0, m.tiktok_2.engagement_rate_impressions ?? 0);
      if (r2t > 0) {
        tiktok.engRateSum += r2t; tiktok.engRateCount++;
        // UPDATED (Change 2): Flat average accumulation
        allRateSum += r2t; allRateCount++;
        tiktokRateSum += r2t; tiktokRateCount++;
      }
    }

    // ── Clicks (unchanged) ──
    if (m.clicks) {
      const c = m.clicks;
      if (c.link_clicks || c.click_through_rate || c.landing_page_views || c.cost_per_click || c.orders || c.sales || c.cpm) hasClicks = true;
      clicks.link_clicks += c.link_clicks || 0;
      clicks.landing_page_views += c.landing_page_views || 0;
      clicks.orders += c.orders || 0;
      clicks.salesAmount += c.sales || 0;
      if (c.click_through_rate != null && c.click_through_rate > 0) { clicks.click_through_rate_sum += c.click_through_rate; clicks.click_through_rate_count++; }
      if (c.cost_per_click != null && c.cost_per_click > 0) { clicks.cost_per_click_sum += c.cost_per_click; clicks.cost_per_click_count++; }
      if (c.cpm != null && c.cpm > 0) { clicks.cpm_sum += c.cpm; clicks.cpm_count++; }
    }

    // ── Sales (unchanged) ──
    if (m.sales) {
      const s = m.sales;
      if (s.conversions || s.revenue || s.conversion_rate || s.cost_per_acquisition || s.roas) hasSales = true;
      sales.conversions += s.conversions || 0;
      sales.revenue += s.revenue || 0;
      if (s.conversion_rate != null && s.conversion_rate > 0) { sales.conversion_rate_sum += s.conversion_rate; sales.conversion_rate_count++; }
      if (s.cost_per_acquisition != null && s.cost_per_acquisition > 0) { sales.cost_per_acquisition_sum += s.cost_per_acquisition; sales.cost_per_acquisition_count++; }
      if (s.roas != null && s.roas > 0) { sales.roas_sum += s.roas; sales.roas_count++; }
    }
  }

  // ── Collab groups: add each one's metrics exactly once. ──
  // UPDATED (Change 1): Impressions/views NOT added here — already summed per-athlete above.
  // Only engagements, likes, comments, etc. are added from the collab group.
  // Iterate each group's unique posts (sources). A merged feed+reel collab
  // contributes two posts; a duplicate-URL collab contributes one.
  for (const g of collabGroups) {
    for (const s of g.sources) {
      const gm = s.metrics;
      const engagements = gm.totalEngagements || 0;
      const likes = gm.likes || 0;
      const comments = gm.comments || 0;
      const shares = gm.shares || 0;
      const reposts = gm.reposts || 0;
      const rate = s.combinedEngagementRate;

      if (s.platform === "ig_feed") {
        igFeedPosts++; totalPosts++;
        totalEngagements += engagements;
        igFeed.likes += likes;
        igFeed.comments += comments;
        igFeed.shares += shares;
        igFeed.reposts += reposts;
        igFeed.engagements += engagements;
        if (rate > 0) {
          igFeed.engRateSum += rate; igFeed.engRateCount++;
          // UPDATED (Change 2): Collab post counts as one entry in flat average
          allRateSum += rate; allRateCount++;
          igRateSum += rate; igRateCount++;
        }
      } else if (s.platform === "ig_reel") {
        igReelPosts++; totalPosts++;
        totalEngagements += engagements;
        igReel.likes += likes;
        igReel.comments += comments;
        igReel.shares += shares;
        igReel.reposts += reposts;
        igReel.engagements += engagements;
        if (rate > 0) {
          igReel.engRateSum += rate; igReel.engRateCount++;
          // UPDATED (Change 2): Collab post counts as one entry in flat average
          allRateSum += rate; allRateCount++;
          igRateSum += rate; igRateCount++;
        }
      } else {
        tiktokPosts++; totalPosts++;
        totalEngagements += engagements;
        tiktok.likes += likes;
        tiktok.comments += comments;
        tiktok.engagements += engagements;
        if (rate > 0) {
          tiktok.engRateSum += rate; tiktok.engRateCount++;
          // UPDATED (Change 2): Collab post counts as one entry in flat average
          allRateSum += rate; allRateCount++;
          tiktokRateSum += rate; tiktokRateCount++;
        }
      }
    }
  }

  // ── UPDATED (Change 2): Flat average across all unique posts ──
  const avgEngRate = allRateCount > 0 ? allRateSum / allRateCount : 0;
  const igAvgEngRate = igRateCount > 0 ? igRateSum / igRateCount : 0;
  const tiktokAvgEngRate = tiktokRateCount > 0 ? tiktokRateSum / tiktokRateCount : 0;

  return {
    athleteCount: athletes.length,
    schoolCount: schools.size,
    sportCount: sports.size,
    totalPosts,
    combinedFollowers,
    totalImpressions,
    totalEngagements,
    avgEngRate,
    igAvgEngRate,
    tiktokAvgEngRate,
    igFeedPosts, igReelPosts, tiktokPosts,
    igStoryPosts: igStory.count, // ADDED (Change 3)
    totalReach,
    igFeed, igStory, igReel, tiktok,
    clicks, hasClicks, sales, hasSales,
  };
}

// ─── Override application ────────────────────────────────────────────────────

/**
 * Apply hand-typed Hero metric overrides on top of computed stats.
 * Returns both the merged values AND a record of which keys were overridden,
 * so the recap UI can render an "edited" badge next to overridden values.
 *
 * An override is applied only when the value is a non-null number. An explicit
 * `null` in the overrides JSON means "the user cleared this override" — fall
 * back to the calculated value.
 */
export interface AppliedStats extends ComputedStats {
  /** Keys whose displayed value comes from an override, not from calculation. */
  overriddenKeys: Set<HeroMetricOverrideKey>;
}

export function applyOverrides(stats: ComputedStats, overrides?: MetricOverrides | null): AppliedStats {
  const out: AppliedStats = { ...stats, overriddenKeys: new Set<HeroMetricOverrideKey>() };
  if (!overrides) return out;

  const map: Record<HeroMetricOverrideKey, keyof ComputedStats> = {
    athlete_count: "athleteCount",
    school_count: "schoolCount",
    sport_count: "sportCount",
    total_posts: "totalPosts",
    combined_followers: "combinedFollowers",
    total_impressions: "totalImpressions",
    total_engagements: "totalEngagements",
    ig_avg_engagement_rate: "igAvgEngRate",
    tiktok_avg_engagement_rate: "tiktokAvgEngRate",
  };

  for (const key of Object.keys(map) as HeroMetricOverrideKey[]) {
    const override = overrides[key];
    if (override != null && typeof override === "number" && !isNaN(override)) {
      // Type assertion is safe because every key in `map` points to a numeric field.
      (out as unknown as Record<string, number>)[map[key]] = override;
      out.overriddenKeys.add(key);
    }
  }

  return out;
}

/** Convenience: compute + apply overrides in one call. */
export function computeStatsWithOverrides(
  athletes: Athlete[],
  campaign?: { metric_overrides?: MetricOverrides | null } | null,
  collabGroups: CollabGroup[] = [],
): AppliedStats {
  const stats = computeStats(athletes, collabGroups);
  return applyOverrides(stats, campaign?.metric_overrides);
}

/** Returns the collab group's combined engagement rate (already in % form). */
export function getCollabEngRate(group: CollabGroup): number {
  return group.combinedEngagementRate;
}

// ─── Top performers (uses the new dual-rate engagement model) ────────────────

function bestEngWithPlatform(m: AthleteMetrics | undefined): { rate: number; platform: string } {
  let best = { rate: 0, platform: "" };
  const platforms: { key: Platform; label: string }[] = [
    { key: "ig_feed", label: "IG Feed" },
    { key: "ig_reel", label: "IG Reel" },
    { key: "tiktok", label: "TikTok" },
  ];
  for (const { key, label } of platforms) {
    const r = bestRateForPlatform(m, key);
    if (r > best.rate) best = { rate: r, platform: label };
  }
  // Also check Post 2 blocks so multi-post athletes get credit for their best slot.
  if (m?.ig_feed_2?.post_url) {
    const r2 = Math.max(m.ig_feed_2.engagement_rate_followers ?? 0, m.ig_feed_2.engagement_rate_impressions ?? 0);
    if (r2 > best.rate) best = { rate: r2, platform: "IG Feed" };
  }
  if (m?.ig_reel_2?.post_url) {
    const r2 = Math.max(m.ig_reel_2.engagement_rate_followers ?? 0, m.ig_reel_2.engagement_rate_impressions ?? 0);
    if (r2 > best.rate) best = { rate: r2, platform: "IG Reel" };
  }
  if (m?.tiktok_2?.post_url) {
    const r2 = Math.max(m.tiktok_2.engagement_rate_followers ?? 0, m.tiktok_2.engagement_rate_impressions ?? 0);
    if (r2 > best.rate) best = { rate: r2, platform: "TikTok" };
  }
  return best;
}

type AthleteTopPerformerEntry = Athlete & {
  kind: "athlete";
  bestEngRate: number;
  bestPlatform: string;
  totalImpressions: number;
};

type CollabTopPerformerEntry = CollabGroup & {
  kind: "collab";
  bestEngRate: number;
  bestPlatform: string;
  totalImpressions: number;
};

export type TopPerformerEntry = AthleteTopPerformerEntry | CollabTopPerformerEntry;

function bestPlatformKey(label: string): Platform | null {
  if (label === "IG Feed") return "ig_feed";
  if (label === "IG Reel") return "ig_reel";
  if (label === "TikTok") return "tiktok";
  return null;
}

function buildCollabUrlSet(collabGroups: CollabGroup[]): Set<string> {
  const set = new Set<string>();
  for (const g of collabGroups) for (const s of g.sources) {
    if (s.url) set.add(s.url);
  }
  return set;
}

function collabTotalImpressions(g: CollabGroup): number {
  return g.metrics.views ?? g.metrics.impressions ?? 0;
}

/** Find the collab group that an athlete's best-platform post belongs to. */
function findCollabGroupForAthlete(
  a: Athlete,
  platformKey: Platform | null,
  collabGroups: CollabGroup[],
  collabUrls: Set<string>,
): CollabGroup | undefined {
  if (!platformKey) return undefined;
  const m = a.metrics;
  if (!m) return undefined;

  // Check all URL slots for this athlete to find a collab match
  const urlsToCheck: (string | undefined)[] = [];
  if (platformKey === "ig_feed") {
    urlsToCheck.push(m.ig_feed?.post_url, m.ig_feed_2?.post_url);
  } else if (platformKey === "ig_reel") {
    urlsToCheck.push(m.ig_reel?.post_url, m.ig_reel_2?.post_url);
  } else {
    urlsToCheck.push(m.tiktok?.post_url, m.tiktok_2?.post_url);
  }

  for (const url of urlsToCheck) {
    if (url && collabUrls.has(url)) {
      const group = collabGroups.find((g) => g.sources.some((s) => s.url === url));
      if (group) return group;
    }
  }
  return undefined;
}

export function getTopPerformers(
  athletes: Athlete[],
  collabGroups: CollabGroup[] = [],
  count = 5,
): TopPerformerEntry[] {
  const collabUrls = buildCollabUrlSet(collabGroups);

  // UPDATED (Change 4): Collab athletes get their collab group's ER and impressions
  // instead of being zeroed out. This ensures collab partners show matching rates.
  const athleteEntries: AthleteTopPerformerEntry[] = athletes
    .map((a) => {
      const { rate, platform } = bestEngWithPlatform(a.metrics);
      const key = bestPlatformKey(platform);
      const collabGroup = findCollabGroupForAthlete(a, key, collabGroups, collabUrls);

      return {
        ...a,
        kind: "athlete" as const,
        bestEngRate: collabGroup ? collabGroup.combinedEngagementRate : rate,
        bestPlatform: platform,
        totalImpressions: collabGroup
          ? collabTotalImpressions(collabGroup)
          : getTotalImpressions(a),
      };
    })
    .filter((e) => e.bestEngRate > 0);

  const collabEntries: CollabTopPerformerEntry[] = collabGroups.map((g) => ({
    ...g,
    kind: "collab" as const,
    bestEngRate: g.combinedEngagementRate,
    bestPlatform: g.platformLabel,
    totalImpressions: collabTotalImpressions(g),
  }));

  return [...athleteEntries, ...collabEntries]
    .sort((a, b) => b.bestEngRate - a.bestEngRate)
    .slice(0, count);
}

export function getTopPerformersByImpressions(
  athletes: Athlete[],
  collabGroups: CollabGroup[] = [],
  count = 5,
): TopPerformerEntry[] {
  const collabUrls = buildCollabUrlSet(collabGroups);

  // UPDATED (Change 4): Collab athletes get their collab group's impressions
  // instead of being excluded entirely.
  const athleteEntries: AthleteTopPerformerEntry[] = athletes
    .map((a) => {
      const { rate, platform } = bestEngWithPlatform(a.metrics);
      const key = bestPlatformKey(platform);
      const collabGroup = findCollabGroupForAthlete(a, key, collabGroups, collabUrls);

      return {
        ...a,
        kind: "athlete" as const,
        bestEngRate: collabGroup ? collabGroup.combinedEngagementRate : rate,
        bestPlatform: platform,
        totalImpressions: collabGroup
          ? collabTotalImpressions(collabGroup)
          : getTotalImpressions(a),
      };
    })
    .filter((e) => e.totalImpressions > 0);

  const collabEntries: CollabTopPerformerEntry[] = collabGroups.map((g) => ({
    ...g,
    kind: "collab" as const,
    bestEngRate: g.combinedEngagementRate,
    bestPlatform: g.platformLabel,
    totalImpressions: collabTotalImpressions(g),
  }));

  return [...athleteEntries, ...collabEntries]
    .sort((a, b) => b.totalImpressions - a.totalImpressions)
    .slice(0, count);
}

// ─── Per-athlete helpers (used by recap detail rows) ─────────────────────────

export function getPostUrl(athlete: Athlete): string | null {
  const m = athlete.metrics || {};
  return m.ig_feed?.post_url || m.ig_reel?.post_url || m.tiktok?.post_url || athlete.post_url || null;
}

export function getMediaLabel(items: Media[]): string {
  const hasVideo = items.some((m) => m.type === "video");
  const hasImage = items.some((m) => m.type === "image");
  if (hasVideo && hasImage) return "Photo + Video";
  if (hasVideo) return "Video";
  return "Photo";
}

export function getBestEngRate(athlete: Athlete): number {
  return bestEngWithPlatform(athlete.metrics).rate;
}

export function getTotalImpressions(athlete: Athlete): number {
  const m = athlete.metrics || {};
  const storyTotal = m.ig_story?.total_impressions
    ?? ((m.ig_story?.impressions ?? 0) * (m.ig_story?.count ?? 0));
  return (m.ig_feed?.impressions || 0)
    + (m.ig_feed_2?.impressions || 0)
    + storyTotal
    + (m.ig_reel?.views || 0)
    + (m.ig_reel_2?.views || 0)
    + (m.tiktok?.views || 0)
    + (m.tiktok_2?.views || 0);
}

export function getTotalEngagements(athlete: Athlete): number {
  const m = athlete.metrics || {};
  return (m.ig_feed?.total_engagements || 0)
    + (m.ig_feed_2?.total_engagements || 0)
    + (m.ig_reel?.total_engagements || 0)
    + (m.ig_reel_2?.total_engagements || 0)
    + (m.tiktok?.total_engagements || 0)
    + (m.tiktok_2?.total_engagements || 0);
}
