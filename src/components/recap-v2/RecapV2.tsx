// ============================================================
// Recap v2
//
// Presence is decided once, in lib/recap-v2/guards.ts, and the nav is built
// from the same list — a section and its anchor cannot disagree. Every rate
// figure comes from lib/recap-v2/stats.ts, which is engagements ÷ impressions
// throughout; nothing here reads computeStats' max-based avgEngRate.
//
// This component is a server component. The three pieces that need a client
// (hero carousel, performers toggle, roster sort) are their own islands, so a
// campaign that lacks the section never ships the JavaScript for it.
// ============================================================

import { anton, arimo } from "./fonts";
import "./recap-v2.css";

import {
  athletesWithMetrics,
  computePresence,
  galleryItems,
  type RecapV2Data,
} from "@/lib/recap-v2/guards";
import { resolveRecapConfig, visibleSections } from "@/lib/recap-v2/resolve";
import { computeRecapV2Stats } from "@/lib/recap-v2/stats";
import { selectHeroStills, stillFor } from "@/lib/recap-v2/hero";

import { ContentSection, type GalleryCard } from "./sections/ContentSection";
import { buildPortalAthlete } from "./portalAthlete";
import { HeroSection } from "./sections/HeroSection";
import type { HeroSlide } from "./sections/HeroCarousel";
import { NumbersSection } from "./sections/NumbersSection";
import { PerformersSection, type PerformerCard } from "./sections/PerformersSection";
import { RecapFooter } from "./sections/RecapFooter";
import { RecapNav } from "./sections/RecapNav";
import { RosterSection, type CollabBlock, type RosterRow } from "./sections/RosterSection";
import { TakeawaysSection } from "./sections/TakeawaysSection";

import type { Athlete, Media } from "@/lib/types";

/**
 * The still for an athlete's performer card. Ordered the same way the hero is,
 * so an explicit editor choice leads here too, and resolved through stillFor
 * so a video contributes its thumbnail rather than a .MOV an <img> cannot show.
 */
function firstImage(items: Media[] | undefined): string | null {
  return selectHeroStills(items || [], 1)[0]?.url ?? null;
}

