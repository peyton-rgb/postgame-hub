"use client";

import { useEffect, useState } from "react";
import type { WhyYouUpcomingCampaign } from "@/types/pitch";

/**
 * Auto-rotating single-card carousel for the WhyYou section's
 * "what we'd line up" block.
 *
 * One card is visible at a time. Every `intervalMs` (default 3000)
 * the active index advances by one (looping). The card fades + slides
 * between values via a CSS transition keyed on the active index.
 *
 * Each card renders the brand logo (logo_light_url from the brands
 * table, supplied as `logoUrl` on the campaign), the brand name, and
 * an optional subtitle. Dots underneath show progress.
 */
export default function CampaignCarousel({
  campaigns,
  intervalMs = 3000,
}: {
  campaigns: WhyYouUpcomingCampaign[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || campaigns.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % campaigns.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [campaigns.length, intervalMs, paused]);

  if (!campaigns || campaigns.length === 0) return null;
  const active = campaigns[index];

  return (
    <div
      className="campaign-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="campaign-carousel__viewport">
        {/* `key={index}` re-mounts the card on each tick so the CSS
            transition runs again. */}
        <article className="campaign-carousel__card" key={index}>
          {active.logoUrl ? (
            <img
              className="campaign-carousel__logo"
              src={active.logoUrl}
              alt={active.title}
            />
          ) : (
            <div className="campaign-carousel__logo-fallback">
              {active.title}
            </div>
          )}
          <div className="campaign-carousel__name">{active.title}</div>
          {active.subtitle ? (
            <div className="campaign-carousel__sub">{active.subtitle}</div>
          ) : null}
        </article>
      </div>

      {campaigns.length > 1 ? (
        <div
          className="campaign-carousel__dots"
          role="tablist"
          aria-label="Brand campaigns"
        >
          {campaigns.map((c, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={c.title}
              className={`campaign-carousel__dot${
                i === index ? " campaign-carousel__dot--active" : ""
              }`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
