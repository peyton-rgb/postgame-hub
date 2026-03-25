import type { Athlete, Media } from "@/lib/types";

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

  const igFeed = { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, reposts: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };
  const igStory = { count: 0, impressions: 0 };
  const igReel = { views: 0, likes: 0, comments: 0, shares: 0, reposts: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };
  const tiktok = { views: 0, likes: 0, comments: 0, likes_comments: 0, saves_shares: 0, engagements: 0, engRateSum: 0, engRateCount: 0 };
  const clicks = { link_clicks: 0, click_through_rate_sum: 0, click_through_rate_count: 0, landing_page_views: 0, cost_per_click_sum: 0, cost_per_click_count: 0, orders: 0, salesAmount: 0, cpm_sum: 0, cpm_count: 0 };
  const sales = { conversions: 0, revenue: 0, conversion_rate_sum: 0, conversion_rate_count: 0, cost_per_acquisition_sum: 0, cost_per_acquisition_count: 0, roas_sum: 0, roas_count: 0 };
  let hasClicks = false;
  let hasSales = false;

  for (const a of athletes) {
    const m = a.metrics || {};
    if (m.ig_feed?.post_url) { igFeedPosts++; totalPosts++; }
    if (m.ig_reel?.post_url) { igReelPosts++; totalPosts++; }
    if (m.tiktok?.post_url) { tiktokPosts++; totalPosts++; }
    if (m.ig_story?.count) { totalPosts += m.ig_story.count; }

    totalImpressions += (m.ig_feed?.impressions || 0) + (m.ig_story?.impressions || 0);
    totalEngagements += (m.ig_feed?.total_engagements || 0) + (m.ig_reel?.total_engagements || 0) + (m.tiktok?.total_engagements || 0);
    totalReach += (m.ig_feed?.reach || 0) + (a.ig_followers || 0);

    igFeed.reach += m.ig_feed?.reach || 0;
    igFeed.impressions += m.ig_feed?.impressions || 0;
    igFeed.likes += m.ig_feed?.likes || 0;
    igFeed.comments += m.ig_feed?.comments || 0;
    igFeed.shares += m.ig_feed?.shares || 0;
    igFeed.reposts += m.ig_feed?.reposts || 0;
    igFeed.engagements += m.ig_feed?.total_engagements || 0;
    if (m.ig_feed?.engagement_rate != null && m.ig_feed.engagement_rate > 0) { igFeed.engRateSum += m.ig_feed.engagement_rate; igFeed.engRateCount++; }

    igStory.count += m.ig_story?.count || 0;
    igStory.impressions += m.ig_story?.impressions || 0;

    igReel.views += m.ig_reel?.views || 0;
    igReel.likes += m.ig_reel?.likes || 0;
    igReel.comments += m.ig_reel?.comments || 0;
    igReel.shares += m.ig_reel?.shares || 0;
    igReel.reposts += m.ig_reel?.reposts || 0;
    igReel.engagements += m.ig_reel?.total_engagements || 0;
    if (m.ig_reel?.engagement_rate != null && m.ig_reel.engagement_rate > 0) { igReel.engRateSum += m.ig_reel.engagement_rate; igReel.engRateCount++; }

    tiktok.views += m.tiktok?.views || 0;
    tiktok.likes += m.tiktok?.likes || 0;
    tiktok.comments += m.tiktok?.comments || 0;
    tiktok.likes_comments += m.tiktok?.likes_comments || 0;
    tiktok.saves_shares += m.tiktok?.saves_shares || 0;
    tiktok.engagements += m.tiktok?.total_engagements || 0;
    if (m.tiktok?.engagement_rate != null && m.tiktok.engagement_rate > 0) { tiktok.engRateSum += m.tiktok.engagement_rate; tiktok.engRateCount++; }

    const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
    if (rates.length > 0) {
      totalEngRateSum += rates.reduce((s, r) => s + r, 0) / rates.length;
      engRateCount++;
    }

    // Clicks
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

    // Sales
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

  const avgEngRate = engRateCount > 0 ? totalEngRateSum / engRateCount : 0;

  return {
    athleteCount: athletes.length, schoolCount: schools.size, sportCount: sports.size,
    totalPosts, totalImpressions, totalEngagements, avgEngRate,
    igFeedPosts, igReelPosts, tiktokPosts, totalReach,
    igFeed, igStory, igReel, tiktok,
    clicks, hasClicks, sales, hasSales,
  };
}

export function getTopPerformers(athletes: Athlete[], count = 5) {
  return [...athletes]
    .map((a) => {
      const m = a.metrics || {};
      const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
      const best = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
      return { ...a, bestEngRate: best, totalImpressions: getTotalImpressions(a) };
    })
    .filter((a) => a.bestEngRate > 0)
    .sort((a, b) => b.bestEngRate - a.bestEngRate)
    .slice(0, count);
}

export function getTopPerformersByImpressions(athletes: Athlete[], count = 5) {
  return [...athletes]
    .map((a) => {
      const m = a.metrics || {};
      const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
      const best = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
      const total = getTotalImpressions(a);
      return { ...a, bestEngRate: best, totalImpressions: total };
    })
    .filter((a) => a.totalImpressions > 0)
    .sort((a, b) => b.totalImpressions - a.totalImpressions)
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
  return rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
}

export function getTotalImpressions(athlete: Athlete): number {
  const m = athlete.metrics || {};
  return (m.ig_feed?.impressions || 0) + (m.ig_story?.impressions || 0);
}

export function getTotalEngagements(athlete: Athlete): number {
  const m = athlete.metrics || {};
  return (m.ig_feed?.total_engagements || 0) + (m.ig_reel?.total_engagements || 0) + (m.tiktok?.total_engagements || 0);
}
