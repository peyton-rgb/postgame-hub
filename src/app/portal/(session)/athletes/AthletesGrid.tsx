"use client";

import { useMemo, useState } from "react";
import type { DirectoryAthlete } from "@/lib/portal/pages-data";

function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

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

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return athletes.filter((a) => {
      if (school && a.school !== school) return false;
      if (sport && a.sport !== sport) return false;
      if (needle && !a.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [athletes, q, school, sport]);

  return (
    <div className="pgd-page">
      <div className="pgd-filters">
        <input
          className="pgd-input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search athletes…"
          aria-label="Search athletes by name"
        />
        <select
          className="pgd-select"
          value={school}
          onChange={(e) => setSchool(e.target.value)}
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
          onChange={(e) => setSport(e.target.value)}
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
          {shown.length} of {athletes.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="pgd-panel">
          <b style={{ fontSize: 13 }}>No athletes match that</b>
          <p className="pgd-card-meta" style={{ marginTop: 6 }}>
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
              <span className="pgd-person-body">
                <span className="pgd-person-name">{a.name}</span>
                {/* Only the facts we have; no separator for absent fields. */}
                {[a.school, a.sport].filter(Boolean).length > 0 ? (
                  <span className="pgd-person-meta">
                    {[a.school, a.sport].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                <span className="pgd-person-num">
                  {[
                    a.followers !== null ? `${compact(a.followers)} followers` : null,
                    a.views !== null ? `${compact(a.views)} views` : null,
                    a.campaigns > 1 ? `${a.campaigns} campaigns` : a.lastCampaign,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
