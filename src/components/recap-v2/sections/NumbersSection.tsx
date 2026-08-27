// #numbers — a headline figure beside three rows, then a donut and legend.
//
// Guarded upstream on "at least one athlete posted somewhere" (30 of 82
// published campaigns fail that and lose the whole section). The legend is
// built ONLY from surfaces that actually have impressions: 35 campaigns have
// no feed and 32 no reels, so a fixed three-row legend would print
// "0 — 0% of impressions" across most of the catalogue.
//
// Every rate here is engagements ÷ impressions and says so. Nothing on this
// page reads computeStats' avgEngRate, which is still max-based.
import { PLATFORM_LABEL, SECTION_HEADING } from "@/lib/recap-v2/guards";
import type { NumberLayout, NumberMetric, NumbersConfig } from "@/lib/recap-v2/config";
import { RATE_LABEL, formatRate, type PlatformRate, type RecapV2Stats } from "@/lib/recap-v2/stats";
import { fmt } from "@/lib/recap-helpers";
import { Foot, Section, SectionHead, Stat } from "../ui";

// Four slices now, not the prototype's three: it omits TikTok entirely, which
// on the reference campaign is 25% of impressions and 32% of engagements.
// Orange goes to the reach engine, then descending weight.
const SLICE_COLOR: Record<PlatformRate["platform"], string> = {
  ig_reel: "#D73F09",
  ig_feed: "#FAF8F5",
  tiktok: "#8A8F98",
  ig_story: "#55534F",
};

const SLICE_NOTE: Record<PlatformRate["platform"], string> = {
  ig_reel: "Short-form video",
  ig_feed: "Static and carousel posts",
  tiktok: "Short-form video, off-platform",
  ig_story: "24-hour posts — no engagements recorded",
};

const R = 88;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * How tightly the section is grouped.
 *
 * `standard` holds the exact strings this section shipped with, so an
 * unconfigured recap renders byte-identically. `compact` and `spacious` are
 * the two directions the builder can move it, and nothing else varies — the
 * type scale and the donut geometry are the design, not a preference.
 */
//
// Every class here is a COMPLETE LITERAL, never assembled from a variable.
// Tailwind generates CSS by scanning source text, so a class built at runtime
// — `grid-cols-[${size}px_1fr]` — appears in the HTML with no rule behind it.
// That exact mistake silently removed the donut band's desktop grid here, and
// only a before/after diff caught it. Keep these strings whole.
const LAYOUT: Record<
  NumberLayout,
  {
    headGap: string;
    headPad: string;
    rowPad: string;
    band: string;
    donutPx: number;
    donutBox: string;
    legendPad: string;
  }
> = {
  compact: {
    headGap: "gap-6 min-[1001px]:gap-[var(--s3)]",
    headPad: "pb-[var(--s2)]",
    rowPad: "py-[9px]",
    band: "gap-6 pt-[var(--s2)] min-[1001px]:grid-cols-[220px_1fr] min-[1001px]:gap-[var(--s3)]",
    donutPx: 200,
    donutBox: "h-[200px] w-[200px]",
    legendPad: "py-[10px]",
  },
  standard: {
    headGap: "gap-8 min-[1001px]:gap-[var(--s4)]",
    headPad: "pb-[var(--s3)]",
    rowPad: "py-[13px]",
    band: "gap-8 pt-[var(--s3)] min-[1001px]:grid-cols-[260px_1fr] min-[1001px]:gap-[var(--s4)]",
    donutPx: 240,
    donutBox: "h-[240px] w-[240px]",
    legendPad: "py-[14px]",
  },
  spacious: {
    headGap: "gap-11 min-[1001px]:gap-[var(--s5)]",
    headPad: "pb-[var(--s4)]",
    rowPad: "py-[17px]",
    band: "gap-11 pt-[var(--s4)] min-[1001px]:grid-cols-[340px_1fr] min-[1001px]:gap-[var(--s5)]",
    donutPx: 300,
    donutBox: "h-[300px] w-[300px]",
    legendPad: "py-5",
  },
};

