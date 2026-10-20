"use client";

import { useMemo, useState } from "react";
import type { CampaignListItem } from "@/lib/portal/pages-data";

// Campaigns list.
//
// TWO SECTIONS, Live then Wrapped, because that is the only split a brand
// actually navigates by — "what is running" and "what came back". The state
// filter pills are still here for narrowing to one of them, but the default
// view no longer interleaves a live campaign with a recap from two quarters
// ago and leaves you to read the chips to tell them apart.
//
// UNIFORM CARDS. Every card has a header band of the same height: the hero
// photo where the recap has one, and for a live campaign — which has no hero
// media anywhere in this data — a dark gradient carrying the two facts it does
// have, quarter and type, with the name in Bebas over it. Before this, live
// cards had no band at all and sat as short cards beside tall ones.
//
// Filtering is client-side: the whole list is already loaded (52 rows for CVS)
// and a round trip per pill would be slower than the filter itself.

/** One card. Same markup for both sections; only the band differs. */
function Card({ c }: { c: CampaignListItem }) {
  const href = c.slug ? `/portal/campaigns/${c.slug}` : undefined;
  const Tag = href ? "a" : "div";
  const meta = [c.quarter, c.campaignType].filter(Boolean).join(" · ");

  return (
    <Tag className="pgd-card" {...(href ? { href } : {})}>
      {c.heroUrl ? (
        <span className="pgd-card-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.heroUrl} alt="" />
        </span>
      ) : (
        <span className="pgd-card-band">
          {meta ? <span className="pgd-band-meta">{meta}</span> : null}
          <span className="pgd-band-name">{c.name}</span>
        </span>
      )}

      <span className="pgd-card-body">
        {/* The name is in the band on a card that has no photo, so repeating
            it in the body would print it twice. */}
        {c.heroUrl ? <span className="pgd-card-name">{c.name}</span> : null}

        {/* Meta line is omitted entirely when there is nothing true to put in
            it. An empty "·" separator line is worse than no line. */}
        {c.heroUrl && (meta || c.athletes > 0) ? (
          <span className="pgd-card-meta">
            {[meta || null, c.athletes > 0 ? `${c.athletes} athletes` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : !c.heroUrl && c.athletes > 0 ? (
          <span className="pgd-card-meta">{c.athletes} athletes</span>
        ) : null}

        <span className="pgd-card-foot">
          {/* Figures only where the recap actually carries them. */}
          {c.figures.map((f) => (
            <span className="pgd-stat" key={f.label}>
              <b>{f.value}</b>
              <span>{f.label}</span>
            </span>
          ))}
          {/* State as a coloured word, not a pill. */}
          <span
            className={c.live ? "pgd-state-live" : "pgd-state-wrapped"}
            style={{ marginLeft: "auto" }}
          >
            {c.live ? "Live" : "Wrapped"}
          </span>
        </span>
      </span>
    </Tag>
  );
}

export default function CampaignsGrid({

  items,
  quarters,
}: {
  items: CampaignListItem[];
  quarters: string[];
}) {
  const [state, setState] = useState<"all" | "live" | "wrapped">("all");
  const [quarter, setQuarter] = useState("");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (state === "live" && !i.live) return false;
      if (state === "wrapped" && i.live) return false;
      if (quarter && i.quarter !== quarter) return false;
      if (needle && !i.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, state, quarter, q]);

  const live = shown.filter((c) => c.live);
  const wrapped = shown.filter((c) => !c.live);

  return (
    <div className="pgd-page">
      <div className="pgd-filters">
        {(["all", "live", "wrapped"] as const).map((s) => (
          <button
            key={s}
            className={`pgd-pill${state === s ? " on" : ""}`}
            onClick={() => setState(s)}
            aria-pressed={state === s}
          >
            {s === "all" ? "All" : s === "live" ? "Live" : "Wrapped"}
          </button>
        ))}
        {quarters.length > 0 && (
          <select
            className="pgd-select"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            aria-label="Filter by quarter"
          >
            <option value="">All quarters</option>
            {quarters.map((qq) => (
              <option key={qq} value={qq}>
                {qq}
              </option>
            ))}
          </select>
        )}
        <input
          className="pgd-input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search campaigns…"
          aria-label="Search campaigns by name"
        />
        <span className="pgd-count">
          {shown.length} of {items.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="pgd-panel">
          <b className="pgd-empty-h">No campaigns match that</b>
          <p className="pgd-card-meta" style={{ marginTop: 8 }}>
            Clear the filters to see everything.
          </p>
        </div>
      ) : (
        <>
          {/* A section heading appears only when that section has cards in
              it, so filtering to Wrapped doesn't leave an empty "Live" rule
              across the page. */}
          {live.length > 0 && (
            <>
              <h2 className="pgd-group-h">
                Live
                <span className="pgd-group-note">{live.length}</span>
              </h2>
              <div className="pgd-cards">
                {live.map((c) => (
                  <Card c={c} key={c.id} />
                ))}
              </div>
            </>
          )}
          {wrapped.length > 0 && (
            <>
              <h2 className="pgd-group-h">
                Wrapped
                <span className="pgd-group-note">{wrapped.length}</span>
              </h2>
              <div className="pgd-cards">
                {wrapped.map((c) => (
                  <Card c={c} key={c.id} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
