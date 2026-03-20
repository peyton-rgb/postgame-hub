import type { AthleteMetrics } from "./types";

/**
 * Auto-fill total_engagements and engagement_rate for each platform
 * from the raw metric inputs. Returns a new metrics object.
 * Only recalculates if likes/comments are available — preserves
 * existing values from CSV when they're not.
 */
export function autoFillMetrics(metrics: AthleteMetrics): AthleteMetrics {
  const result: AthleteMetrics = JSON.parse(JSON.stringify(metrics));

  // IG Feed: total = likes + comments, rate = total / impressions * 100
  if (result.ig_feed) {
    const likes = result.ig_feed.likes;
    const comments = result.ig_feed.comments;
    const impressions = result.ig_feed.impressions ?? 0;

    // Only recalculate if we have likes or comments data
    if (likes != null || comments != null) {
      const total = (likes ?? 0) + (comments ?? 0);
      result.ig_feed.total_engagements = total;
      result.ig_feed.engagement_rate =
        impressions > 0 ? Math.round((total / impressions) * 10000) / 100 : 0;
    }
    // Otherwise keep whatever was parsed from CSV
  }

  // IG Reel: total = likes + comments, rate = total / views * 100
  if (result.ig_reel) {
    const likes = result.ig_reel.likes;
    const comments = result.ig_reel.comments;
    const views = result.ig_reel.views ?? 0;

    if (likes != null || comments != null) {
      const total = (likes ?? 0) + (comments ?? 0);
      result.ig_reel.total_engagements = total;
      result.ig_reel.engagement_rate =
        views > 0 ? Math.round((total / views) * 10000) / 100 : 0;
    }
  }

  // TikTok: total = likes_comments + saves_shares, rate = total / views * 100
  if (result.tiktok) {
    const likesComments = result.tiktok.likes_comments;
    const savesShares = result.tiktok.saves_shares;
    const views = result.tiktok.views ?? 0;

    if (likesComments != null || savesShares != null) {
      const total = (likesComments ?? 0) + (savesShares ?? 0);
      result.tiktok.total_engagements = total;
      result.tiktok.engagement_rate =
        views > 0 ? Math.round((total / views) * 10000) / 100 : 0;
    }
  }

  return result;
}
