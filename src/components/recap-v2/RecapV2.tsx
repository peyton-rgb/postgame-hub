// ============================================================
// Recap v2 — scaffold
//
// Step 1: route, section shells and guards only. No visual work, no figures.
// The point of this commit is that the page cannot crash or leave a hole for
// any of the 82 published campaigns, most of which are far emptier than the
// Wendy's campaign the design was drawn against.
//
// Presence is decided once, in lib/recap-v2/guards.ts, and the nav is built
// from the same list — a section and its anchor cannot disagree.
// ============================================================

import {
  athletesWithMetrics,
  computePresence,
  galleryItems,
  type RecapV2Data,
} from "@/lib/recap-v2/guards";
import { ContentSection } from "./sections/ContentSection";
import { HeroSection } from "./sections/HeroSection";
import { NumbersSection } from "./sections/NumbersSection";
import { OverviewSection } from "./sections/OverviewSection";
import { PerformersSection } from "./sections/PerformersSection";
import { RecapFooter } from "./sections/RecapFooter";
import { RecapNav } from "./sections/RecapNav";
import { RosterSection } from "./sections/RosterSection";
import { TakeawaysSection } from "./sections/TakeawaysSection";
import { getTotalEngagements } from "@/lib/recap-helpers";

export function RecapV2(data: RecapV2Data) {
  const { campaign, allAthletes, media, collabGroups } = data;
  const presence = computePresence(data);
  const { has, sections, counts } = presence;

  const gallery = galleryItems(media);
  // Ranking by engagements is the default the toggle starts on. Photos are NOT
  // required to place — see PerformersSection for why.
  const performers = athletesWithMetrics(allAthletes)
    .slice()
    .sort((a, b) => getTotalEngagements(b) - getTotalEngagements(a));

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
    >
      <RecapNav sections={sections} brandName={campaign.client_name || campaign.name} />

      {/* Hero always renders: a campaign always has a name, and this is what
          guarantees a zero-metric, zero-photo campaign is still a page. */}
      <HeroSection campaign={campaign} slides={gallery.slice(0, 4)} />

      {has.overview ? <OverviewSection campaign={campaign} /> : null}
      {has.take ? <TakeawaysSection campaign={campaign} /> : null}
      {has.numbers ? (
        <NumbersSection
          platformsPresent={counts.platformsPresent}
          platformCounts={counts.platforms}
        />
      ) : null}
      {has.perf ? <PerformersSection candidates={performers} /> : null}
      {has.bic ? <ContentSection items={gallery} /> : null}
      {has.roster ? (
        <RosterSection athletes={allAthletes} collabGroups={collabGroups} />
      ) : null}

      <RecapFooter campaign={campaign} />
    </main>
  );
}
