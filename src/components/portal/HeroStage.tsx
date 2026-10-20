"use client";

import { useEffect, useRef, useState } from "react";
import { BG, ORANGE, BEBAS, MONO, INK_LABEL } from "@/lib/portal";

export type HeroSlide = {
  id: string;
  src: string;
  alt: string;
  campaignName: string;
  credit: string | null;
  // Parsed from media.resolution ("WxH") when present. It is null on every CVS
  // row today — media has no width/height columns and resolution is populated
  // on only 416 of 4,272 rows overall — so orientation usually has to be
  // measured from the decoded image instead.
  width: number | null;
  height: number | null;
};

// Hero stage for the portal dashboard. The photo bleeds down behind the stat
// bar and fades to pure black at the bottom edge — that bottom fade is also
// the hard-edge blend required by rule 4.
//
// Crop bias (design brief 5.2): focal_x/focal_y are null on every media row and
// there is no width/height column, so orientation cannot be resolved on the
// server. We measure naturalWidth/naturalHeight as each image loads and bias
// portrait crops upward so a full-bleed hero does not behead people. If the
// focal columns are populated later they should override this.

// Desktop bias (unchanged).
const DESKTOP_PORTRAIT = "50% 35%";
const DESKTOP_LANDSCAPE = "50% 50%";

// Mobile bias. The hero is capped at 340px there, so the crop is far tighter
// and a portrait source pushes the subject's head above the frame. Portraits
// bias harder upward; landscapes keep the looser value. Unknown orientation
// sits between the two until the image decodes.
const MOBILE_PORTRAIT = "50% 22%";
const MOBILE_LANDSCAPE = "50% 32%";
const MOBILE_UNKNOWN = "50% 28%";

type Orientation = "portrait" | "landscape";

export default function HeroStage({
  slides,
  lockup,
  statbar,
}: {
  slides: HeroSlide[];
  lockup: React.ReactNode;
  statbar: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState<Record<string, Orientation>>({});
  const reduced = useRef(false);

  // Stored dimensions win; otherwise fall back to what the decoded image
  // reports. focal_x/focal_y stay null and stay unused — this is the interim
  // rule until they are populated.
  const orientationOf = (s: HeroSlide): Orientation | null => {
    if (s.width && s.height) return s.height > s.width ? "portrait" : "landscape";
    return measured[s.id] ?? null;
  };

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (slides.length < 2 || reduced.current) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  const active = slides[index] || null;

  return (
    <div className="pv2-hero relative overflow-hidden" style={{ background: BG }}>
      {/* photo layer */}
      <div className="absolute inset-0 z-0">
        {slides.map((s, i) => {
          const o = orientationOf(s);
          // Desktop keeps its inline value. Mobile reads the custom property,
          // so the per-slide bias can differ by breakpoint without adding any
          // desktop rule.
          const desktopPos = o === "landscape" ? DESKTOP_LANDSCAPE : DESKTOP_PORTRAIT;
          const mobilePos =
            o === "portrait" ? MOBILE_PORTRAIT : o === "landscape" ? MOBILE_LANDSCAPE : MOBILE_UNKNOWN;

          return (
            <div
              key={s.id}
              className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
              style={{ opacity: i === index ? 1 : 0 }}
              aria-hidden={i !== index}
            >
              <img
                src={s.src}
                alt={s.alt}
                className="w-full h-full object-cover block"
                style={
                  {
                    objectPosition: desktopPos,
                    "--pv2-hero-pos-mobile": mobilePos,
                  } as React.CSSProperties
                }
                onLoad={(e) => {
                  if (s.width && s.height) return;
                  const el = e.currentTarget;
                  const o2: Orientation = el.naturalHeight > el.naturalWidth ? "portrait" : "landscape";
                  setMeasured((m) => (m[s.id] ? m : { ...m, [s.id]: o2 }));
                }}
              />
            </div>
          );
        })}
      </div>

      {/* scrim: fades to solid black by the bottom edge (rule 4 edge blend) */}
      <div
        className="pv2-hero-scrim absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `linear-gradient(180deg,rgba(7,7,10,.66) 0%,rgba(7,7,10,.10) 14%,rgba(7,7,10,.06) 34%,rgba(7,7,10,.48) 56%,rgba(7,7,10,.86) 76%,rgba(7,7,10,.98) 90%,${BG} 100%),
                       linear-gradient(90deg,rgba(7,7,10,.88) 0%,rgba(7,7,10,.42) 30%,rgba(7,7,10,0) 62%,rgba(7,7,10,.28) 100%)`,
        }}
      />

      {/* Dedicated ground for the campaign name + athlete credit at <=750px.
          The container scrim fades out mid-frame, which left the copy sitting
          directly on busy imagery. Painted over the container scrim, under the
          text. Mobile only — hidden at desktop. */}
      <div className="pv2-hero-textscrim" aria-hidden />

      <div className="pv2-hero-inner relative z-[2] pt-9 md:pt-[72px]">
        <div className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24">
          <div className="pv2-hero-row flex flex-col md:flex-row md:items-end md:justify-between gap-6 md:gap-[30px] min-h-[340px] md:min-h-[400px] lg:min-h-[560px]">
            {lockup}

            {/* Campaign + athlete credit for the visible slide. */}
            {active ? (
              <div className="text-left md:text-right pb-1">
                <div
                  className="uppercase"
                  style={{ ...BEBAS, fontSize: "clamp(26px,3.4vw,34px)", lineHeight: 1, letterSpacing: ".012em" }}
                >
                  {active.campaignName}
                </div>
                <div
                  className="mt-2"
                  style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: "rgba(250,248,245,.62)" }}
                >
                  {active.credit || "Athlete Name"}
                </div>

                {slides.length > 1 ? (
                  <div className="flex gap-[6px] justify-start md:justify-end mt-2">
                    {slides.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-label={`Show slide ${i + 1} of ${slides.length}`}
                        aria-current={i === index ? "true" : undefined}
                        onClick={() => setIndex(i)}
                        className="pv2-dot inline-flex items-center justify-center"
                        style={{ minHeight: 32, minWidth: 34, padding: "15px 0", background: "none", border: 0, cursor: "pointer" }}
                      >
                        <span
                          className="block transition-all duration-300"
                          style={{
                            height: 2,
                            width: i === index ? 34 : 20,
                            background: i === index ? ORANGE : "rgba(250,248,245,.30)",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="pv2-hero-stats pt-11 pb-14 md:pb-24">{statbar}</div>
        </div>
      </div>
    </div>
  );
}

// Zero-image fallback (brief 5.1 rule 4): a flat brand-colour panel carrying
// the logo, with no slideshow. Never a stock or substitute image.
export function HeroFallback({
  lockup,
  statbar,
}: {
  lockup: React.ReactNode;
  statbar: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden" style={{ background: "#101014" }}>
      <div className="relative z-[2] pt-9 md:pt-[72px]">
        <div className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 min-h-[220px] md:min-h-[300px]">
            {lockup}
            <div style={{ ...MONO, fontSize: 10, color: INK_LABEL }}>No imagery delivered yet</div>
          </div>
          <div className="pv2-hero-stats pt-11 pb-14 md:pb-24">{statbar}</div>
        </div>
      </div>
    </div>
  );
}