export function RecapV2(data: RecapV2Data) {
  const { campaign, allAthletes, media, collabGroups } = data;

  // The single source of truth for what this recap shows. Where recap_config
  // holds a positive choice it wins; where it does not, `resolved` carries the
  // same derivation this page performed inline before. All 626 campaigns are
  // unconfigured today, so every value below is currently derived — which is
  // what makes "renders identically before and after" checkable.
  const resolved = resolveRecapConfig(data);
  const { counts } = computePresence(data);
  const sections = visibleSections(resolved);
  const shows = (key: (typeof sections)[number]) => sections.includes(key);

  const stats = computeRecapV2Stats(allAthletes, campaign, collabGroups);
  const gallery = galleryItems(media);

  const athleteById = new Map(allAthletes.map((a) => [a.id, a] as const));

  // ── Hero ────────────────────────────────────────────────────────────────
  // Ordered, not "the first four rows we happened to read". See
  // lib/recap-v2/hero.ts: an explicit editor selection wins outright, and
  // absent one it is is_hero, then sort_order, then created_at. Videos
  // contribute their thumbnail or are skipped — 21.8% of media rows are
  // videos, and feeding those to an <img> is why stills were disappearing.
  // Ids come from the resolver; the still each points at is resolved here,
  // because stillFor is what knows a video shows its thumbnail.
  const stillById = new Map(gallery.map((m) => [m.id, stillFor(m)] as const));
  const heroSlides: HeroSlide[] = resolved.hero.value.mediaIds.flatMap((id) => {
    const url = stillById.get(id);
    if (!url) return [];
    return [{ id, url, focal: resolved.hero.value.focal[id] }];
  });

  // ── Performers ──────────────────────────────────────────────────────────
  const withMetrics = athletesWithMetrics(allAthletes);
  const toCard = (a: Athlete): PerformerCard => {
    const r = stats.byAthlete.get(a.id);
    return {
      id: a.id,
      name: a.name,
      school: a.school || null,
      imageUrl: firstImage(media[a.id]),
      postUrl: a.metrics?.ig_reel?.post_url || a.metrics?.ig_feed?.post_url || a.post_url || null,
      engagements: r?.engagements ?? 0,
      views: (a.metrics?.ig_reel?.views ?? 0) + (a.metrics?.ig_reel_2?.views ?? 0),
      followers: a.ig_followers ?? 0,
      // null, not 0 — "no basis to state one" is not "zero engagement".
      rate: r && r.impressions > 0 ? r.rate : null,
    };
  };
  const cards = withMetrics.map(toCard);
  const cardById = new Map(cards.map((c) => [c.id, c] as const));

  let byEngagements: PerformerCard[];
  let byViews: PerformerCard[];
  if (resolved.performers.source === "configured") {
    // A chosen line-up is shown exactly as chosen. `order: "manual"` means the
    // array IS the order, so the toggle suppresses itself (byViews empty)
    // rather than re-sorting a deliberate sequence.
    const picked = resolved.performers.value.athleteIds
      .map((id) => cardById.get(id))
      .filter((c): c is PerformerCard => !!c);
    const mode = resolved.performers.value.order;
    byEngagements =
      mode === "manual" ? picked : [...picked].sort((a, b) => b.engagements - a.engagements);
    byViews =
      mode === "manual"
        ? []
        : [...picked].filter((c) => c.views > 0).sort((a, b) => b.views - a.views);
  } else {
    byEngagements = [...cards].sort((a, b) => b.engagements - a.engagements).slice(0, 5);
    // The two rankings genuinely surface different athletes, which is the whole
    // point of the toggle. Campaigns with no reels get an empty list and the
    // toggle is suppressed rather than offering an empty view.
    byViews = [...cards].filter((c) => c.views > 0).sort((a, b) => b.views - a.views).slice(0, 5);
  }

  // ── Gallery ─────────────────────────────────────────────────────────────
  // One card per ATHLETE, not per asset. media is keyed by athlete (and by
  // collab group), so walk the keys rather than trusting athlete_id, which is
  // null on team and shared-folder imports.
  // Which athlete each media row belongs to, by the key it was filed under.
  const ownerOfMedia = new Map<string, string>();
  for (const [key, items] of Object.entries(media || {})) {
    for (const m of items || []) if (!ownerOfMedia.has(m.id)) ownerOfMedia.set(m.id, key);
  }

  const itemsByAthlete = new Map<string, Media[]>();
  for (const [key, items] of Object.entries(media || {})) {
    if (!athleteById.has(key)) continue; // collab-group keys are not athletes
    const usable = (items || []).filter((m) => !m.is_video_thumbnail);
    if (usable.length > 0) itemsByAthlete.set(key, usable);
  }

  // A configured gallery is an explicit list; it selects which ATHLETES appear,
  // by way of the assets chosen for them.
  const configuredAthletes =
    resolved.content.source === "configured"
      ? new Set(
          resolved.content.value.mediaIds
            .map((id) => gallery.find((m) => m.id === id))
            .filter((m): m is Media => !!m)
            .map((m) => ownerOfMedia.get(m.id))
            .filter((a): a is string => !!a),
        )
      : null;

  const galleryCards: GalleryCard[] = [];
  for (const [athleteId, items] of Array.from(itemsByAthlete.entries())) {
    if (configuredAthletes && !configuredAthletes.has(athleteId)) continue;
    const athlete = athleteById.get(athleteId);
    if (!athlete) continue;
    // The cover is chosen the same way the hero picks its stills, so an
    // explicit editor choice leads here too and a video contributes its
    // thumbnail rather than a file an <img> cannot show.
    const cover = selectHeroStills(items, 1)[0];
    if (!cover) continue;
    const { portalAthlete, reelPostIndex } = buildPortalAthlete(athlete, items, campaign.name);
    if (portalAthlete.posts.length === 0) continue;
    galleryCards.push({
      athleteId,
      name: athlete.name,
      school: athlete.school || null,
      handle: athlete.ig_handle || null,
      coverUrl: cover.url,
      assetCount: items.length,
      portalAthlete,
      startPostIndex: reelPostIndex,
    });
  }

  // ── Roster ──────────────────────────────────────────────────────────────
  const rows: RosterRow[] = allAthletes.map((a) => {
    const r = stats.byAthlete.get(a.id);
    return {
      id: a.id,
      name: a.name,
      school: a.school || null,
      handle: a.ig_handle || null,
      followers: a.ig_followers ?? 0,
      impressions: r?.impressions ?? 0,
      engagements: r?.engagements ?? 0,
      rate: r && r.impressions > 0 ? r.rate : null,
      // Both, separately. Post 2 is the fallback for each so a second-round
      // post is still reachable when the first slot is empty.
      feedUrl: a.metrics?.ig_feed?.post_url || a.metrics?.ig_feed_2?.post_url || null,
      reelUrl: a.metrics?.ig_reel?.post_url || a.metrics?.ig_reel_2?.post_url || null,
    };
  });

  const collabs: CollabBlock[] = (collabGroups || []).map((g) => {
    const impressions = (g.metrics?.views ?? 0) + (g.metrics?.impressions ?? 0);
    const engagements = g.metrics?.totalEngagements ?? 0;
    return {
      id: g.id,
      platformLabel: g.platformLabel,
      athleteNames: g.athleteNames,
      combinedFollowers: g.combinedFollowers,
      impressions,
      engagements,
      rate: impressions > 0 ? (engagements / impressions) * 100 : null,
      url: g.url || null,
    };
  });

  return (
    <main
      data-recap-v2="root"
      data-slug={campaign.slug}
      // Rendered section list, on the DOM, so a sweep across all 82 campaigns
      // can be read off the page instead of eyeballed.
      data-sections={sections.join(",") || "none"}
      data-athletes={counts.athletes}
      data-with-metrics={counts.withMetrics}
      data-gallery={counts.gallery}
      data-config={resolved.isUnbuilt ? "derived" : "built"}
      className={`${anton.variable} ${arimo.variable} min-h-screen`}
    >
      <RecapNav sections={sections} brandName={campaign.client_name || campaign.name} />

      {/* Hero always renders: a campaign always has a name, and this is what
          guarantees a zero-metric, zero-photo campaign is still a page. */}
      <HeroSection
        campaign={campaign}
        title={resolved.displayName.value}
        brand={resolved.brand.value}
        lede={resolved.hero.value.lede}
        slides={heroSlides}
        showOverview={shows("overview")}
      />

      {/* Rendered in the resolved order rather than a fixed one, so a config
          can reorder sections. With no config the order is the derived default
          and the output is unchanged. */}
      {sections.map((key) => {
        switch (key) {
          case "overview":
            // Rendered inside the hero block, over the tail of the same
            // backdrop — not as a section beneath it.
            return null;
          case "take":
            return <TakeawaysSection key={key} takeaways={resolved.takeaways.value} />;
          case "numbers":
            return (
              <NumbersSection
                key={key}
                stats={stats}
                metrics={resolved.numbers.value.metrics}
                layout={resolved.numbers.value.layout}
                targets={resolved.numbers.value.targets}
              />
            );
          case "perf":
            return <PerformersSection key={key} byEngagements={byEngagements} byViews={byViews} />;
          case "bic":
            return <ContentSection key={key} cards={galleryCards} />;
          case "roster":
            return <RosterSection key={key} rows={rows} collabs={collabs} />;
          default:
            return null;
        }
      })}

      <RecapFooter campaign={campaign} />
    </main>
  );
}
