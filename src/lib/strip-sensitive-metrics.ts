// ─────────────────────────────────────────────────────────────────────────────
// strip-sensitive-metrics.ts
//
// Server-side privacy filter for PUBLIC recap surfaces.
//
// Campaign-tracker performance metrics (engagement rate, impressions, reach,
// total engagements, likes, comments, shares, reposts, saves, views) live inside
// athletes.metrics per-platform objects. They must NOT reach anonymous/public
// viewers — not in the rendered page and not in the browser/RSC/network payload.
//
// stripSensitiveMetrics() removes ONLY the sensitive keys (a denylist) from each
// per-platform object, leaving everything else intact:
//   - post_url                          (kept — used for "view post" links)
//   - tiktok.followers / tiktok_2.followers (kept — follower counts are public)
//   - ig_story.count                    (kept — story count is not sensitive)
//   - clicks / sales / targets / campaign_tag / headshot_url / content_folder_url
//   - every athlete-level field (name, school, sport, ig_followers, …)
//
// Apply AFTER fetch and BEFORE data is passed to components / serialized, on the
// PUBLIC (anon) recap page and the PUBLIC pptx route only. Do NOT apply on the
// ?preview=1 (non-production, service-role) path or the token-gated portal —
// those intentionally keep full metrics.
// ─────────────────────────────────────────────────────────────────────────────

import type { Athlete, AthleteMetrics } from "@/lib/types";

// Per-platform objects inside athletes.metrics that hold performance numbers.
const PLATFORM_KEYS: (keyof AthleteMetrics)[] = [
  "ig_feed",
  "ig_story",
  "ig_reel",
  "tiktok",
  "ig_feed_2",
  "ig_reel_2",
  "tiktok_2",
];

// Sensitive metric keys to remove from each per-platform object. Denylist, so any
// non-listed key (post_url, followers, count, shares-derived legacy fields, …) is
// preserved automatically.
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "engagement_rate",
  "engagement_rate_followers",
  "engagement_rate_impressions",
  "impressions",
  "reach",
  "total_engagements",
  "views",
  "total_impressions",
  "likes",
  "comments",
  "shares",
  "reposts",
  "saves",
]);

/**
 * Return a copy of `athletes` with sensitive performance metrics removed from
 * each per-platform object in `metrics`. Pure — does not mutate its input.
 */
export function stripSensitiveMetrics<T extends Pick<Athlete, "metrics">>(
  athletes: T[],
): T[] {
  return (athletes || []).map((athlete) => {
    const metrics = athlete.metrics;
    if (!metrics || typeof metrics !== "object") return athlete;

    const cleanedMetrics: AthleteMetrics = { ...metrics };
    let changed = false;

    for (const platformKey of PLATFORM_KEYS) {
      const block = cleanedMetrics[platformKey];
      if (!block || typeof block !== "object") continue;

      const cleanedBlock: Record<string, unknown> = { ...block };
      let blockChanged = false;
      for (const key of Object.keys(cleanedBlock)) {
        if (SENSITIVE_KEYS.has(key)) {
          delete cleanedBlock[key];
          blockChanged = true;
        }
      }
      if (blockChanged) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cleanedMetrics as any)[platformKey] = cleanedBlock;
        changed = true;
      }
    }

    if (!changed) return athlete;
    return { ...athlete, metrics: cleanedMetrics };
  });
}
