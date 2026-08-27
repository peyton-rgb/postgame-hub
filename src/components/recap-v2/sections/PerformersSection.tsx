"use client";

// #perf — "Who carried it": up to five portrait cards and an engagements /
// views toggle. Client-side for the toggle; the ranking itself is computed
// server-side and passed in for both modes.
//
// The prototype filters on `r.img && eng > 0`, which blanks this section for
// any campaign whose top athletes have metrics but no uploaded photo — 13
// campaigns have fewer than 5 athletes with photos. Here the photo is
// optional: a card with no image falls back to a flat plate with the same
// typography, so ranking never silently drops an athlete who carried the
// campaign.
//
// The rate on each card is that athlete's own engagements ÷ impressions,
// summed across Post 1 and Post 2 together.
import { useState } from "react";
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import { RATE_LABEL, formatRate } from "@/lib/recap-v2/stats";
import { fmt } from "@/lib/recap-helpers";
import { Foot, Section, SectionHead, Stat } from "../ui";
import { transformed } from "../media";

export interface PerformerCard {
  id: string;
  name: string;
  school: string | null;
  imageUrl: string | null;
  postUrl: string | null;
  engagements: number;
  views: number;
  followers: number;
  rate: number | null;
}

const InstagramMark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="block h-6 w-6">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export function PerformersSection({ byEngagements, byViews }: {
  byEngagements: PerformerCard[];
  byViews: PerformerCard[];
}) {
  const [mode, setMode] = useState<"eng" | "views">("eng");
  const h = SECTION_HEADING.perf;
  const cards = mode === "eng" ? byEngagements : byViews;
  // The toggle only earns its place when the two rankings can differ.
  const showToggle = byViews.length > 0 && byEngagements.length > 1;

  return (
    <Section id="perf">
      <SectionHead kicker={h.kicker} title={h.title} tight />

      {showToggle ? (
        <div
          role="group"
          aria-label="Rank top performers by"
          className="mb-[var(--s3)] grid h-11 w-[320px] max-w-full grid-cols-2 overflow-hidden rounded-full border border-[color:var(--rv-line)] bg-white/5"
        >
          {([["eng", "Engagements"], ["views", "Reel views"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={`cursor-pointer border-0 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200 ${
                mode === key
                  ? "bg-[color:var(--rv-orange)] text-white"
                  : "bg-transparent text-[color:var(--rv-dim)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Fewer than five is normal — render what exists rather than padding a
          five-column grid with holes. */}
      <ul
        data-slot="pgrid"
        data-count={cards.length}
        className="m-0 grid list-none gap-[var(--s1)] grid-cols-2 min-[701px]:grid-cols-3 min-[1001px]:grid-cols-5"
      >
        {cards.map((c) => {
          const Tag = c.postUrl ? "a" : "div";
          return (
            <li key={c.id} data-athlete={c.id}>
              <Tag
                {...(c.postUrl ? { href: c.postUrl, target: "_blank", rel: "noopener noreferrer" } : {})}
                className="rv-vignette group relative flex aspect-[9/16] flex-col justify-end overflow-hidden rounded-[22px] bg-white/[0.04] bg-cover bg-[center_12%] text-inherit no-underline transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1"
                style={
                  c.imageUrl
                    ? { backgroundImage: `url(${transformed(c.imageUrl, 720)})` }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,10,0)_40%,rgba(7,7,10,.34)_58%,rgba(7,7,10,.72)_74%,rgba(7,7,10,.93)_88%,rgba(7,7,10,.97))]"
                />
                <span className="relative px-[18px] pb-5 pt-[18px] [text-shadow:0_1px_10px_rgba(7,7,10,.55)]">
                  <span className="block font-display text-[26px] leading-none">
                    {c.name.toUpperCase()}
                  </span>
                  <span className="mt-px flex h-[22px] items-center gap-3">
                    <span className="h-[2px] flex-1 rounded-[2px] bg-[color:var(--rv-orange)]" />
                    <span className="flex-none text-white">
                      <InstagramMark />
                    </span>
                  </span>
                  {c.school ? (
                    <span className="block truncate font-mono text-[9.5px] uppercase tracking-[0.16em] text-[rgba(250,248,245,0.6)]">
                      {c.school.toUpperCase()}
                    </span>
                  ) : null}
                  <span className="mt-3 grid grid-cols-3 border-t border-white/[0.22] pt-[11px]">
                    <span className="block">
                      <Stat className="block text-[20px] leading-none text-[color:var(--rv-orange)]">
                        {fmt(mode === "views" ? c.views : c.engagements)}
                      </Stat>
                      <span className="mt-[6px] block whitespace-nowrap font-mono text-[8px] tracking-[0.08em] text-[rgba(250,248,245,0.55)]">
                        {mode === "views" ? "VIEWS" : "ENGAGEMENTS"}
                      </span>
                    </span>
                    <span className="block border-l border-white/[0.16] pl-[10px]">
                      {/* An athlete with engagements but no impressions has no
                          rate to state. Em dash, never a real-looking 0%. */}
                      <Stat className="block text-[20px] leading-none">
                        {c.rate == null ? "—" : formatRate(c.rate)}
                      </Stat>
                      <span className="mt-[6px] block whitespace-nowrap font-mono text-[8px] tracking-[0.08em] text-[rgba(250,248,245,0.55)]">
                        ENG. RATE
                      </span>
                    </span>
                    <span className="block border-l border-white/[0.16] pl-[10px]">
                      <Stat className="block text-[20px] leading-none">{fmt(c.followers)}</Stat>
                      <span className="mt-[6px] block whitespace-nowrap font-mono text-[8px] tracking-[0.08em] text-[rgba(250,248,245,0.55)]">
                        FOLLOWERS
                      </span>
                    </span>
                  </span>
                </span>
              </Tag>
            </li>
          );
        })}
      </ul>
      <Foot>Engagement rate is {RATE_LABEL}.</Foot>
    </Section>
  );
}
