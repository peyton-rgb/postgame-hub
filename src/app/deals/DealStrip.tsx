"use client";

// ============================================================
// The LATEST strip — deals 2-9 as a row of 4:5 photo cards.
//
// This is the only client component on /deals, and it exists for one reason:
// the arrows. Everything it renders is in the server HTML — a client component
// still server-renders its first paint — so a crawler sees the eight cards and
// their links whether or not the JavaScript ever arrives. The arrows are
// progressive enhancement on top of a row that already scrolls natively.
//
// The row keeps the same bleed as the /clients hero card row: a 1400px
// container with 24px gutters (40px above 640px), 16px between cards.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dealDateShort, initialsOf, thumbUrl } from "@/lib/deal-format";

export type StripDeal = {
  id: string;
  slug: string;
  athlete_name: string | null;
  brand_name: string;
  brand_id: string | null;
  image_url: string | null;
  date_announced: string | null;
  focal_point: string | null;
};

export default function DealStrip({
  deals,
  tintByBrand,
}: {
  deals: StripDeal[];
  tintByBrand: Record<string, string>;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // The arrows disable themselves at the ends rather than wrapping around. A
  // wrap on a list of eight makes it unclear whether you have seen them all,
  // which is the one thing this row is for.
  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const nudge = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    // Two cards at a time, so the row moves a readable amount rather than a
    // full page that loses your place.
    const card = el.querySelector<HTMLElement>(".dl-strip-card");
    const step = card ? (card.offsetWidth + 16) * 2 : el.clientWidth * 0.6;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  if (!deals.length) return null;

  return (
    <section className="dl-strip-section">
      <div className="dl-band">
        <div className="dl-strip-head">
          <h2 className="pg-h2">Latest</h2>
          <div className="dl-strip-controls">
            <a href="#ledger" className="pg-btn dl-strip-seeall">
              See all
            </a>
            <button
              type="button"
              className="dl-strip-arrow"
              onClick={() => nudge(-1)}
              disabled={atStart}
              aria-label="Scroll the latest deals left"
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              className="dl-strip-arrow"
              onClick={() => nudge(1)}
              disabled={atEnd}
              aria-label="Scroll the latest deals right"
            >
              <Chevron dir="right" />
            </button>
          </div>
        </div>
      </div>

      <div className="dl-band">
        <div className="dl-strip-rail" ref={rail} onScroll={measure}>
          {deals.map((d) => {
            const src = thumbUrl(d.image_url, 640);
            const tint = d.brand_id ? tintByBrand[d.brand_id] : undefined;
            return (
              <Link key={d.id} href={`/deals/${d.slug}`} className="dl-strip-card">
                <div className="dl-strip-photo">
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: d.focal_point || "50% 25%" }}
                    />
                  ) : (
                    <div
                      className="dl-thumb-empty"
                      style={{ background: tint ?? "rgba(250,248,245,0.05)" }}
                      aria-hidden="true"
                    >
                      <span className="pg-h3">{initialsOf(d.athlete_name)}</span>
                    </div>
                  )}
                  {/* Design system rule 4: a flat edge on the black ground
                      gets a soft fade so the card dissolves rather than
                      stopping. It sits on the empty bottom of the crop, where
                      the caption is, so it never darkens a face. */}
                  <div className="dl-strip-scrim" aria-hidden="true" />
                  <div className="dl-strip-caption">
                    <div className="pg-eyebrow dl-strip-brand">{d.brand_name}</div>
                    <div className="pg-h3">{d.athlete_name || "Team campaign"}</div>
                    <div className="pg-label dl-strip-date">{dealDateShort(d.date_announced)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}
