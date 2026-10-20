"use client";

import { useState } from "react";
import type { ReportGroup } from "@/lib/portal/pages-data";

// The recap library's client half: a quarter filter over the pre-grouped
// server data. Client-side because the whole library is 10 rows for CVS and a
// round trip per selection would be slower than filtering in place.
export default function RecapLibrary({ groups }: { groups: ReportGroup[] }) {
  const [quarter, setQuarter] = useState("");
  const shown = quarter ? groups.filter((g) => g.label === quarter) : groups;

  return (
    <>
      {/* One group is nothing to filter, so the control does not appear. */}
      {groups.length > 1 && (
        <div className="pgd-filters">
          <select
            className="pgd-select"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            aria-label="Filter by quarter"
          >
            <option value="">All quarters</option>
            {groups.map((g) => (
              <option key={g.label} value={g.label}>
                {g.label}
              </option>
            ))}
          </select>
          <span className="pgd-count">
            {shown.reduce((n, g) => n + g.items.length, 0)} of{" "}
            {groups.reduce((n, g) => n + g.items.length, 0)}
          </span>
        </div>
      )}

      {shown.map((g) => (
        <section key={g.label}>
          <h2 className="pgd-group-h">
            {g.label}
            {/* Say so when the heading came from a delivery date rather than a
                recorded quarter, so nobody reads it as a field someone set. */}
            {g.derived && <span className="pgd-group-note">by delivery date</span>}
          </h2>
          <div className="pgd-recaps">
            {g.items.map((c) => (
              /* Photo, name, button — stacked tight, in that order, and
                 nothing else. The figures that used to sit between the name
                 and the button are what made these cards tall and ragged, and
                 they now live on Reports, where a whole page is given to the
                 numbers. align-self: start so a card is the height of its own
                 contents rather than the tallest card in its row. */
              <div className="pgd-recap" key={c.id}>
                {c.heroUrl ? (
                  <span className="pgd-recap-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.heroUrl} alt="" />
                  </span>
                ) : null}
                <span className="pgd-recap-body">
                  <span className="pgd-card-name">{c.name}</span>
                  {/* The quarter is the heading this card sits under, so it is
                      not repeated. Shown only where the group was derived from
                      delivery dates and the card's own recorded quarter could
                      differ from it. */}
                  {c.quarter && c.quarter !== g.label ? (
                    <span className="pgd-card-meta">{c.quarter}</span>
                  ) : null}
                  {/* "Open recap" only where a slug exists to open. The public
                      recap route is /recap/[slug], a different app surface, so
                      it opens in a new tab and the portal stays put. */}
                  {c.slug ? (
                    <a
                      className="pgd-btn"
                      href={`/recap/${c.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open recap
                    </a>
                  ) : (
                    <span className="pgd-card-meta">Recap not published yet</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
