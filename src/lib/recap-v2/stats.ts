// ============================================================
// Recap v2 — engagement rate
//
// Every rate figure on the v2 page is engagements ÷ impressions, and is
// labelled as such. Nothing here calls bestRateForPlatform.
//
// The volume figures (impressions, engagements, post counts) are NOT affected
// by the rate definition, and computeStats already gets them right — it
// deduplicates collab posts so a reel shared by five athletes is counted once,
// folds Post-2 slots in, and applies the campaign's metric overrides. So this
// module reuses computeStats for volume and redefines only the ratio. That is
// why recap-helpers.ts is not modified beyond adding the new helper: the
// Math.max sites at :246/:282/:316 feed avgEngRate, which v2 simply does not
// read. See issue #221 for migrating them and their other six consumers.
// ============================================================

import {
  computeStatsWithOverrides,
  engagementRateByImpressions,
  type AppliedStats,
} from "@/lib/recap-helpers";
import { PLATFORMS, type PlatformId } from "./guards";
import type { Athlete, Campaign, CollabGroup } from "@/lib/types";

/** Human-readable, and the same everywhere the number is shown. */
export const RATE_LABEL = "engagements ÷ impressions";

export type DonutSlice = PlatformId | "ig_story";

export interface PlatformRate {
  platform: DonutSlice;
  impressions: number;
  engagements: number;
  /**
   * Percentage, or null when the surface cannot have one. Stories carry
   * impressions but the schema records no engagements against them, so they
   * get a share of the donut and no rate — rather than a misleading 0%.
   */
  rate: number | null;
  /** Share of TOTAL impressions (stories included), as a percentage. */
  share: number;
}

export interface AthleteRate {
  athleteId: string;
  impressions: number;
  engagements: number;
  rate: number;
}

export interface RecapV2Stats {
  /** Everything volume-related, straight from the shared helper. */
  volume: AppliedStats;
  /**
   * Impressions that could have produced an engagement. Stories are excluded:
   * they carry impressions but the schema records no engagements against them,
   * so leaving them in the denominator would depress every campaign's rate in
   * proportion to how much story inventory it ran. computeStats'
   * totalImpressions DOES include them, and stays the headline reach figure.
   */
  ratedImpressions: number;
  totalEngagements: number;
  /** Campaign-level engagements ÷ impressions, as a percentage. */
  engagementRate: number;
  /**
   * Donut/legend slices: every surface with impressions, stories included, in
   * legend order. Shares are of totalImpressions so the ring sums to the
   * "Total impressions" figure printed in its middle.
   */
  platforms: PlatformRate[];
  /** Per-athlete, for the performer cards and the roster table. */
  byAthlete: Map<string, AthleteRate>;
}

/**
 * One decimal, and no floor.
 *
 * NOT formatEngagementRate() from recap-helpers, deliberately. That one rounds
 * to whole percent and lifts anything under 1% up to "1%", so a genuine 0.22%
 * prints as "1%" — a 4.5x overstatement. That was defensible while rates were
 * follower-based and typically 5-15%; impressions-based rates are routinely
 * well under 1%, so the floor would misreport a large share of the catalogue.
 * A true zero still prints "0%".
 */
export function formatRate(n: number | undefined): string {
  if (n == null || n <= 0) return "0%";
  return `${n.toFixed(1)}%`;
}

/** The two slots each platform occupies, and which field is the denominator. */
const SLOTS: Record<PlatformId, { keys: string[]; denom: "impressions" | "views" }> = {
  ig_reel: { keys: ["ig_reel", "ig_reel_2"], denom: "views" },
  ig_feed: { keys: ["ig_feed", "ig_feed_2"], denom: "impressions" },
  tiktok: { keys: ["tiktok", "tiktok_2"], denom: "views" },
};

/**
 * One athlete's rate, summed across every slot they posted in.
 *
 * Weighted, not an average of per-post rates: a post with 12 impressions
 * should not carry the same weight as one with 1.2M. Post 1 and Post 2 are
 * summed into the same numerator and denominator, which is what makes a card
 * impossible to render half on one definition and half on the other.
 */
export function athleteRate(athlete: Athlete): AthleteRate {
  const m = (athlete.metrics || {}) as Record<string, any>;
  let impressions = 0;
  let engagements = 0;
  for (const p of PLATFORMS) {
    const { keys, denom } = SLOTS[p];
    for (const k of keys) {
      const block = m[k];
      if (!block) continue;
      const d = denom === "impressions" ? block.impressions : block.views;
      if (d != null && d > 0) {
        impressions += d;
        engagements += block.total_engagements || 0;
      }
    }
  }
  return {
    athleteId: athlete.id,
    impressions,
    engagements,
    rate: impressions > 0 ? (engagements / impressions) * 100 : 0,
  };
}

export function computeRecapV2Stats(
  athletes: Athlete[],
  campaign: Campaign,
  collabGroups: CollabGroup[] = [],
): RecapV2Stats {
  const volume = computeStatsWithOverrides(athletes, campaign, collabGroups);

  // Rated impressions exclude stories — see the field comment above.
  const ratedImpressions = Math.max(0, volume.totalImpressions - volume.igStory.impressions);
  const totalEngagements = volume.totalEngagements;

  const raw: Record<PlatformId, { impressions: number; engagements: number }> = {
    ig_reel: { impressions: volume.igReel.views, engagements: volume.igReel.engagements },
    ig_feed: { impressions: volume.igFeed.impressions, engagements: volume.igFeed.engagements },
    tiktok: { impressions: volume.tiktok.views, engagements: volume.tiktok.engagements },
  };

  const totalImpressions = volume.totalImpressions;
  const share = (n: number) => (totalImpressions > 0 ? (n / totalImpressions) * 100 : 0);

  const platforms: PlatformRate[] = PLATFORMS.filter((p) => raw[p].impressions > 0).map((p) => {
    const { impressions, engagements } = raw[p];
    return {
      platform: p as DonutSlice,
      impressions,
      engagements,
      rate: (engagements / impressions) * 100,
      share: share(impressions),
    };
  });
  // Stories last: they are the only slice with no rate, so they read as the
  // exception rather than interrupting the three that do have one.
  if (volume.igStory.impressions > 0) {
    platforms.push({
      platform: "ig_story",
      impressions: volume.igStory.impressions,
      engagements: 0,
      rate: null,
      share: share(volume.igStory.impressions),
    });
  }

  const byAthlete = new Map<string, AthleteRate>();
  for (const a of athletes) byAthlete.set(a.id, athleteRate(a));

  return {
    volume,
    ratedImpressions,
    totalEngagements,
    engagementRate: ratedImpressions > 0 ? (totalEngagements / ratedImpressions) * 100 : 0,
    platforms,
    byAthlete,
  };
}

/** Single-block rate, re-exported so sections never reach for the max-based one. */
export { engagementRateByImpressions };
