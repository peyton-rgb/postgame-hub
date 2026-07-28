"use client";

// ============================================================
// /board — docket strip
//
// Pulls the next ~14 days from /api/board/docket (Google Calendar
// merged with board_tasks due dates). Degrades gracefully: if the
// Hub's Google token has no Calendar scope, the API returns a
// `needsCalendar` flag and whatever task due-dates it could find.
// ============================================================

import { useEffect, useState } from "react";

interface DocketRow {
  date: string; // e.g. "MON 07/13"
  body: string;
  time: string | null; // e.g. "11:00a" or null (all-day / task)
  url: string | null;
  priority: boolean; // within 48h
  kind: "event" | "task";
}

interface DocketData {
  rows: DocketRow[];
  needsCalendar: boolean;
  source: "calendar" | "tasks";
}

export default function Docket() {
  const [data, setData] = useState<DocketData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/board/docket", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as DocketData;
        if (alive) setData(json);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="docket">
      <div className="docket-h">
        <span>
          <span className="ico">■</span>&nbsp; This Week
        </span>
        <span>Docket</span>
      </div>

      {loading && <div className="docket-empty">Loading docket…</div>}

      {!loading && error && (
        <div className="docket-empty">Couldn&apos;t load the docket right now.</div>
      )}

      {!loading &&
        !error &&
        data &&
        data.rows.map((r, i) => (
          <div className={`drow${r.priority ? " priority" : ""}`} key={i}>
            <div className="drow-date">{r.date}</div>
            <div className="drow-body">
              {r.body}
              {r.time && <span className="drow-time">{r.time}</span>}
            </div>
            {r.url ? (
              <a className="drow-src" href={r.url} target="_blank" rel="noopener noreferrer">
                Open ↗
              </a>
            ) : (
              <span className="drow-src" style={{ opacity: 0.3 }}>
                —
              </span>
            )}
          </div>
        ))}

      {!loading && !error && data && data.rows.length === 0 && (
        <div className="docket-empty">
          <span>
            {data.needsCalendar
              ? "No upcoming task dates. Connect Google Calendar to see your schedule here."
              : "Nothing on the docket for the next two weeks."}
          </span>
          {data.needsCalendar && (
            <a href="/authorize" title="Connect Google Calendar">
              Connect ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
