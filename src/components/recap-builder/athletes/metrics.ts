// ============================================================
// Recap Builder — athlete metrics
//
// Shapes verified against live Ghost Amp data (campaign
// ghost-amp-961, project xqaybwhpgxillpbbqtks):
//
//   ig_feed  post_url, likes, comments, reposts,
//            total_engagements, engagement_rate_followers
//   ig_reel  post_url, views, likes, comments, reposts, shares,
//            total_engagements, engagement_rate_impressions,
//            engagement_rate_followers
//   ig_story count, impressions, total_impressions
//   tiktok   post_url, views, likes, total_engagements,
//            engagement_rate_impressions
//
// The per-row calcs below are ported verbatim from
// builder-01-athletes.html — they recompute from the raw fields
// rather than trusting the stored total_engagements, exactly as
// the prototype does, so an edit updates the row immediately.
// ============================================================

export type IgFeed = {
  post_url?: string | null;
  /** Absent from this dataset; kept so the impressions formula reads whole. */
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  reposts?: number | null;
  total_engagements?: number | null;
  engagement_rate_followers?: number | null;
};

export type IgReel = {
  post_url?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  reposts?: number | null;
  shares?: number | null;
  total_engagements?: number | null;
  engagement_rate_impressions?: number | null;
  engagement_rate_followers?: number | null;
};

export type IgStory = {
  count?: number | null;
  impressions?: number | null;
  total_impressions?: number | null;
};

export type TikTok = {
  post_url?: string | null;
  followers?: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  total_engagements?: number | null;
  engagement_rate_impressions?: number | null;
};

export type AthleteMetrics = {
  ig_feed?: IgFeed;
  ig_reel?: IgReel;
  ig_story?: IgStory;
  tiktok?: TikTok;
};

export type BuilderAthlete = {
  id: string;
  name: string | null;
  ig_handle: string | null;
  ig_followers: number | null;
  school: string | null;
  sport: string | null;
  metrics: AthleteMetrics | null;
  /** Files staged for this athlete, from the campaign media join. */
  fileCount: number;
  videoCount: number;
};

const n = (v: number | null | undefined): number => v ?? 0;

/* per-row auto calcs — verbatim from the prototype */
export const feedEng = (a: BuilderAthlete): number =>
  n(a.metrics?.ig_feed?.likes) + n(a.metrics?.ig_feed?.comments) + n(a.metrics?.ig_feed?.reposts);

// Reel engagements: likes + comments + reposts + shares.
//
// builder-01 computes this as likes + comments only. That is a bug in the
// prototype, not a design choice: the stored ig_reel.total_engagements
// includes reposts, and so do the handoff's recorded top fives (Lauren Lewis
// 758, not 753). The DB definition is canonical, so every surface — this
// grid, the Overview platform breakdown, and the Performers ranking — uses
// the formula below. performers/ranking.ts re-exports it rather than
// keeping a second copy.
export const reelEng = (a: BuilderAthlete): number =>
  n(a.metrics?.ig_reel?.likes) +
  n(a.metrics?.ig_reel?.comments) +
  n(a.metrics?.ig_reel?.reposts) +
  n(a.metrics?.ig_reel?.shares);

export const ttEng = (a: BuilderAthlete): number | null =>
  a.metrics?.tiktok ? n(a.metrics.tiktok.likes) + n(a.metrics.tiktok.comments) : null;

export const feedRate = (a: BuilderAthlete): number | null =>
  a.ig_followers ? (feedEng(a) / a.ig_followers) * 100 : null;

export const reelRate = (a: BuilderAthlete): number | null => {
  const views = a.metrics?.ig_reel?.views;
  return views ? (reelEng(a) / views) * 100 : null;
};

export const ttRate = (a: BuilderAthlete): number | null => {
  const views = a.metrics?.tiktok?.views;
  const eng = ttEng(a);
  return views && eng != null ? (eng / views) * 100 : null;
};

/**
 * Campaign impressions, per the handoff:
 *   feed impressions + story total_impressions + reel views + tiktok views
 * Feed carries no impressions field in this data, so it contributes 0 —
 * kept in the sum so the formula stays readable against the spec.
 */
export const athleteImpressions = (a: BuilderAthlete): number =>
  n(a.metrics?.ig_story?.total_impressions) + n(a.metrics?.ig_reel?.views) + n(a.metrics?.tiktok?.views);

export const fmt = (v: number | null | undefined): string =>
  v == null ? '' : v.toLocaleString('en-US');

export const pct = (v: number | null): string | null => (v == null ? null : v.toFixed(2) + '%');

/** Campaign-wide totals across every athlete, for the Σ row and tab headers. */
export function campaignTotals(rows: BuilderAthlete[]) {
  const sum = (f: (a: BuilderAthlete) => number) => rows.reduce((t, a) => t + f(a), 0);
  return {
    followers: sum((a) => n(a.ig_followers)),
    feed: {
      likes: sum((a) => n(a.metrics?.ig_feed?.likes)),
      comments: sum((a) => n(a.metrics?.ig_feed?.comments)),
      reposts: sum((a) => n(a.metrics?.ig_feed?.reposts)),
      eng: sum(feedEng),
    },
    story: {
      count: sum((a) => n(a.metrics?.ig_story?.count)),
      impressions: sum((a) => n(a.metrics?.ig_story?.total_impressions)),
    },
    reel: {
      views: sum((a) => n(a.metrics?.ig_reel?.views)),
      likes: sum((a) => n(a.metrics?.ig_reel?.likes)),
      comments: sum((a) => n(a.metrics?.ig_reel?.comments)),
      reposts: sum((a) => n(a.metrics?.ig_reel?.reposts)),
      shares: sum((a) => n(a.metrics?.ig_reel?.shares)),
      eng: sum(reelEng),
    },
    tt: {
      views: sum((a) => n(a.metrics?.tiktok?.views)),
      likes: sum((a) => n(a.metrics?.tiktok?.likes)),
      eng: sum((a) => ttEng(a) ?? 0),
    },
    files: sum((a) => a.fileCount),
  };
}
