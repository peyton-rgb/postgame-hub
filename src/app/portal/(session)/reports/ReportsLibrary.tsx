"use client";

import { useState } from "react";
import type { ReportGroup } from "@/lib/portal/pages-data";

// The recap library's client half: a quarter filter over the pre-grouped
// server data. Client-side because the whole library is 10 rows for CVS and a
// round trip per selection would be slower than filtering in place.
export default function ReportsLibrary({ groups }: { groups: ReportGroup[] }) {
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
          <div className="pgd-cards">
            {g.items.map((c) => (
              <div
                className={`pgd-card${c.heroUrl ? "" : " pgd-card-noimg"}`}
                key={c.id}
              >
                {c.heroUrl ? (
                  <span className="pgd-card-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.heroUrl} alt="" />
                  </span>
                ) : null}
                <span className="pgd-card-body">
                  <span className="pgd-card-name">{c.name}</span>
                  {c.quarter ? <span className="pgd-card-meta">{c.quarter}</span> : null}
                  <span className="pgd-card-foot">
                    {c.figures.map((f) => (
                      <span className="pgd-stat" key={f.label}>
                        <b>{f.value}</b>
                        <span>{f.label}</span>
                      </span>
                    ))}
                    {/* "Open recap" only where a slug exists to open. The
                        public recap route is /recap/[slug]. */}
                    {c.slug ? (
                      <a
                        className="pgd-btn"
                        href={`/recap/${c.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginLeft: "auto" }}
                      >
                        Open recap
                      </a>
                    ) : null}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