export function NumbersSection({
  stats,
  metrics,
  layout,
  targets = {},
}: {
  stats: RecapV2Stats;
  metrics: NumberMetric[];
  layout: NumberLayout;
  targets?: NumbersConfig["targets"];
}) {
  const h = SECTION_HEADING.numbers;
  const { volume, platforms } = stats;
  const L = LAYOUT[layout];

  // Reel views are the headline on most campaigns, but 32 have no reels at
  // all — fall back to whichever surface actually carried the campaign.
  const headline =
    volume.igReel.views > 0
      ? { value: volume.igReel.views, label: "Reel views" }
      : { value: stats.ratedImpressions, label: "Impressions" };

  // One definition per metric the config can ask for. `available` is the data
  // guard and is NOT a config concern: a rate with nothing to divide by is
  // omitted whether or not someone selected it, because printing 0% would
  // state something false.
  const DEFS: Record<
    Exclude<NumberMetric, "headline">,
    { key: string; label: string; note: string; value: string; highlight?: boolean; available: boolean }
  > = {
    engagements: {
      key: "eng",
      label: "Total engagements",
      note: "Likes, comments, shares and reposts",
      value: fmt(stats.totalEngagements),
      available: true,
    },
    engagement_rate: {
      key: "rate",
      label: "Avg engagement rate",
      note: RATE_LABEL,
      value: formatRate(stats.engagementRate),
      highlight: true,
      available: stats.ratedImpressions > 0,
    },
    posts: {
      key: "posts",
      label: "Posts published",
      note: "Feed, reels and stories",
      value: fmt(volume.totalPosts),
      available: true,
    },
    impressions: {
      key: "impressions",
      label: "Total impressions",
      note: "Every surface, stories included",
      value: fmt(volume.totalImpressions),
      available: volume.totalImpressions > 0,
    },
    athletes: {
      key: "athletes",
      label: "Athletes",
      note: "On the campaign roster",
      value: fmt(volume.athleteCount),
      available: volume.athleteCount > 0,
    },
    schools: {
      key: "schools",
      label: "Schools",
      note: "Programs represented",
      value: fmt(volume.schoolCount),
      available: volume.schoolCount > 0,
    },
    followers: {
      key: "followers",
      label: "Combined following",
      note: "Across the roster",
      value: fmt(volume.combinedFollowers),
      available: volume.combinedFollowers > 0,
    },
  };

  const showHeadline = metrics.includes("headline");
  const rows = metrics
    .filter((m): m is Exclude<NumberMetric, "headline"> => m !== "headline")
    .map((m) => ({ metric: m, ...DEFS[m] }))
    .filter((r) => r.available);

  // Arc offsets accumulate so the ring reads clockwise from twelve o'clock.
  let consumed = 0;
  const arcs = platforms.map((p) => {
    const length = (p.share / 100) * CIRCUMFERENCE;
    const arc = { p, length, offset: -consumed };
    consumed += length;
    return arc;
  });

  return (
    <Section id="numbers" flush>
      <SectionHead kicker={h.kicker} title={h.title} tight />

      <div
        className={`grid grid-cols-1 items-center ${L.headGap} ${L.headPad} ${
          showHeadline ? "min-[1001px]:grid-cols-[0.85fr_1fr]" : ""
        }`}
      >
        {showHeadline ? (
        <div data-slot="nbig" data-value={headline.value}>
          <Stat className="block text-[clamp(80px,9vw,140px)] leading-[0.9]">
            {fmt(headline.value)}
          </Stat>
          <p className="mt-[14px] font-mono text-[12px] uppercase tracking-[0.2em] text-[color:var(--rv-dim)]">
            {headline.label}
          </p>
        </div>
        ) : null}

        <dl className="m-0">
          {rows.map((r, i) => (
            <div
              key={r.key}
              data-row={r.key}
              className={`flex items-baseline justify-between gap-[26px] ${L.rowPad} ${
                i === rows.length - 1 ? "" : "border-b border-[color:var(--rv-soft)]"
              }`}
            >
              <dt>
                <span className="block font-mono text-[12px] uppercase tracking-[0.14em] text-[color:var(--rv-white)]">
                  {r.label}
                </span>
                <span className="mt-[5px] block text-[13.5px] text-[color:var(--rv-dim)]">
                  {r.note}
                  {/* A target is only shown when someone set one. */}
                  {targets[r.metric] != null ? (
                    <> · target {fmt(targets[r.metric])}</>
                  ) : null}
                </span>
              </dt>
              <dd>
                <Stat
                  className={`whitespace-nowrap text-[38px] leading-none ${
                    r.highlight ? "text-[color:var(--rv-orange)]" : ""
                  }`}
                >
                  {r.value}
                </Stat>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {platforms.length > 0 ? (
        <div className={`grid grid-cols-1 items-center border-t border-[color:var(--rv-line)] ${L.band}`}>
          {/* A single-platform campaign draws one full ring. Correct, not a bug. */}
          <div
            className={`relative mx-auto ${L.donutBox}`}
            data-slot="donut"
            data-arcs={platforms.length}
            data-total={Math.round(volume.totalImpressions)}
          >
            <svg viewBox="0 0 200 200" width={L.donutPx} height={L.donutPx} className="-rotate-90" aria-hidden="true">
              <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="22" />
              {arcs.map(({ p, length, offset }) => (
                <circle
                  key={p.platform}
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={SLICE_COLOR[p.platform]}
                  strokeWidth="22"
                  strokeDasharray={`${length} ${CIRCUMFERENCE}`}
                  strokeDashoffset={offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Stat className="text-[36px] leading-none">{fmt(volume.totalImpressions)}</Stat>
              <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[color:var(--rv-dim2)]">
                Total impressions
              </p>
            </div>
          </div>

          <ul className="m-0 list-none">
            {platforms.map((p, i) => (
              <li
                key={p.platform}
                data-platform={p.platform}
                className={`flex items-center gap-5 ${L.legendPad} ${
                  i === platforms.length - 1 ? "" : "border-b border-[color:var(--rv-soft)]"
                }`}
              >
                <span
                  className="h-9 w-3 flex-none rounded-[3px]"
                  style={{ background: SLICE_COLOR[p.platform] }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-mono text-[14px] font-medium uppercase tracking-[0.1em]">
                    {PLATFORM_LABEL[p.platform]}
                  </p>
                  <p className="mt-[5px] text-[13.5px] text-[color:var(--rv-dim)]">
                    {SLICE_NOTE[p.platform]}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <Stat className="block text-[30px] leading-none">{fmt(p.impressions)}</Stat>
                  <p className="mt-[6px] font-mono text-[12px] tracking-[0.1em] text-[color:var(--rv-dim)]">
                    {p.share.toFixed(1)}% of impressions
                    {/* Stories have no rate — never a misleading 0%. */}
                    {p.rate == null ? null : <> · {formatRate(p.rate)}</>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {platforms.length > 0 ? <Foot>Engagement rate is {RATE_LABEL}.</Foot> : null}

      {/* ── Geography / "State to state" ────────────────────────────────────
          OMITTED, DELIBERATELY. The prototype renders a US choropleth, but
          only because a school->state mapping for Wendy's 36 programs was
          hand-built inside that one file. `athletes` has no state column and
          no geography of any kind, so there is nothing to generalise from and
          nothing to port. The slot is kept so the section order does not have
          to change when a real mapping exists. Porting it also means d3 +
          topojson from a CDN, which the prototype loads and this page does not.
      <div data-slot="geo" /> */}
    </Section>
  );
}
