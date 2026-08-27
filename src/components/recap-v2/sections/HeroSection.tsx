// Full-bleed hero: stills behind, a black column of copy in front.
//
// The carousel is the part that can be absent — 2 published campaigns have no
// usable media at all — so the plate has to stand on its own without it. The
// title is the only thing guaranteed to exist, and it is what makes a
// zero-metric, zero-photo campaign still a page.
import type { Campaign } from "@/lib/types";
import { HeroCarousel, type HeroSlide } from "./HeroCarousel";

export function HeroSection({
  campaign,
  title,
  slides,
}: {
  campaign: Campaign;
  /**
   * What the hero prints at up to 150px. `campaign.name` is the ADMIN name and
   * is not always safe to show a client — "Dunks March Madness" carries an NCAA
   * trademark, and a headline this size is as brand-facing as it gets. The
   * resolver supplies recap_config.display_name where one is set and the admin
   * name where it is not.
   */
  title: string;
  slides: HeroSlide[];
}) {
  const s = campaign.settings || {};
  // Each part drops independently rather than leaving stray separators.
  const meta = ["Campaign recap", s.campaign_type].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  return (
    // min-height, not height. The reference hero is a fixed 100vh, but its
    // title is a two-word display line ("Dunks on Dunks."); a real campaign
    // name is whatever the client called it, and at 1568px "Dunks March
    // Madness" already wraps to two lines of 196px type. Fixed height plus
    // overflow-hidden clipped the brand mark behind the nav. Growing instead
    // means the hero is still at least a full screen and never cuts its own
    // content off.
    <header
      id="hero"
      data-recap-v2="hero"
      className="relative flex min-h-screen items-end overflow-hidden"
    >
      <HeroCarousel slides={slides} />
      <div className="rv-shade pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* Top padding clears the fixed nav — without it the brand mark sits
          underneath it on short viewports. */}
      <div className="relative z-[3] w-full px-[var(--gutter)] pb-[56px] pt-[calc(var(--nav-h)+var(--s4))] min-[1001px]:pb-[96px]">
        <div className="max-w-[1120px]">
          {s.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.brand_logo_url}
              alt={campaign.client_name || ""}
              className="mb-6 block w-[280px] max-w-[52vw] drop-shadow-[0_4px_18px_rgba(7,7,10,0.6)] min-[1001px]:mb-9 min-[1001px]:w-[500px]"
            />
          ) : null}

          {/* The hero stays monochrome — a brand mark is the only colour above
              the fold, so this kicker does not take the orange. */}
          {campaign.client_name ? (
            <p className="font-mono text-[15px] uppercase tracking-[0.36em] text-[rgba(250,248,245,0.75)]">
              {campaign.client_name}
            </p>
          ) : null}

          {/* Upper bound pulled down from the reference's 210px: that suited a
              three-word display title, and campaign names in the catalogue run
              to seven. Lower bound kept so short names still land big. */}
          <h1 className="my-[22px] font-display text-[clamp(64px,9vw,150px)] leading-[0.86]">
            {title}
          </h1>

          {/* No description here, deliberately.
              The reference hero carries a short lede distinct from the longer
              prose in #overview — but the schema has ONE description field, so
              putting it in both places prints the same copy twice AND, because
              real descriptions run to several hundred words, overflows a
              100vh hero and gets clipped by its own overflow-hidden. The
              overview owns the prose; the hero owns the title. */}

          {meta.length > 0 ? (
            <div className="mt-10 flex flex-wrap items-center gap-[18px] font-mono text-[13px] uppercase tracking-[0.22em] text-[rgba(250,248,245,0.72)]">
              {meta.map((m, i) => (
                <span key={m} className="flex items-center gap-[18px]">
                  {i > 0 ? (
                    <i className="block h-px w-5 bg-[rgba(250,248,245,0.3)]" aria-hidden="true" />
                  ) : null}
                  <span>{m}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
