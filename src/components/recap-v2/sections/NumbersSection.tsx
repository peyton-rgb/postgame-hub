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

export function NumbersSection({ stats }: { stats: RecapV2Stats }) {
  const h = SECTION_HEADING.numbers;
  const { volume, platforms } = stats;

  // Reel views are the headline on most campaigns, but 32 have no reels at
  // all — fall back to whichever surface actually carried the campaign.
  const headline =
    volume.igReel.views > 0
      ? { value: volume.igReel.views, label: "Reel views" }
      : { value: stats.ratedImpressions, label: "Impressions" };

  const rows = [
    {
      key: "eng",
      label: "Total engagements",
      note: "Likes, comments, shares and reposts",
      value: fmt(stats.totalEngagements),
      highlight: false,
    },
    // A rate with nothing to divide by is omitted, not printed as 0%.
    ...(stats.ratedImpressions > 0
      ? [
          {
            key: "rate",
            label: "Avg engagement rate",
            note: RATE_LABEL,
            value: formatRate(stats.engagementRate),
            highlight: true,
          },
        ]
      : []),
    {
      key: "posts",
      label: "Posts published",
      note: "Feed, reels and stories",
      value: fmt(volume.totalPosts),
      highlight: false,
    },
  ];

  // Arc offsets accumulate so the ring reads clockwise from twelve o'clock.
  let consumed = 0;
  const arcs = platforms.map((p) => {
    const length = (p.share / 100) * CIRCUMFERENCE;
    const arc = { p, length, offset: -consumed };
    consumed += length;
    return arc;
  });

  return (
    <Section id="numbers">
      <SectionHead kicker={h.kicker} title={h.title} tight />

      <div className="grid grid-cols-1 items-center gap-8 border-b border-[color:var(--rv-line)] pb-[var(--s3)] min-[1001px]:grid-cols-[0.85fr_1fr] min-[1001px]:gap-[var(--s4)]">
        <div data-slot="nbig" data-value={headline.value}>
          <Stat className="block text-[clamp(80px,9vw,140px)] leading-[0.9]">
            {fmt(headline.value)}
          </Stat>
          <p className="mt-[14px] font-mono text-[12px] uppercase tracking-[0.2em] text-[color:var(--rv-dim)]">
            {headline.label}
          </p>
        </div>

        <dl className="m-0">
          {rows.map((r, i) => (
            <div
              key={r.key}
              data-row={r.key}
              className={`flex items-baseline justify-between gap-[26px] py-[13px] ${
                i === rows.length - 1 ? "" : "border-b border-[color:var(--rv-soft)]"
              }`}
            >
              <dt>
                <span className="block font-mono text-[12px] uppercase tracking-[0.14em] text-[color:var(--rv-white)]">
                  {r.label}
                </span>
                <span className="mt-[5px] block text-[13.5px] text-[color:var(--rv-dim)]">
                  {r.note}
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
        <div className="mt-[var(--s3)] grid grid-cols-1 items-center gap-8 border-t border-[color:var(--rv-line)] pt-[var(--s3)] min-[1001px]:grid-cols-[260px_1fr] min-[1001px]:gap-[var(--s4)]">
          {/* A single-platform campaign draws one full ring. Correct, not a bug. */}
          <div
            className="relative mx-auto h-[240px] w-[240px]"
            data-slot="donut"
            data-arcs={platforms.length}
            data-total={Math.round(volume.totalImpressions)}
          >
            <svg viewBox="0 0 200 200" width="240" height="240" className="-rotate-90" aria-hidden="true">
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
                className={`flex items-center gap-5 py-[14px] ${
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
