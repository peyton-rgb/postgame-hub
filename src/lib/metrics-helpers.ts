import type { AthleteMetrics } from "./types";

/**
 * Auto-fill total_engagements and engagement_rate for each platform
 * ONLY when missing from the source data. The source CSV is the source
 * of truth — if it provides total_engagements, we never overwrite it
 * (the agency may use a calculation that differs from a naive sum,
 * e.g. weighted engagements or excluding certain interaction types).
 *
 * Component-based recomputation only fires when:
 *   1. total_engagements is null/undefined, AND
 *   2. at least one component (likes/comments/shares/reposts) is present
 *
 * Same rule for engagement_rate: only computed when missing.
 */
export function autoFillMetrics(metrics: AthleteMetrics): AthleteMetrics {
  const result: AthleteMetrics = JSON.parse(JSON.stringify(metrics));

  // ── IG Feed ──
  if (result.ig_feed) {
    const f = result.ig_feed;
    const hasAnyComponent =
      f.likes != null || f.comments != null || f.shares != null || f.reposts != null;

    // Only fill total_engagements if it's missing AND we have components to sum
    if (f.total_engagements == null && hasAnyComponent) {
      f.total_engagements =
        (f.likes ?? 0) + (f.comments ?? 0) + (f.shares ?? 0) + (f.reposts ?? 0);
    }

    // Only fill engagement_rate if it's missing AND we have a real total + impressions
    if (f.engagement_rate == null && f.total_engagements != null) {
      const impressions = f.impressions ?? 0;
      f.engagement_rate =
        impressions > 0
          ? Math.round((f.total_engagements / impressions) * 10000) / 100
          : 0;
    }
  }

  // ── IG Reel ──
  if (result.ig_reel) {
    const r = result.ig_reel;
    const hasAnyComponent =
      r.likes != null || r.comments != null || r.shares != null || r.reposts != null;

    if (r.total_engagements == null && hasAnyComponent) {
      r.total_engagements =
        (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.reposts ?? 0);
    }

    if (r.engagement_rate == null && r.total_engagements != null) {
      const views = r.views ?? 0;
      r.engagement_rate =
        views > 0 ? Math.round((r.total_engagements / views) * 10000) / 100 : 0;
    }
  }

  // ── TikTok ──
  if (result.tiktok) {
    const t = result.tiktok;
    const hasAnyComponent =
      t.likes != null ||
      t.comments != null ||
      t.likes_comments != null ||
      t.saves_shares != null;

    if (t.total_engagements == null && hasAnyComponent) {
      // Prefer individual likes/comments if available; else use combined fields
      if (t.likes != null || t.comments != null) {
        t.total_engagements = (t.likes ?? 0) + (t.comments ?? 0) + (t.saves_shares ?? 0);
      } else {
        t.total_engagements = (t.likes_comments ?? 0) + (t.saves_shares ?? 0);
      }
    }

    if (t.engagement_rate == null && t.total_engagements != null) {
      const views = t.views ?? 0;
      t.engagement_rate =
        views > 0 ? Math.round((t.total_engagements / views) * 10000) / 100 : 0;
    }
  }

  return result;
}
