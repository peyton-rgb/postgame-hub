"use client";

import { useMemo, useState } from "react";
import { compact } from "@/lib/portal/format";
import type { ReportsMetrics, ReportRow } from "@/lib/portal/pages-data";

// Reports: one page of numbers across every wrapped campaign.
//
// NOTHING HERE IS INVENTED. Every figure comes from a query, a column is
// dropped when no row has it, and a cell is blank rather than 0 when nobody
// reported that metric — a zero in a metrics table is a claim, and "we never
// measured this" is not that claim.

type SortKey = "name" | "quarter" | "athletes" | "posts" | "reelViews" | "impressions" | "followers";

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

  const cols = data.columns;
  const shownCols = useMemo(
    () =>
      (["name", "quarter", "athletes", "posts", "reelViews", "impressions", "followers"] as SortKey[]).filter(
        (k) => k === "name" || k === "quarter" || cols[k as keyof typeof cols]
      ),
    [cols]
  );

  const rows = useMemo(() => {
    const out = [...data.rows];
    out.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "quarter") return a.quarterSort - b.quarterSort || a.name.localeCompare(b.name);
      // Nulls sort last in both directions: an absent measurement is not a
      // small one, so it does not belong at the top of a descending sort.
      const av = a[sort] as number | null;
      const bv = b[sort] as number | null;
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });
    if (desc) {
      // Reverse only the rows that carry a value, so nulls stay at the bottom.
      const withValue = out.filter((r) => sort === "name" || sort === "quarter" || r[sort] !== null);
      const without = out.filter((r) => !(sort === "name" || sort === "quarter" || r[sort] !== null));
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
    // Raw numbers in the CSV, not the compacted display strings: "8M" is
    // useless in a spreadsheet.
    const header = shownCols.map((k) => COLUMN_LABEL[k]);
    const body = rows.map((r) =>
      shownCols.map((k) => {
        if (k === "name") return r.name;
        if (k === "quarter") return r.quarter ?? "";
        return r[k] as number | null;
      })
    );
    const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
    // A Blob and a synthetic click: this is a same-origin app page, so the
    // download works without a round trip to build the file server-side.
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `postgame-campaign-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const chartMax = Math.max(1, ...data.quarters.map((q) => Math.max(q.posts, 0)));
  const viewsMax = Math.max(1, ...data.quarters.map((q) => Math.max(q.reelViews, 0)));

  return (
    <div className="pgd-page">
      {data.totals.length > 0 && (
        <section className="pgd-panel">
          <h3>Across every wrapped campaign</h3>
          <div className="pgd-figs">
            {data.totals.map((t) => (
              <span className="pgd-stat" key={t.label}>
                <b>{t.value}</b>
                <span>
                  {t.label}
                  {t.sub ? <em className="pgd-fig-sub">{t.sub}</em> : null}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* The chart. Two series per quarter, drawn as bars against their own
          scale — posts are in the hundreds and reel views in the millions, so
          one shared scale would flatten posts to nothing. Each series is
          labelled with its own maximum so the heights are readable as
          quantities rather than decoration. */}
      {data.quarters.length > 0 && (
        <section className="pgd-panel">
          <h3>
            By quarter
            <span className="pgd-group-note">
              posts and reel views, each to its own scale
            </span>
          </h3>
          <div className="pgd-chart-rows">
            {data.quarters.map((q) => (
              <div className="pgd-chart-row" key={q.label}>
                <span className="pgd-chart-label">{q.label}</span>
                <span className="pgd-chart-bars">
                  {/* A SERIES WITH NOTHING IN IT DRAWS NO BAR. Q4 2025 has 63
                      posts and no reel views on this data, and a bar reading
                      "0 reel views" asserts a measurement of zero where the
                      truth is that nobody reported one.

                      The value sits OUTSIDE the bar so the bar can be its true
                      width — a label inside forces a minimum width, which was
                      making 63 posts look like a quarter of 265 instead of a
                      fifth. */}
                  {q.posts > 0 && (
                    <span className="pgd-chart-line">
                      {/* The bar is a % of its TRACK, and the value has a
                          reserved column beside it — otherwise the longest
                          bar is 100% of the row and pushes its own label off
                          the edge, which is what "19M reel views" did. */}
                      <span className="pgd-chart-track">
                        <span
                          className="pgd-chart-bar pgd-chart-posts"
                          style={{ width: `${(q.posts / chartMax) * 100}%` }}
                        />
                      </span>
                      <em>{compact(q.posts)} posts</em>
                    </span>
                  )}
                  {q.reelViews > 0 && (
                    <span className="pgd-chart-line">
                      {/* The bar is a % of its TRACK, and the value has a
                          reserved column beside it — otherwise the longest
                          bar is 100% of the row and pushes its own label off
                          the edge, which is what "19M reel views" did. */}
                      <span className="pgd-chart-track">
                        <span
                          className="pgd-chart-bar pgd-chart-views"
                          style={{ width: `${(q.reelViews / viewsMax) * 100}%` }}
                        />
                      </span>
                      <em>{compact(q.reelViews)} reel views</em>
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.rows.length > 0 && (
        <section className="pgd-panel">
          <h3>
            Campaigns
            <span className="pgd-group-note">{data.rows.length}</span>
          </h3>
          <div className="pgd-table-actions">
            <button type="button" className="pgd-btn" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
          <div className="pgd-table-scroll">
            <table className="pgd-table">
              <thead>
                <tr>
                  {shownCols.map((k) => (
                    <th key={k} scope="col" className={k === "name" || k === "quarter" ? undefined : "pgd-num-col"}>
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
                      <td key={k} className={k === "name" || k === "quarter" ? undefined : "pgd-num-col"}>
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

      {data.topAthletes.length > 0 && (
        <section className="pgd-panel">
          <h3>
            Top athletes
            <span className="pgd-group-note">by reel views</span>
          </h3>
          {data.topAthletes.map((a, i) => {
            const row = (
              <>
                <span className="pgd-r" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <b>{a.name}</b>
                  <small>{[a.school, a.campaignName].filter(Boolean).join(" · ")}</small>
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
                {row}
              </a>
            ) : (
              <div className="pgd-post" key={a.athleteId}>
                {row}
              </div>
            );
          })}
        </section>
      )}

      {data.totals.length === 0 && data.rows.length === 0 && (
        <div className="pgd-panel">
          <b className="pgd-empty-h">No wrapped campaigns yet</b>
          <p className="pgd-card-meta" style={{ marginTop: 8 }}>
            Figures appear here as campaigns wrap and their recaps are built.
          </p>
        </div>
      )}
    </div>
  );
}
