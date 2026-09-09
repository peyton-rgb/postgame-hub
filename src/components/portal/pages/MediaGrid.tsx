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
  campaigns,
  athletes,
  schools,
}: {
  items: MediaItem[];
  columns?: "auto" | "wide";
  showCampaign?: boolean;
  /** Option lists for the gallery's dropdowns. Omitted on campaign detail,
      which is already scoped to one campaign, so the selects don't render. */
  campaigns?: string[];
  athletes?: string[];
  schools?: string[];
}) {
  const [kind, setKind] = useState<"all" | "photo" | "video">("all");
  const [campaign, setCampaign] = useState("");
  const [athlete, setAthlete] = useState("");
  const [school, setSchool] = useState("");
  const [open, setOpen] = useState<MediaItem | null>(null);

  // PAGE_SIZE exists because rendering the whole gallery at once means 411
  // <img> tags for CVS. Even lazily loaded that is 411 originals the browser
  // will eventually ask for, and the tiles sit on the placeholder tint until
  // it does — which on this ground reads as a grid of black boxes. 40 is about
  // three screens at the desktop column count, so "Load more" is a deliberate
  // act rather than something you hit immediately.
  const PAGE_SIZE = 40;
  const [limit, setLimit] = useState(PAGE_SIZE);

  const matched = items.filter((m) => {
    if (kind !== "all" && (kind === "video") !== m.isVideo) return false;
    if (campaign && m.campaignName !== campaign) return false;
    if (athlete && m.athleteName !== athlete) return false;
    if (school && m.school !== school) return false;
    return true;
  });

  const shown = matched.slice(0, limit);
  const more = matched.length - shown.length;

  // Any filter change starts the count again — carrying a 400-deep limit into
  // a 6-result filter would silently defeat the paging.
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setLimit(PAGE_SIZE);
    };

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
            onClick={() => withReset(setKind)(k)}
            aria-pressed={kind === k}
          >
            {k === "all" ? "All" : k === "photo" ? "Photos" : "Video"}
          </button>
        ))}
        {/* One <select> per dimension, rendered only when the page supplied
            options for it. Campaign, athlete and school are all real columns;
            each option is a value that actually occurs in these rows. */}
        <Picker label="All campaigns" value={campaign} set={withReset(setCampaign)} options={campaigns} />
        <Picker label="All athletes" value={athlete} set={withReset(setAthlete)} options={athletes} />
        <Picker label="All schools" value={school} set={withReset(setSchool)} options={schools} />

        <span className="pgd-count">
          {shown.length} of {matched.length}
          {matched.length !== items.length ? ` (${items.length} total)` : ""}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="pgd-panel">
          <b className="pgd-empty-h">Nothing here yet</b>
          <p className="pgd-card-meta" style={{ marginTop: 8 }}>
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
              <img
                src={m.thumbUrl}
                alt=""
                loading="lazy"
                // The transform endpoint is a separate service from object
                // storage and can fail on an object storage will still serve.
                // One retry with the original, guarded by a flag so a broken
                // original cannot loop.
                onError={(e) => {
                  const el = e.currentTarget;
                  if (!m.thumbFallbackUrl || el.dataset.fellBack) return;
                  el.dataset.fellBack = "1";
                  el.src = m.thumbFallbackUrl;
                }}
              />
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

      {more > 0 && (
        <div className="pgd-more-row">
          <button
            type="button"
            className="pgd-btn"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
          >
            Load {Math.min(more, PAGE_SIZE)} more
          </button>
          <span className="pgd-card-meta">{more} remaining</span>
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

/** A filter select that renders nothing when the page has no options for it. */
function Picker({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  options?: string[];
}) {
  // 1 option filters nothing, so it is a control with no purpose.
  if (!options || options.length < 2) return null;
  return (
    <select
      className="pgd-select"
      value={value}
      onChange={(e) => set(e.target.value)}
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
