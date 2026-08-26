// #numbers — hero figure + 3 rows, then the donut and platform legend.
//
// Guarded upstream on "at least one athlete posted somewhere" (30 of 82
// published campaigns fail that and lose the whole section). Inside, the
// legend is built ONLY from platforms that actually have impressions: 35
// campaigns have no feed and 32 no reels, so a fixed three-row legend would
// print "0 — 0% of impressions" rows on most of the catalogue.
//
// Every rate here is engagements ÷ impressions and says so. Nothing on this
// page reads computeStats' avgEngRate, which is still max-based.
import { PLATFORM_LABEL, SECTION_HEADING } from "@/lib/recap-v2/guards";
import { RATE_LABEL, formatRate, type RecapV2Stats } from "@/lib/recap-v2/stats";
import { fmt } from "@/lib/recap-helpers";

export function NumbersSection({ stats }: { stats: RecapV2Stats }) {
  const h = SECTION_HEADING.numbers;
  const { volume, platforms } = stats;
  // Reel views are the headline on most campaigns, but not all — 32 have no
  // reels. Fall back to whichever surface actually carried the campaign.
  const headline =
    volume.igReel.views > 0
      ? { value: volume.igReel.views, label: "Reel views" }
      : { value: stats.ratedImpressions, label: "Impressions" };

  const rows = [
    { key: "eng", label: "Total engagements", note: "Likes, comments, shares and reposts", value: fmt(stats.totalEngagements) },
    { key: "rate", label: "Avg engagement rate", note: RATE_LABEL, value: formatRate(stats.engagementRate), highlight: true },
    { key: "posts", label: "Posts published", note: "Feed, reels and stories", value: fmt(volume.totalPosts) },
    // A rate with nothing to divide by is omitted, not printed as 0%.
  ].filter((r) => r.key !== "rate" || stats.ratedImpressions > 0);

  return (
    <section id="numbers" data-recap-v2="numbers">
      <p data-slot="kicker">{h.kicker}</p>
      <h2>{h.title}</h2>

      <div data-slot="nhead">
        <p data-slot="nbig" data-value={headline.value}>
          {fmt(headline.value)} <span>{headline.label}</span>
        </p>
        <dl data-slot="nrows">
          {rows.map((r) => (
            <div key={r.key} data-row={r.key} data-highlight={r.highlight ? "1" : undefined}>
              <dt>
                {r.label} <small>{r.note}</small>
              </dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Donut needs at least one platform to draw an arc. A single-platform
          campaign draws one full ring, which is correct, not a bug. */}
      {platforms.length > 0 ? (
        <div
          data-slot="donut"
          data-arcs={platforms.length}
          data-total={stats.volume.totalImpressions}
        />
      ) : null}

      {platforms.length > 0 ? (
        <ul data-slot="legend" aria-label={`Platform breakdown — rate is ${RATE_LABEL}`}>
          {platforms.map((p) => (
            <li key={p.platform} data-platform={p.platform}>
              <span data-f="name">{PLATFORM_LABEL[p.platform]}</span>
              <span data-f="impressions">{fmt(p.impressions)}</span>
              <span data-f="share">{p.share.toFixed(1)}% of impressions</span>
              {/* Stories have no rate — an em dash, never a misleading 0%. */}
              <span data-f="rate" title={p.rate == null ? undefined : RATE_LABEL}>
                {p.rate == null ? "—" : formatRate(p.rate)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Geography / "State to state" ────────────────────────────────────
          OMITTED IN v1, DELIBERATELY. The prototype renders a US choropleth,
          but only because a school->state mapping for Wendy's 36 programs was
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
