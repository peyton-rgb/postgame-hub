// Campaign totals derived from what the athletes actually posted.
//
// Used when a recap's kpi_targets was never filled in — true for seven of the
// eight backfilled CVS campaigns, whose trackers turned out to be rosters with
// no metrics in them. Rather than show an empty Results tab, the same numbers
// are summed from athletes.metrics, which IS populated.
//
// Summed in SQL (view portal_campaign_post_metrics) rather than here: a brand
// with 2,096 athlete rows would otherwise total the first 1,000 PostgREST
// returns and silently under-report.

import { compact } from "@/lib/portal/format";

/** Row shape of public.portal_campaign_post_metrics. */
export interface PostMetricsRow {
  posts: number | null;
  reel_views: number | string | null;
  reel_views_athletes: number | null;
  feed_impressions: number | string | null;
  feed_impressions_athletes: number | null;
  story_impressions: number | string | null;
  story_impressions_athletes: number | null;
  followers: number | string | null;
  followers_athletes: number | null;
}

export interface Figure {
  label: string;
  value: string;
}

/** The columns the view returns as numeric come back as strings over PostgREST. */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build display figures from the view's row.
 *
 * A FIGURE APPEARS ONLY IF AT LEAST ONE ATHLETE REPORTED IT. That is what the
 * paired *_athletes counts are for: a sum over zero contributors is 0, which
 * on screen is indistinguishable from a campaign that genuinely got zero
 * views. Holiday is the case in point — 63 posts and 604,751 followers, and
 * nobody reported a single reel view, so it shows those two and no view count
 * rather than a row of zeroes.
 */
export function figuresFromPostMetrics(m: PostMetricsRow | null | undefined, max = 4): Figure[] {
  if (!m) return [];
  const out: Figure[] = [];

  const posts = num(m.posts);
  if (posts !== null && posts > 0) out.push({ label: "Posts", value: compact(posts) });

  const add = (
    value: number | string | null,
    contributors: number | null,
    label: string
  ) => {
    const n = num(value);
    if (n === null || (contributors ?? 0) < 1) return;
    out.push({ label, value: compact(n) });
  };

  add(m.reel_views, m.reel_views_athletes, "Reel views");
  add(m.feed_impressions, m.feed_impressions_athletes, "Feed impressions");
  add(m.story_impressions, m.story_impressions_athletes, "Story impressions");
  add(m.followers, m.followers_athletes, "Combined followers");

  return out.slice(0, max);
}

/** Shown beside derived figures so nobody reads them as agency-set targets. */
export const POST_METRICS_SOURCE = "From post metrics";

export const POST_METRICS_SELECT =
  "campaign_id, posts, reel_views, reel_views_athletes, feed_impressions, " +
  "feed_impressions_athletes, story_impressions, story_impressions_athletes, " +
  "followers, followers_athletes";
