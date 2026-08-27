// The opening block: one backdrop photo carrying both the hero and the
// campaign overview, dissolving to black before the numbers section.
//
// The overview prose is INSIDE this block, over the tail of the same photo —
// not a separate section beneath it. That is the difference between a page
// that opens as one piece and a photo that stops at an edge.
//
// The block always renders. A campaign always has a name, and the vertical
// half of the wash is what carries it into the page, so a campaign with no
// media and no prose is still a proper opening rather than a bare header.
import { SECTION_HEADING, hasRichText, specRows } from "@/lib/recap-v2/guards";
import type { Campaign } from "@/lib/types";
import { HeroCarousel, type HeroSlide } from "./HeroCarousel";

export function HeroSection({
  campaign,
  title,
  brand,
  lede,
  slides,
  showOverview,
}: {
  campaign: Campaign;
  title: string;
  /** The line above the title. Falls back to the account name. */
  brand: string;
  /** The line under it. Its own field — see hero.lede in config.ts. */
  lede: string;
  slides: HeroSlide[];
  /** Whether the overview belongs in this block at all — see the guards. */
  showOverview: boolean;
}) {
  const s = campaign.settings || {};
  const rows = specRows(campaign);
  const hasProse = hasRichText(s.description);
  const overview = showOverview && (hasProse || rows.length > 0);

  return (
    <section id="hero" data-recap-v2="hero" className="rv-hblock">
      <HeroCarousel slides={slides} />

      {/* 16:8 on desktop, 3:4 on a phone where a wide band would leave the
          title stranded at the bottom of a sliver. */}
      <div className="relative z-[2] flex aspect-[3/4] items-end min-[1001px]:aspect-[16/8]">
        <div className="w-full px-[var(--gutter)] pb-[22px] min-[1001px]:pb-[var(--s3)]">
          <div className="min-[1001px]:max-w-[56%]">
            {brand ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#d6d9d1] min-[1001px]:text-[15px] min-[1001px]:tracking-[0.36em]">
                {brand}
              </p>
            ) : null}
            <h1 className="my-[7px] font-display text-[clamp(44px,7vw,120px)] leading-[0.97] tracking-[-0.02em] [word-break:break-word]">
              {title}
            </h1>
            {lede ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#b9bdb3] min-[1001px]:text-[13px] min-[1001px]:tracking-[0.22em]">
                {lede}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {overview ? (
        // The anchor lives here rather than on the block, because the block is
        // the hero and the nav points at the overview.
        <div
          id="overview"
          data-recap-v2="overview"
          className="relative z-[2] scroll-mt-[var(--nav-h)] px-[var(--gutter)] pb-[var(--s5)] pt-[6px] min-[1001px]:pb-[var(--s6)]"
        >
          <h2 className="mb-[10px] font-mono text-[11px] uppercase tracking-[0.15em] text-[rgba(250,248,245,0.5)]">
            {SECTION_HEADING.overview.title}
          </h2>
          {hasProse ? (
            <div
              className="max-w-[58ch] text-[14.5px] leading-[1.65] text-[#d3d3d9] min-[1001px]:text-[17.5px] min-[1001px]:leading-[1.72] [&_b]:font-bold [&_b]:text-[color:var(--rv-white)] [&_p+p]:mt-[var(--s2)] [&_strong]:font-bold [&_strong]:text-[color:var(--rv-white)]"
              dangerouslySetInnerHTML={{ __html: s.description as string }}
            />
          ) : null}

          {/* Spec rows sit last, where the vertical wash is already near black. */}
          {rows.length > 0 ? (
            <dl className="mt-[var(--s4)] max-w-[520px]">
              {rows.map((r, i) => (
                <div
                  key={r.key}
                  className={`flex items-baseline justify-between gap-6 border-b border-[color:var(--rv-soft)] py-[15px] ${
                    i === 0 ? "border-t border-t-[color:var(--rv-line)]" : ""
                  }`}
                >
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--rv-dim2)]">
                    {r.label}
                  </dt>
                  <dd className="text-right text-[15px]">{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
