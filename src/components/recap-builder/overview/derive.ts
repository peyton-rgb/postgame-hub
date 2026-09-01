// ============================================================
// Recap Builder — Overview figures
//
// The prototype hard-coded Ghost Amp's numbers. Here the same
// tiles and platform boxes are computed from the roster, so the
// Overview step reads live data — but the SHAPE of each figure
// (key, label, caption, ordering, units) is the prototype's and
// is not re-derived.
//
// Compact formatting matches the prototype's own strings
// (466.7K, 348.8K, 35.9K), which is the same rule the recap
// editor uses: >=1M -> M, >=1000 -> K, one decimal, .0 trimmed.
// ============================================================

import {
  athleteImpressions,
  campaignTotals,
  feedEng,
  reelEng,
  ttEng,
  type BuilderAthlete,
} from '../athletes/metrics';

export type MetricTile = {
  k: string;
  /** Display value, already formatted — the zero rule tests this string. */
  v: string;
  l: string;
  c: string;
  on: boolean;
};

export type PlatformBox = {
  k: 'feed' | 'reels' | 'story' | 'tt';
  t: string;
  on: boolean;
  hero: [string, string];
  er: string | null;
  /** [label, display value, row visible] — the prototype's tuple shape. */
  rows: [string, string, boolean][];
};

export function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

const rate = (num: number, den: number): string => (den ? Math.round((num / den) * 100) + '%' : '0%');

/** Campaign metric tiles, in the prototype's order. */
export function deriveMetrics(rows: BuilderAthlete[], hidden: string[]): MetricTile[] {
  const T = campaignTotals(rows);
  const colleges = new Set(rows.map((a) => a.school).filter(Boolean)).size;
  const sports = new Set(rows.map((a) => a.sport).filter(Boolean)).size;
  const impressions = rows.reduce((s, a) => s + athleteImpressions(a), 0);
  const engagements = T.feed.eng + T.reel.eng + T.tt.eng;

  const posts =
    rows.filter((a) => a.metrics?.ig_feed?.post_url).length +
    rows.filter((a) => a.metrics?.ig_reel?.post_url).length +
    T.story.count +
    rows.filter((a) => a.metrics?.tiktok?.post_url).length;

  const sportList = Array.from(new Set(rows.map((a) => a.sport).filter(Boolean))).slice(0, 3);

  const tiles: Omit<MetricTile, 'on'>[] = [
    { k: 'athletes', v: String(rows.length), l: 'Athletes', c: `Across ${colleges} colleges` },
    { k: 'colleges', v: String(colleges), l: 'Colleges', c: 'On the roster' },
    { k: 'sports', v: String(sports), l: 'Sports', c: sportList.join(' · ') + (sports > 3 ? ' +' : '') },
    { k: 'posts', v: String(posts), l: 'Total posts', c: 'Feed · Reels · Stories' },
    { k: 'followers', v: compact(T.followers), l: 'Total followers', c: 'Combined roster reach' },
    { k: 'impr', v: compact(impressions), l: 'Total impressions', c: 'All platforms' },
    { k: 'eng', v: compact(engagements), l: 'Total engagements', c: 'Likes · comments · shares' },
    {
      k: 'igrate',
      v: rate(T.feed.eng, T.followers),
      l: 'IG avg eng rate',
      c: 'Against combined followers',
    },
    { k: 'ttrate', v: rate(T.tt.eng, T.tt.views), l: 'TikTok avg eng rate', c: 'Vs views' },
    { k: 'clicks', v: '0', l: 'Clicks', c: '' },
    { k: 'orders', v: '0', l: 'Orders', c: '' },
    { k: 'sales', v: '$0', l: 'Sales', c: '' },
  ];

  return tiles.map((t) => ({ ...t, on: !hidden.includes(t.k) }));
}

/** Platform breakdown boxes, in the prototype's order. */
export function derivePlatforms(rows: BuilderAthlete[], hidden: string[]): PlatformBox[] {
  const T = campaignTotals(rows);
  const feedPosts = rows.filter((a) => a.metrics?.ig_feed?.post_url).length;
  const reelPosts = rows.filter((a) => a.metrics?.ig_reel?.post_url).length;
  const ttPosts = rows.filter((a) => a.metrics?.tiktok?.post_url).length;

  // Feed carries no impressions field in this data; the prototype shows the
  // row at 0 so the zero rule can hide it, rather than omitting the row.
  const feedImpressions = 0;

  const boxes: Omit<PlatformBox, 'on'>[] = [
    {
      k: 'feed',
      t: 'IG Feed',
      hero: [compact(T.feed.eng), 'Engagements'],
      er: rate(T.feed.eng, T.followers),
      rows: [
        ['Total posts', String(feedPosts), true],
        ['Impressions', String(feedImpressions), true],
        ['Likes', compact(T.feed.likes), true],
        ['Total engagements', compact(T.feed.eng), true],
      ],
    },
    {
      k: 'reels',
      t: 'IG Reels',
      hero: [compact(T.reel.views), 'Reel views'],
      er: rate(T.reel.eng, T.reel.views),
      rows: [
        ['Total posts', String(reelPosts), true],
        ['Views', compact(T.reel.views), true],
        ['Likes', compact(T.reel.likes), true],
        ['Total engagements', compact(T.reel.eng), true],
      ],
    },
    {
      k: 'story',
      t: 'IG Stories',
      hero: [compact(T.story.impressions), 'Story impressions'],
      er: null,
      rows: [
        ['Story count', String(T.story.count), true],
        ['Total impressions', compact(T.story.impressions), true],
      ],
    },
    {
      k: 'tt',
      t: 'TikTok',
      hero: [compact(T.tt.views), 'Views'],
      er: rate(T.tt.eng, T.tt.views),
      rows: [
        ['Total posts', String(ttPosts), true],
        ['Views', compact(T.tt.views), true],
        ['Likes', compact(T.tt.likes), true],
        ['Total engagements', compact(T.tt.eng), true],
      ],
    },
  ];

  return boxes.map((b) => ({ ...b, on: !hidden.includes(b.k) }));
}

/** Donut shares, keyed to the platform boxes. */
export function deriveShares(rows: BuilderAthlete[]): Record<PlatformBox['k'], number> {
  const T = campaignTotals(rows);
  return { feed: 0, reels: T.reel.views, story: T.story.impressions, tt: T.tt.views };
}

export { feedEng, reelEng, ttEng };
