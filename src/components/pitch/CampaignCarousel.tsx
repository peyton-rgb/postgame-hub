"use client";

import { useEffect, useRef, useState } from "react";
import type { WhyYouUpcomingCampaign } from "@/types/pitch";

/**
 * 3-card auto-rotating carousel for the WhyYou section's "what we'd
 * line up" block.
 *
 * Mechanics:
 *  - 3 cards visible at a time on desktop (2 on tablet, 1 on phone).
 *  - Every `intervalMs` (default 3000ms): the track slides left by ONE
 *    card-width via CSS transform transition. When the slide finishes,
 *    we instantly snap the transform back to 0 AND rotate the items
 *    array so the leftmost card moves to the end. Visually seamless.
 *  - Pauses on mouse hover.
 *  - Dots underneath show which original campaign is in the leftmost
 *    visible slot.
 */
export default function CampaignCarousel({
  campaigns,
  intervalMs = 3000,
}: {
  campaigns: WhyYouUpcomingCampaign[];
  intervalMs?: number;
}) {
  const [items, setItems] = useState<WhyYouUpcomingCampaign[]>(campaigns);
  const [activeStart, setActiveStart] = useState(0);
  const [shiftPx, setShiftPx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [paused, setPaused] = useState(false);
  const firstCardRef = useRef<HTMLElement | null>(null);

  // Re-sync items when campaigns prop changes.
  useEffect(() => {
    setItems(campaigns);
    setActiveStart(0);
    setShiftPx(0);
    setAnimating(false);
  }, [campaigns]);

  useEffect(() => {
    if (paused) return;
    if (!campaigns || campaigns.length <= 3) return;
    const id = setInterval(() => {
      const cardEl = firstCardRef.current;
      if (!cardEl) return;
      // Card width + gap (must match CSS gap value).
      const cardWidth = cardEl.getBoundingClientRect().width + 14;
      // 1. Slide the track left by one card-width with transition.
      setAnimating(true);
      setShiftPx(cardWidth);
      // 2. After the slide completes, snap back: rotate items + reset.
      const t = setTimeout(() => {
        setItems((arr) => [...arr.slice(1), arr[0]]);
        setActiveStart((s) => (s + 1) % campaigns.length);
        setAnimating(false);
        setShiftPx(0);
      }, 620);
      return () => clearTimeout(t);
    }, intervalMs);
    return () => clearInterval(id);
  }, [paused, intervalMs, campaigns]);

  if (!campaigns || campaigns.length === 0) return null;

  const trackStyle: React.CSSProperties = {
    transform: `translateX(-${shiftPx}px)`,
    transition: animating
      ? "transform 600ms cubic-bezier(.16, .8, .24, 1)"
      : "none",
  };

  return (
    <div
      className="campaign-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="campaign-carousel__viewport">
        <div className="campaign-carousel__track" style={trackStyle}>
          {items.map((c, i) => (
            <article
              key={`${c.title}-${i}`}
              ref={i === 0 ? firstCardRef : undefined}
              className="campaign-carousel__card"
            >
              {c.logoUrl ? (
                <img
                  className="campaign-carousel__logo"
                  src={c.logoUrl}
                  alt={c.title}
                />
              ) : (
                <div className="campaign-carousel__logo-fallback">
                  {c.title}
                </div>
              )}
              <div className="campaign-carousel__name">{c.title}</div>
              {c.subtitle ? (
                <div className="campaign-carousel__sub">{c.subtitle}</div>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      {campaigns.length > 3 ? (
        <div
          className="campaign-carousel__dots"
          role="tablist"
          aria-label="Brand campaigns"
        >
          {campaigns.map((c, i) => (
            <span
              key={i}
              role="tab"
              aria-selected={i === activeStart}
              aria-label={c.title}
              className={`campaign-carousel__dot${
                i === activeStart ? " campaign-carousel__dot--active" : ""
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
