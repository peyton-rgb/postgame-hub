// ============================================================
// Recap v2 — section guards
//
// Of 82 published campaigns only 37 carry all three surfaces. Most do not:
// 30 have no athlete metrics at all, 35 no feed, 32 no reels, 50 no key
// takeaways, 15 no description. The v2 design was drawn against Wendy's
// (dunks-march-madness-mng452ct), which is one of the complete ones — so every
// section below has to be able to not exist without leaving a hole behind it.
//
// The rule this file encodes: a section renders only when BOTH the editor has
// left it on (settings.visible_sections, the existing toggle the dashboard
// already writes) AND there is data to put in it. Presence is computed once,
// here, and the nav is built from the same list — so the nav can never link to
// a section that didn't render.
// ============================================================

import { athletePostedOn } from "@/lib/recap-helpers";
import type { Athlete, Campaign, CollabGroup, Media, VisibleSections } from "@/lib/types";

/** Section ids, in render order. These double as the anchor hrefs. */
export type SectionId =
  | "overview"
  | "take"
  | "numbers"
  | "perf"
  | "bic"
  | "roster";

/**
 * Mirrors hasRichTextContent in CampaignRecap.tsx. Duplicated rather than
 * imported because that module is a client component and this one is imported
 * by the server render; the behaviour must stay identical, so change both.
 */
export function hasRichText(html: string | null | undefined): boolean {
  if (!html) return false;
  if (/<(img|iframe)\b/i.test(html)) return true;
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .trim().length > 0
  );
}

/** Platforms, in the order the legend lists them. */
export const PLATFORMS = ["ig_reel", "ig_feed", "tiktok"] as const;
export type PlatformId = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<PlatformId, string> = {
  ig_reel: "IG Reels",
  ig_feed: "IG Feed",
  tiktok: "TikTok",
};

/**
 * How many athletes posted on each platform, by the app's own definition.
 *
 * athletePostedOn is deliberately reused rather than reimplemented: its test is
 * per-platform and NOT uniform — ig_feed keys on `impressions`, while ig_reel
 * and tiktok key on `views`. Any local restatement of it drifts.
 */
export function platformCounts(athletes: Athlete[]): Record<PlatformId, number> {
  const out: Record<PlatformId, number> = { ig_reel: 0, ig_feed: 0, tiktok: 0 };
  for (const a of athletes) {
    for (const p of PLATFORMS) {
      if (athletePostedOn(a.metrics, p)) out[p] += 1;
    }
  }
  return out;
}

/** Athletes who posted on at least one platform. */
export function athletesWithMetrics(athletes: Athlete[]): Athlete[] {
  return athletes.filter((a) => PLATFORMS.some((p) => athletePostedOn(a.metrics, p)));
}

/** Real gallery items — video thumbnails are plumbing, not photography. */
export function galleryItems(media: Record<string, Media[]>): Media[] {
  const seen = new Set<string>();
  const out: Media[] = [];
  for (const items of Object.values(media || {})) {
    for (const m of items || []) {
      // A collab item is fanned out under several keys; count it once.
      if (m.is_video_thumbnail || seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

export interface RecapV2Data {
  campaign: Campaign;
  allAthletes: Athlete[];
  galleryAthletes: Athlete[];
  media: Record<string, Media[]>;
  collabGroups: CollabGroup[];
}

export interface SectionPresence {
  /** Sections that will actually render, in order. Drives the nav. */
  sections: SectionId[];
  has: Record<SectionId, boolean>;
  /** Counts the shells report, so the scaffold is inspectable without design. */
  counts: {
    athletes: number;
    withMetrics: number;
    gallery: number;
    collabs: number;
    platforms: Record<PlatformId, number>;
    platformsPresent: PlatformId[];
  };
}

const SECTION_TOGGLE: Record<SectionId, keyof VisibleSections> = {
  overview: "brief",
  take: "key_takeaways",
  numbers: "metrics",
  perf: "top_performers",
  bic: "content_gallery",
  roster: "roster",
};

export const SECTION_LABEL: Record<SectionId, string> = {
  overview: "Overview",
  take: "Takeaways",
  numbers: "Numbers",
  perf: "Performers",
  bic: "Content",
  roster: "Roster",
};

export const SECTION_HEADING: Record<SectionId, { kicker: string; title: string }> = {
  overview: { kicker: "Campaign overview", title: "What we ran" },
  take: { kicker: "Key takeaways", title: "" },
  numbers: { kicker: "Campaign performance", title: "The numbers" },
  perf: { kicker: "Top performers", title: "Who carried it" },
  bic: { kicker: "Best in class", title: "The content" },
  roster: { kicker: "Campaign roster", title: "Every athlete. Every number." },
};

export function computePresence(data: RecapV2Data): SectionPresence {
  const { campaign, allAthletes, media, collabGroups } = data;
  const settings = campaign.settings || {};
  const vis: VisibleSections = settings.visible_sections || {};
  // Matches CampaignRecap: absent means visible, only an explicit false hides.
  const on = (id: SectionId) => vis[SECTION_TOGGLE[id]] !== false;

  const withMetrics = athletesWithMetrics(allAthletes);
  const platforms = platformCounts(allAthletes);
  const platformsPresent = PLATFORMS.filter((p) => platforms[p] > 0);
  const gallery = galleryItems(media);

  // The spec table drops any row whose value is missing, so the section needs
  // at least one row OR the prose to be worth rendering at all.
  const hasSpecRows = specRows(campaign).length > 0;

  const has: Record<SectionId, boolean> = {
    overview: on("overview") && (hasRichText(settings.description) || hasSpecRows),
    take: on("take") && hasRichText(settings.key_takeaways),
    // 30 of 82 campaigns land here with nothing. No metrics, no section —
    // which also removes the donut, the legend and the (omitted) map with it.
    numbers: on("numbers") && withMetrics.length > 0,
    perf: on("perf") && withMetrics.length > 0,
    bic: on("bic") && gallery.length > 0,
    // The roster table stands on the athlete list alone; it does not need
    // metrics, and it is the only section a zero-metric campaign still shows.
    roster: on("roster") && allAthletes.length > 0,
  };

  const order: SectionId[] = ["overview", "take", "numbers", "perf", "bic", "roster"];

  return {
    sections: order.filter((id) => has[id]),
    has,
    counts: {
      athletes: allAthletes.length,
      withMetrics: withMetrics.length,
      gallery: gallery.length,
      collabs: (collabGroups || []).length,
      platforms,
      platformsPresent,
    },
  };
}

export interface SpecRow {
  key: string;
  label: string;
  value: string;
}

/**
 * The #overview spec table. Every row is individually guarded — a campaign with
 * only a name yields one row, not seven blanks.
 */
export function specRows(campaign: Campaign): SpecRow[] {
  const s = campaign.settings || {};
  const raw: Array<[string, string, unknown]> = [
    ["name", "Campaign name", campaign.name],
    ["client", "Client", campaign.client_name],
    ["type", "Campaign type", s.campaign_type],
  ];
  return raw
    .filter(([, , v]) => typeof v === "string" && v.trim().length > 0)
    .map(([key, label, v]) => ({ key, label, value: String(v).trim() }));
}
