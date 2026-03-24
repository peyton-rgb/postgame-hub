import type { AthleteMetrics } from "./types";

/**
 * Auto-fill total_engagements and engagement_rate for each platform
 * from the raw metric inputs. Returns a new metrics object.
 * Only recalculates if likes/comments are available — preserves
 * existing values from CSV when they're not.
 */
export function autoFillMetrics(metrics: AthleteMetrics): AthleteMetrics {
  const result: AthleteMetrics = JSON.parse(JSON.stringify(metrics));

  // IG Feed: total = likes + comments + shares + reposts, rate = total / impressions * 100
  if (result.ig_feed) {
    const likes = result.ig_feed.likes;
    const comments = result.ig_feed.comments;
    const shares = result.ig_feed.shares;
    const reposts = result.ig_feed.reposts;
    const impressions = result.ig_feed.impressions ?? 0;

    // Only recalculate if we have any engagement data
    if (likes != null || comments != null || shares != null || reposts != null) {
      const total = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (reposts ?? 0);
      result.ig_feed.total_engagements = total;
      // Only auto-calculate rate if not already provided (CSV rates may use a different formula)
      if (result.ig_feed.engagement_rate == null) {
        result.ig_feed.engagement_rate =
          impressions > 0 ? Math.round((total / impressions) * 10000) / 100 : 0;
      }
    }
  }

  // IG Reel: total = likes + comments + shares + reposts, rate = total / views * 100
  if (result.ig_reel) {
    const likes = result.ig_reel.likes;
    const comments = result.ig_reel.comments;
    const shares = result.ig_reel.shares;
    const reposts = result.ig_reel.reposts;
    const views = result.ig_reel.views ?? 0;

    if (likes != null || comments != null || shares != null || reposts != null) {
      const total = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (reposts ?? 0);
      result.ig_reel.total_engagements = total;
      if (result.ig_reel.engagement_rate == null) {
        result.ig_reel.engagement_rate =
          views > 0 ? Math.round((total / views) * 10000) / 100 : 0;
      }
    }
  }

  // TikTok: total from individual likes + comments OR combined fields, rate = total / views * 100
  if (result.tiktok) {
    const likes = result.tiktok.likes;
    const comments = result.tiktok.comments;
    const likesComments = result.tiktok.likes_comments;
    const savesShares = result.tiktok.saves_shares;
    const views = result.tiktok.views ?? 0;

    // Prefer individual likes/comments if available, fall back to combined
    if (likes != null || comments != null || likesComments != null || savesShares != null) {
      const engFromIndividual = (likes ?? 0) + (comments ?? 0);
      const engFromCombined = (likesComments ?? 0) + (savesShares ?? 0);
      const total = (likes != null || comments != null) ? engFromIndividual + (savesShares ?? 0) : engFromCombined;
      result.tiktok.total_engagements = total;
      if (result.tiktok.engagement_rate == null) {
        result.tiktok.engagement_rate =
          views > 0 ? Math.round((total / views) * 10000) / 100 : 0;
      }
    }
  }

  return result;
}
