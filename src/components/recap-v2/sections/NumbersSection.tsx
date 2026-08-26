// #numbers — hero figure + 3 rows, then the donut and platform legend.
//
// Guarded upstream on "at least one athlete posted somewhere" (30 of 82
// published campaigns fail that and lose the whole section). Inside, the
// legend is built ONLY from platforms that actually have posts: 35 campaigns
// have no feed and 32 no reels, so a fixed three-row legend would print
// "0 — 0% of impressions" rows on most of the catalogue.
import { PLATFORM_LABEL, SECTION_HEADING, type PlatformId } from "@/lib/recap-v2/guards";

export function NumbersSection({
  platformsPresent,
  platformCounts,
}: {
  platformsPresent: PlatformId[];
  platformCounts: Record<PlatformId, number>;
}) {
  const h = SECTION_HEADING.numbers;
  return (
    <section id="numbers" data-recap-v2="numbers">
      <p data-slot="kicker">{h.kicker}</p>
      <h2>{h.title}</h2>

      {/* Hero figure + 3 rows. Figures land in Step 2, via
          engagementRateByImpressions() — labelled "engagements ÷ impressions",
          not a bare "eng. rate", so it reads apart from the max-based rate the
          rest of the app still uses. */}
      <div data-slot="nhead" />

      {/* Donut needs at least one platform to draw an arc. A single-platform
          campaign draws one full ring, which is correct, not a bug. */}
      {platformsPresent.length > 0 ? (
        <div data-slot="donut" data-arcs={platformsPresent.length} />
      ) : null}

      {platformsPresent.length > 0 ? (
        <ul data-slot="legend">
          {platformsPresent.map((p) => (
            <li key={p} data-platform={p}>
              {PLATFORM_LABEL[p]} — {platformCounts[p]} posting
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Geography / "State to state" ────────────────────────────────────
          OMITTED IN v1, DELIBERATELY. The prototype renders a US choropleth,
          but only because a school→state mapping for Wendy's 36 programs was
          hand-built inside that one file. `athletes` has no state column and
          no geography of any kind, so there is nothing to generalise from and
          nothing to port. The slot is kept so the section order does not have
          to change when a real mapping exists.
          Porting it also means d3 + topojson from a CDN, which the prototype
          loads and this page does not.
      <div data-slot="geo" /> */}
    </section>
  );
}
