"use client";

import { useMemo, useState } from "react";
import type { DirectoryAthlete } from "@/lib/portal/pages-data";
import { compact, initials } from "@/lib/portal/format";

export default function AthletesGrid({
  athletes,
  schools,
  sports,
}: {
  athletes: DirectoryAthlete[];
  schools: string[];
  sports: string[];
}) {
  const [q, setQ] = useState("");
  const [school, setSchool] = useState("");
  const [sport, setSport] = useState("");

  // 60 is ten rows at the desktop column count. Rendering all 1,501 cards at
  // once is a lot of DOM and, for the leading 300 that have one, 300 headshot
  // requests on first paint.
  const PAGE_SIZE = 60;
  const [limit, setLimit] = useState(PAGE_SIZE);

  // A filter change restarts the count — otherwise a deep limit carried into a
  // narrow filter defeats the paging.
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setLimit(PAGE_SIZE);
    };

  const matched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return athletes.filter((a) => {
      if (school && a.school !== school) return false;
      if (sport && a.sport !== sport) return false;
      if (needle && !a.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [athletes, q, school, sport]);

  const shown = matched.slice(0, limit);
  const more = matched.length - shown.length;

  return (
    <div className="pgd-page">
      <div className="pgd-filters">
        <input
          className="pgd-input"
          type="search"
          value={q}
          onChange={(e) => withReset(setQ)(e.target.value)}
          placeholder="Search athletes…"
          aria-label="Search athletes by name"
        />
        <select
          className="pgd-select"
          value={school}
          onChange={(e) => withReset(setSchool)(e.target.value)}
          aria-label="Filter by school"
        >
          <option value="">All schools</option>
          {schools.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="pgd-select"
          value={sport}
          onChange={(e) => withReset(setSport)(e.target.value)}
          aria-label="Filter by sport"
        >
          <option value="">All sports</option>
          {sports.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="pgd-count">
          {shown.length} of {matched.length}
          {matched.length !== athletes.length ? ` (${athletes.length} total)` : ""}
        </span>
      </div>

      {matched.length === 0 ? (
        <div className="pgd-panel">
          <b className="pgd-empty-h">No athletes match that</b>
          <p className="pgd-card-meta" style={{ marginTop: 8 }}>
            Clear the filters to see everyone.
          </p>
        </div>
      ) : (
        <div className="pgd-people">
          {shown.map((a) => (
            <div className="pgd-person" key={a.key}>
              {a.headshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.headshotUrl} alt="" />
              ) : (
                // No photo on file -> initials, never a stock image.
                <span className="pgd-noface" aria-hidden="true">
                  {initials(a.name)}
                </span>
              )}
              {/* Two lines, neither truncated: name, then school · sport and
                  which campaigns they were on. The figures are their own
                  right-hand column, so a long school name and a follower
                  count are no longer competing for the same width. */}
              <span className="pgd-person-body">
                <span className="pgd-person-name">{a.name}</span>
                {/* Only the facts we have; no separator for absent fields. */}
                {[
                  a.school,
                  a.sport,
                  a.campaigns > 1 ? `${a.campaigns} campaigns` : a.lastCampaign,
                ].filter(Boolean).length > 0 ? (
                  <span className="pgd-person-meta">
                    {[
                      a.school,
                      a.sport,
                      a.campaigns > 1 ? `${a.campaigns} campaigns` : a.lastCampaign,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </span>
              {(a.followers !== null || a.views !== null) && (
                <span className="pgd-person-nums">
                  {a.followers !== null && (
                    <span>
                      <b>{compact(a.followers)}</b>
                      followers
                    </span>
                  )}
                  {a.views !== null && <span>{compact(a.views)} views</span>}
                </span>
              )}
            </div>
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
    </div>
  );
}
