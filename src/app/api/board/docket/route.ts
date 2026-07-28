// ============================================================
// GET /api/board/docket
//
// The /board docket: the next 14 days from Google Calendar
// (peyton@pstgm.com) merged with any board_tasks due dates in the
// same window. Staff-gated. Degrades gracefully — if the Hub's Google
// token lacks Calendar scope (or the creds are absent, e.g. locally),
// it returns `needsCalendar: true` with whatever task due-dates exist.
// ============================================================

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-auth";
import { getStaffUser } from "@/lib/staff-auth";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const CAL_ID = "peyton@pstgm.com";
const TZ = "America/New_York";
const WINDOW_DAYS = 14;

interface DocketRow {
  date: string;
  body: string;
  time: string | null;
  url: string | null;
  priority: boolean;
  kind: "event" | "task";
  ts: number; // sort key (ms); stripped from response order only
}

function dateLabel(d: Date): string {
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(d).toUpperCase();
  const md = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", timeZone: TZ }).format(d);
  return `${wd} ${md}`;
}

function timeLabel(d: Date): string {
  const s = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(d);
  // "11:00 AM" → "11:00a"
  return s.replace(/\s?AM$/i, "a").replace(/\s?PM$/i, "p");
}

export async function GET() {
  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowMs = now.getTime();
  const timeMax = new Date(nowMs + WINDOW_DAYS * 86400000);
  const rows: DocketRow[] = [];
  let needsCalendar = false;

  // ── Task due-dates in window (RLS → own tasks) ──
  try {
    const supabase = createServerSupabase();
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now); // yyyy-mm-dd
    const maxStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(timeMax);
    const { data } = await supabase
      .from("board_tasks")
      .select("title, due_date, source_url")
      .not("due_date", "is", null)
      .gte("due_date", todayStr)
      .lte("due_date", maxStr);
    for (const t of data ?? []) {
      const [y, m, d] = String(t.due_date).split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
      const ts = dt.getTime();
      rows.push({
        date: dateLabel(dt),
        body: `${t.title} — due`,
        time: null,
        url: t.source_url || "/board",
        priority: ts - nowMs <= 48 * 3600000,
        kind: "task",
        ts,
      });
    }
  } catch {
    // task merge is best-effort; ignore
  }

  // ── Google Calendar (graceful fallback) ──
  try {
    const calendar = google.calendar({ version: "v3", auth: getGoogleAuth() });
    const res = await calendar.events.list({
      calendarId: CAL_ID,
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 25,
    });
    for (const ev of res.data.items ?? []) {
      const startRaw = ev.start?.dateTime || ev.start?.date;
      if (!startRaw) continue;
      const allDay = !ev.start?.dateTime;
      const dt = new Date(ev.start?.dateTime ?? `${ev.start?.date}T00:00:00`);
      const ts = dt.getTime();
      rows.push({
        date: dateLabel(dt),
        body: ev.summary || "(no title)",
        time: allDay ? null : timeLabel(dt),
        url: ev.htmlLink || null,
        priority: ts - nowMs <= 48 * 3600000,
        kind: "event",
        ts,
      });
    }
  } catch {
    // No Calendar scope / no creds / API error → show task dates only.
    needsCalendar = true;
  }

  rows.sort((a, b) => a.ts - b.ts);
  const trimmed = rows.slice(0, 12).map((r) => ({
    date: r.date,
    body: r.body,
    time: r.time,
    url: r.url,
    priority: r.priority,
    kind: r.kind,
  }));

  return NextResponse.json({
    rows: trimmed,
    needsCalendar,
    source: needsCalendar ? "tasks" : "calendar",
  });
}
