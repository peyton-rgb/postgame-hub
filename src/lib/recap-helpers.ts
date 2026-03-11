import type { Athlete, Media } from "@/lib/types";

export function fmt(n: number | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export function pct(n: number | undefined): string {
  if (n == null) return "0%";
  return n.toFixed(2) + "%";
}

export function computeStats(athletes: Athlete[]) {
  const schools = new Set(athletes.map((a) => a.school));
  const sports = new Set(athletes.map((a) => a.sport));

  let totalPosts = 0;
  let totalImpressions = 0;
  let totalEngagements = 0;
  let totalEngRateSum = 0;
  let engRateCount = 0;
  let igFeedPosts = 0;
  let igReelPosts = 0;
  let tiktokPosts = 0;
  let totalReach = 0;

  const igFeed = { reach: 0, impressions: 0, likes: 0, comments: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };
  const igStory = { count: 0, impressions: 0 };
  const igReel = { views: 0, likes: 0, comments: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };
  const tiktok = { views: 0, likes_comments: 0, saves_shares: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };

  for (const a of athletes) {
    const m = a.metrics || {};
    if (m.ig_feed?.post_url) { igFeedPosts++; totalPosts++; }
    if (m.ig_reel?.post_url) { igReelPosts++; totalPosts++; }
    if (m.tiktok?.post_url) { tiktokPosts++; totalPosts++; }

    totalImpressions += (m.ig_feed?.impressions || 0) + (m.ig_story?.impressions || 0) + (m.ig_reel?.views || 0) + (m.tiktok?.views || 0);
    totalEngagements += (m.ig_feed?.total_engagements || 0) + (m.ig_reel?.total_engagements || 0) + (m.tiktok?.total_engagements || 0);
    totalReach += (m.ig_feed?.reach || 0) + (a.ig_followers || 0);

    igFeed.reach += m.ig_feed?.reach || 0;
    igFeed.impressions += m.ig_feed?.impressions || 0;
    igFeed.likes += m.ig_feed?.likes || 0;
    igFeed.comments += m.ig_feed?.comments || 0;
    igFeed.engagements += m.ig_feed?.total_engagements || 0;
    if (m.ig_feed?.engagement_rate != null && m.ig_feed.engagement_rate > 0) { igFeed.engRateSum += m.ig_feed.engagement_rate; igFeed.engRateCount++; }

    igStory.count += m.ig_story?.count || 0;
    igStory.impressions += m.ig_story?.impressions || 0;

    igReel.views += m.ig_reel?.views || 0;
    igReel.likes += m.ig_reel?.likes || 0;
    igReel.comments += m.ig_reel?.comments || 0;
    igReel.engagements += m.ig_reel?.total_engagements || 0;
    if (m.ig_reel?.engagement_rate != null && m.ig_reel.engagement_rate > 0) { igReel.engRateSum += m.ig_reel.engagement_rate; igReel.engRateCount++; }

    tiktok.views += m.tiktok?.views || 0;
    tiktok.likes_comments += m.tiktok?.likes_comments || 0;
    tiktok.saves_shares += m.tiktok?.saves_shares || 0;
    tiktok.engagements += m.tiktok?.total_engagements || 0;
    if (m.tiktok?.engagement_rate != null && m.tiktok.engagement_rate > 0) { tiktok.engRateSum += m.tiktok.engagement_rate; tiktok.engRateCount++; }

    const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
    if (rates.length > 0) {
      totalEngRateSum += rates.reduce((s, r) => s + r, 0) / rates.length;
      engRateCount++;
    }
  }

  const avgEngRate = engRateCount > 0 ? totalEngRateSum / engRateCount : 0;

  return {
    athleteCount: athletes.length, schoolCount: schools.size, sportCount: sports.size,
    totalPosts, totalImpressions, totalEngagements, avgEngRate,
    igFeedPosts, igReelPosts, tiktokPosts, totalReach,
    igFeed, igStory, igReel, tiktok,
  };
}

export function getTopPerformers(athletes: Athlete[], count = 5) {
  return [...athletes]
    .map((a) => {
      const m = a.metrics || {};
      const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
      const best = rates.length > 0 ? Math.max(...rates) : 0;
      return { ...a, bestEngRate: best };
    })
    .filter((a) => a.bestEngRate > 0)
    .sort((a, b) => b.bestEngRate - a.bestEngRate)
    .slice(0, count);
}

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
  const m = athlete.metrics || {};
  const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
  return rates.length > 0 ? Math.max(...rates) : 0;
}

export function getTotalImpressions(athlete: Athlete): number {
  const m = athlete.metrics || {};
  return (m.ig_feed?.impressions || 0) + (m.ig_story?.impressions || 0) + (m.ig_reel?.views || 0) + (m.tiktok?.views || 0);
}

export function getTotalEngagements(athlete: Athlete): number {
  const m = athlete.metrics || {};
  return (m.ig_feed?.total_engagements || 0) + (m.ig_reel?.total_engagements || 0) + (m.tiktok?.total_engagements || 0);
}
