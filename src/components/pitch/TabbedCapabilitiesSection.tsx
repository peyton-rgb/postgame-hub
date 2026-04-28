"use client";

import { useState } from "react";
import type { TabbedCapabilitiesSectionData } from "@/types/pitch";

/**
 * Tabbed variant of the Capabilities section.
 *
 * Shows the section heading + description, then a row of tabs (one per
 * capability item) — clicking a tab swaps the panel content below.
 * Uses the same data shape as CapabilitiesSectionData.
 *
 * Client component (state for active tab).
 */
export default function TabbedCapabilitiesSection({
  data,
}: {
  data: TabbedCapabilitiesSectionData;
}) {
  const [active, setActive] = useState(0);
  if (!data.visible) return null;
  if (!data.items || data.items.length === 0) return null;

  const item = data.items[active] ?? data.items[0];

  return (
    <section className="pitch-tab-cap wrap">
      <div className="pitch-tab-cap__head">
        <h2
          className="pitch-tab-cap__heading"
          dangerouslySetInnerHTML={{ __html: data.heading }}
        />
        <p className="pitch-tab-cap__desc">{data.description}</p>
      </div>

      <div
        className="pitch-tab-cap__tabs"
        role="tablist"
        aria-label="Capabilities"
      >
        {data.items.map((it, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            className={`pitch-tab-cap__tab${
              i === active ? " pitch-tab-cap__tab--active" : ""
            }`}
            onClick={() => setActive(i)}
            type="button"
          >
            <span className="pitch-tab-cap__tab-num">{it.index}</span>
            <span className="pitch-tab-cap__tab-title">{it.title}</span>
          </button>
        ))}
      </div>

      <div className="pitch-tab-cap__panel" role="tabpanel" key={active}>
        <div className="pitch-tab-cap__panel-num">{item.index}</div>
        <h3 className="pitch-tab-cap__panel-title">{item.title}</h3>
        <p className="pitch-tab-cap__panel-desc">{item.description}</p>
      </div>
    </section>
  );
}
