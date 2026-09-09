"use client";

import { useMemo, useState } from "react";
import type { CampaignListItem } from "@/lib/portal/pages-data";

// Filtering is client-side: the whole list is already loaded (52 rows for CVS)
// and a round trip per pill would be slower than the filter itself.
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
          <b style={{ fontSize: 13 }}>No campaigns match that</b>
          <p className="pgd-card-meta" style={{ marginTop: 6 }}>
            Clear the filters to see everything.
          </p>
        </div>
      ) : (
        <div className="pgd-cards">
          {shown.map((c) => {
            const href = c.slug ? `/portal/campaigns/${c.slug}` : undefined;
            const Tag = href ? "a" : "div";
            return (
              <Tag key={c.id} className="pgd-card" {...(href ? { href } : {})}>
                {/* Wrapped cards carry the hero thumbnail. Live campaigns have no
                    hero media on this data, so they get no image slot at all
                    rather than an empty grey rectangle. */}
                {!c.live && c.heroUrl ? (
                  <span className="pgd-card-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.heroUrl} alt="" />
                  </span>
                ) : null}

                <span className="pgd-card-body">
                  <span className="pgd-card-name">{c.name}</span>

                  {/* Meta line is omitted entirely when there is nothing true to
                      put in it — no quarter, no type, no roster. An empty
                      "·" separator line is worse than no line. */}
                  {[c.quarter, c.campaignType].filter(Boolean).length > 0 ||
                  c.athletes > 0 ? (
                    <span className="pgd-card-meta">
                      {[
                        c.quarter,
                        c.campaignType,
                        c.athletes > 0 ? `${c.athletes} athletes` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}

                  <span className="pgd-card-foot">
                    {/* Figures only where the recap actually carries them. */}
                    {c.figures.map((f) => (
                      <span className="pgd-stat" key={f.label}>
                        <b>{f.value}</b>
                        <span>{f.label}</span>
                      </span>
                    ))}
                    <span
                      className={c.live ? "pgd-chip-live" : "pgd-chip-wrapped"}
                      style={{ marginLeft: "auto" }}
                    >
                      {c.live ? "Live" : "Wrapped"}
                    </span>
                  </span>
                </span>
              </Tag>
            );
          })}
        </div>
      )}
    </div>
  );
}
