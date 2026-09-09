"use client";

import { useMemo, useState } from "react";
import { compact, initials } from "@/lib/portal/format";
import type { ReportsMetrics, ReportRow } from "@/lib/portal/pages-data";

// Reports: the numbers across a brand's wrapped campaigns, for a chosen period.
//
// NOTHING HERE IS INVENTED. Every figure comes from a query; a column is
// dropped when no row has it; a cell is blank rather than 0 when nobody
// reported that metric; and a comparison line appears only where a prior
// period exists AND carries the same figure. A zero in a metrics table is a
// claim, and "we never measured this" is not that claim.

type SortKey =
  | "name"
  | "quarter"
  | "athletes"
  | "posts"
  | "reelViews"
  | "impressions"
  | "followers";

const COLUMN_LABEL: Record<SortKey, string> = {
  name: "Campaign",
  quarter: "Quarter",
  athletes: "Athletes",
  posts: "Posts",
  reelViews: "Reel views",
  impressions: "Impressions",
  followers: "Followers",
};

/** RFC 4180 quoting: a field containing a comma, quote or newline is quoted. */
function csvCell(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ReportsDashboard({ data }: { data: ReportsMetrics }) {
  const [sort, setSort] = useState<SortKey>("quarter");
  const [desc, setDesc] = useState(true);
  /** Which quarter the pointer is on, for the chart's hover values. */
  const [hover, setHover] = useState<string | null>(null);

  const cols = data.columns;
  const shownCols = useMemo(
    () =>
      (
        [
          "name",
          "quarter",
          "athletes",
          "posts",
          "reelViews",
          "impressions",
          "followers",
        ] as SortKey[]
      ).filter((k) => k === "name" || k === "quarter" || cols[k as keyof typeof cols]),
    [cols]
  );

  const rows = useMemo(() => {
    const out = [...data.rows];
    out.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "quarter") return a.quarterSort - b.quarterSort || a.name.localeCompare(b.name);
      // Nulls sort last in BOTH directions: an absent measurement is not a
      // small one, so it does not belong at the top of a descending sort.
      const av = a[sort] as number | null;
      const bv = b[sort] as number | null;
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });
    if (desc) {
      const keyed = sort === "name" || sort === "quarter";
      const withValue = out.filter((r) => keyed || r[sort] !== null);
      const without = out.filter((r) => !(keyed || r[sort] !== null));
      return [...withValue.reverse(), ...without];
    }
    return out;
  }, [data.rows, sort, desc]);

  const click = (k: SortKey) => {
    if (k === sort) return setDesc((d) => !d);
    setSort(k);
    // Text sorts read better ascending, figures descending.
    setDesc(k !== "name");
  };

  const cell = (r: ReportRow, k: SortKey) => {
    if (k === "name") return r.name;
    if (k === "quarter") return r.quarter ?? "";
    const v = r[k] as number | null;
    return v === null ? "" : compact(v);
  };

  const exportCsv = () => {
    // Raw numbers, not the compacted display strings: "8M" is useless in a
    // spreadsheet. The filename carries the period so two exports don't
    // overwrite each other in a downloads folder.
    const header = shownCols.map((k) => COLUMN_LABEL[k]);
    const body = rows.map((r) =>
      shownCols.map((k) => {
        if (k === "name") return r.name;
        if (k === "quarter") return r.quarter ?? "";
        return r[k] as number | null;
      })
    );
    const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const slug = data.periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `postgame-campaign-metrics-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // GROUPED VERTICAL BARS, TWO SCALES. Posts run in the hundreds and reel
  // views in the millions on the same data, so one shared scale draws every
  // posts bar as a hairline — honest and unreadable. Each series is scaled to
  // its own maximum and the legend says so.
  const postsMax = Math.max(1, ...data.quarters.map((q) => q.posts));
  const viewsMax = Math.max(1, ...data.quarters.map((q) => q.reelViews));
  const active = data.quarters.find((q) => q.label === hover) ?? null;

  return (
    <div className="pgd-page">
      {/* ---- header controls: period + export ---- */}
      <div className="pgd-report-bar">
        <div className="pgd-periods" role="group" aria-label="Time period">
          {data.options.map((o) => (
            <a
              key={o.key}
              // Links, not buttons: the period lives in the URL, so a filtered
              // view is shareable and the back button steps through periods.
              href={o.key === "all" ? "/portal/reports" : `/portal/reports?period=${o.key}`}
              className={`pgd-pill${data.period === o.key ? " on" : ""}`}
              aria-current={data.period === o.key ? "true" : undefined}
            >
              {o.label}
            </a>
          ))}
        </div>
        <button type="button" className="pgd-btn" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {/* ---- six KPI tiles ---- */}
      {data.kpis.length > 0 && (
        <div className="pgd-kpi-grid">
          {data.kpis.map((k) => (
            <section className="pgd-tile pgd-kpi-tile" key={k.label}>
              <b className="pgd-kpi-value">{k.value}</b>
              <span className="pgd-kpi-label">{k.label}</span>
              {k.sub ? <span className="pgd-kpi-sub">{k.sub}</span> : null}
              {/* Only where a prior period exists and carries this figure. */}
              {k.compare ? (
                <span className={`pgd-kpi-cmp${k.compare.up ? " up" : " down"}`}>
                  <span aria-hidden="true">{k.compare.up ? "▲" : "▼"}</span>{" "}
                  {k.compare.text} vs {k.compare.label}
                </span>
              ) : null}
            </section>
          ))}
        </div>
      )}

      <div className="pgd-report-split">
        {/* ---- grouped bar chart ---- */}
        {data.quarters.length > 0 && (
          <section className="pgd-panel">
            <h3>By quarter</h3>
            <div className="pgd-legend">
              <span className="pgd-legend-key">
                <i className="pgd-swatch pgd-swatch-posts" aria-hidden="true" /> Posts
              </span>
              <span className="pgd-legend-key">
                <i className="pgd-swatch pgd-swatch-views" aria-hidden="true" /> Reel views
              </span>
              <span className="pgd-legend-note">each series to its own scale</span>
            </div>

            {/* Hover values live in one readout above the chart rather than in
                a floating tooltip: a tooltip that follows the pointer covers
                the bars it is describing, and on a touch screen it never
                appears at all. The readout is keyboard-reachable too. */}
            <div className="pgd-readout" aria-live="polite">
              {active ? (
                <>
                  <b>{active.label}</b>
                  {/* Only the series that HAS a figure. Q4 2025 has posts and
                      no reel views, and printing "0 reel views" asserts a
                      measurement nobody took — the same rule the bars follow
                      by drawing nothing. */}
                  {active.posts > 0 && <span>{compact(active.posts)} posts</span>}
                  {active.reelViews > 0 && <span>{compact(active.reelViews)} reel views</span>}
                  {active.posts === 0 && active.reelViews === 0 && (
                    <span className="pgd-readout-idle">no figures reported</span>
                  )}
                </>
              ) : (
                <span className="pgd-readout-idle">
                  Hover or focus a quarter for its figures
                </span>
              )}
            </div>

            <div className="pgd-bars" onMouseLeave={() => setHover(null)}>
              {data.quarters.map((q) => (
                <div
                  className={`pgd-bar-group${hover === q.label ? " on" : ""}`}
                  key={q.label}
                  onMouseEnter={() => setHover(q.label)}
                  onFocus={() => setHover(q.label)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${q.label}: ${q.posts} posts, ${q.reelViews} reel views`}
                >
                  <span className="pgd-bar-pair">
                    {/* A series with nothing in it draws no bar: a zero-height
                        bar reading 0 asserts a measurement nobody took. */}
                    {q.posts > 0 && (
                      <span
                        className="pgd-bar pgd-bar-posts"
                        style={{ height: `${Math.max(2, (q.posts / postsMax) * 100)}%` }}
                      />
                    )}
                    {q.reelViews > 0 && (
                      <span
                        className="pgd-bar pgd-bar-views"
                        style={{ height: `${Math.max(2, (q.reelViews / viewsMax) * 100)}%` }}
                      />
                    )}
                  </span>
                  <span className="pgd-bar-label">{q.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="pgd-report-side">
          {/* ---- where the views came from ---- */}
          {data.surfaces.length > 0 && (
            <section className="pgd-panel">
              <h3>Where the views came from</h3>
              <div className="pgd-surfaces">
                {data.surfaces.map((s) => (
                  <div className="pgd-surface" key={s.label}>
                    <span className="pgd-surface-head">
                      <b>{s.label}</b>
                      <em>{s.display}</em>
                    </span>
                    <span className="pgd-surface-track">
                      <span
                        className="pgd-surface-fill"
                        style={{ width: `${Math.max(1, s.share * 100)}%` }}
                      />
                    </span>
                    <span className="pgd-surface-foot">
                      {Math.round(s.share * 100)}% · {s.metric} · {compact(s.athletes)} athletes
                    </span>
                  </div>
                ))}
              </div>
              {/* The caveat is the point: these are two different
                  measurements, and a brand comparing them should know. */}
              <p className="pgd-figs-note">
                Reels and TikTok report views; Feed and Stories report
                impressions. Share is of reported reach across the four.
              </p>
            </section>
          )}

          {/* ---- best quarter ---- */}
          {data.bestQuarter && (
            <section className="pgd-panel pgd-best">
              <h3>Best quarter</h3>
              <b className="pgd-best-q">{data.bestQuarter.label}</b>
              <p className="pgd-best-line">
                {data.bestQuarter.reelViews} reel views — {Math.round(data.bestQuarter.share * 100)}%
                of the period&rsquo;s total — from {data.bestQuarter.posts} posts.
              </p>
            </section>
          )}
        </div>
      </div>

      {/* ---- campaign table ---- */}
      {data.rows.length > 0 && (
        <section className="pgd-panel">
          <h3>
            Campaigns
            <span className="pgd-group-note">{data.rows.length}</span>
          </h3>
          <div className="pgd-table-scroll">
            <table className="pgd-table">
              <thead>
                <tr>
                  {shownCols.map((k) => (
                    <th
                      key={k}
                      scope="col"
                      className={k === "name" || k === "quarter" ? undefined : "pgd-num-col"}
                      aria-sort={sort === k ? (desc ? "descending" : "ascending") : "none"}
                    >
                      <button
                        type="button"
                        onClick={() => click(k)}
                        aria-label={`Sort by ${COLUMN_LABEL[k]}`}
                        className={sort === k ? "on" : undefined}
                      >
                        {COLUMN_LABEL[k]}
                        <span aria-hidden="true">{sort === k ? (desc ? " ↓" : " ↑") : ""}</span>
                      </button>
                    </th>
                  ))}
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.campaignId}>
                    {shownCols.map((k) => (
                      <td
                        key={k}
                        className={k === "name" || k === "quarter" ? undefined : "pgd-num-col"}
                      >
                        {cell(r, k)}
                      </td>
                    ))}
                    <td className="pgd-num-col">
                      {/* The public recap is a different app surface, so it
                          opens in a new tab and the portal stays put. */}
                      {r.slug ? (
                        <a href={`/recap/${r.slug}`} target="_blank" rel="noopener noreferrer">
                          Open recap
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- top athletes ---- */}
      {data.topAthletes.length > 0 && (
        <section className="pgd-panel">
          <h3>
            Top athletes
            <span className="pgd-group-note">by reel views</span>
          </h3>
          <div className="pgd-tops">
            {data.topAthletes.map((a, i) => {
              const body = (
                <>
                  <span className="pgd-r" aria-hidden="true">
                    {i + 1}
                  </span>
                  {a.headshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.headshotUrl} alt="" />
                  ) : (
                    // No photo on file -> initials. Never a stock face.
                    <span className="pgd-nothumb">{initials(a.name)}</span>
                  )}
                  <div>
                    <b>{a.name}</b>
                    <small>{[a.school, a.sport, a.campaignName].filter(Boolean).join(" · ")}</small>
                  </div>
                  <div className="pgd-v pgd-v-inline">
                    <b>{compact(a.views)}</b> views
                  </div>
                </>
              );
              return a.postUrl ? (
                <a
                  className="pgd-post"
                  key={a.athleteId}
                  href={a.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {body}
                </a>
              ) : (
                <div className="pgd-post" key={a.athleteId}>
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.kpis.length === 0 && data.rows.length === 0 && (
        <div className="pgd-panel">
          <b className="pgd-empty-h">Nothing wrapped in {data.periodLabel.toLowerCase()}</b>
          <p className="pgd-card-meta" style={{ marginTop: 8 }}>
            Figures appear here as campaigns wrap and their recaps are built.
          </p>
        </div>
      )}
    </div>
  );
}
