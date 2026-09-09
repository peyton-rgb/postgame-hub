"use client";

import { useState } from "react";
import type { MediaItem } from "@/lib/portal/pages-data";

// Shared media grid + lightbox for the Content gallery and the campaign
// detail Content tab.
//
// FILTERS ARE Photos / Video, NOT the brief's Reels · Posts · Stories · BTS ·
// Photos. There is no column to build those from: `media` has `type`
// (image/video) and a `slot` that is populated on 5 of CVS's 460 rows, with no
// category, no platform and no duration. Deriving a category from a filename
// would be inventing data. Logged in the run log.
export default function MediaGrid({
  items,
  columns = "auto",
  showCampaign = false,
}: {
  items: MediaItem[];
  columns?: "auto" | "wide";
  showCampaign?: boolean;
}) {
  const [kind, setKind] = useState<"all" | "photo" | "video">("all");
  const [open, setOpen] = useState<MediaItem | null>(null);

  const shown = items.filter((m) =>
    kind === "all" ? true : kind === "video" ? m.isVideo : !m.isVideo
  );

  const fresh = (iso: string | null) => {
    if (!iso) return false;
    return Date.now() - new Date(iso).getTime() < 14 * 24 * 60 * 60 * 1000;
  };

  return (
    <>
      <div className="pgd-filters">
        {(["all", "photo", "video"] as const).map((k) => (
          <button
            key={k}
            className={`pgd-pill${kind === k ? " on" : ""}`}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
          >
            {k === "all" ? "All" : k === "photo" ? "Photos" : "Video"}
          </button>
        ))}
        <span className="pgd-count">
          {shown.length} of {items.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="pgd-panel">
          <b style={{ fontSize: 13 }}>Nothing here yet</b>
          <p className="pgd-card-meta" style={{ marginTop: 6 }}>
            Content lands here as it&rsquo;s delivered.
          </p>
        </div>
      ) : (
        <div className={`pgd-media${columns === "wide" ? " pgd-media-2" : ""}`}>
          {shown.map((m) => (
            <button
              key={m.id}
              className="pgd-shot"
              onClick={() => setOpen(m)}
              aria-label={`Open ${m.athleteName ?? "media"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.thumbUrl} alt="" loading="lazy" />
              {m.isVideo && (
                <span className="pgd-play" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              )}
              {fresh(m.createdAt) && <span className="pgd-new">New</span>}
              {(m.athleteName || (showCampaign && m.campaignName)) && (
                <figcaption>
                  {[m.athleteName, showCampaign ? m.campaignName : null]
                    .filter(Boolean)
                    .join(" · ")}
                </figcaption>
              )}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          className="pgd-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Media preview"
          onClick={() => setOpen(null)}
        >
          {open.isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={open.url} controls autoPlay onClick={(e) => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.url} alt="" onClick={(e) => e.stopPropagation()} />
          )}
          <div
            style={{ position: "absolute", left: 18, bottom: 18, display: "flex", gap: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Single-file download. A zip of a multi-select needs a server
                route that streams from Storage; the brief sanctioned shipping
                single-file instead, and that is what this is. */}
            <a className="pgd-btn" href={open.url} target="_blank" rel="noopener noreferrer">
              Open original
            </a>
          </div>
          <button className="pgd-close" onClick={() => setOpen(null)}>
            Close
          </button>
        </div>
      )}
    </>
  );
}
