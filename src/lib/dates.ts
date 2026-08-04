// ============================================================
// Date-only helpers — for Postgres `date` columns ("YYYY-MM-DD")
//
// A Postgres `date` is a bare calendar day: no time, no timezone.
// `board_tasks.due_date` is one. The trap is that JS has no date-only
// type, so every round-trip through `Date` picks up a timezone:
//
//   new Date("2026-08-09")        → midnight UTC (per the ES spec)
//   new Date(2026, 7, 9)          → midnight in the *server's* zone,
//                                   which is UTC on Vercel but ET on a
//                                   laptop — so this one is not portable
//
// Either way, formatting that instant in America/New_York (UTC−4) rolls
// it back four hours and prints Aug 8. That is the off-by-one: the parse
// and the format disagree about which zone the day lives in.
//
// The fix is to anchor date-only values to UTC on the way IN and read
// them back in UTC on the way OUT, so the two cancel exactly and the
// calendar day survives in every environment — Vercel (TZ=UTC), a
// laptop (TZ=America/New_York), or CI. Never format a value from
// `parseDateOnly` in a named zone; that reintroduces the shift.
//
// Use these for any Postgres `date`. Do NOT use them for `timestamptz`
// (created_at, updated_at, calendar event start times) — those are real
// instants and *should* be rendered in the viewer's zone.
// ============================================================

/** The zone date-only values are anchored to. Parse and format must agree. */
export const DATE_ONLY_TZ = "UTC";

/**
 * Parse a Postgres `date` ("YYYY-MM-DD") into a UTC-anchored Date.
 *
 * The result is midnight UTC on that calendar day, so it must be read
 * back with `timeZone: "UTC"` (use `formatDateOnlyShort`, or pass
 * DATE_ONLY_TZ to your own Intl formatter). Returns null for null,
 * empty, malformed, or non-existent dates (e.g. "2026-02-31").
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // Date.UTC rolls invalid days over (Feb 31 → Mar 3); reject those.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

/**
 * Format a Postgres `date` as a short docket label: "SUN 08/09".
 * Timezone-independent — identical output on Vercel and locally.
 * Returns null when there is no usable date, so callers can skip the row.
 */
export function formatDateOnlyShort(value: string | null | undefined): string | null {
  const dt = parseDateOnly(value);
  if (!dt) return null;
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: DATE_ONLY_TZ,
  })
    .format(dt)
    .toUpperCase();
  const md = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    timeZone: DATE_ONLY_TZ,
  }).format(dt);
  return `${wd} ${md}`;
}

/**
 * Today's calendar day in `timeZone`, as "YYYY-MM-DD".
 *
 * Use this for any "is it due yet" boundary instead of `new Date()` on
 * the server — after 8pm ET the server's UTC clock has already rolled
 * over to tomorrow, which is exactly when a naive overdue check fires a
 * day early.
 */
export function todayDateOnly(timeZone: string, now: Date = new Date()): string {
  // "en-CA" formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/**
 * Whole calendar days from today (in `timeZone`) to a Postgres `date`.
 * Negative = overdue, 0 = due today. Null when there is no usable date.
 *
 * Both sides are anchored to UTC midnight, so the subtraction counts
 * calendar days and is never skewed by the server's zone or by DST.
 */
export function daysUntilDateOnly(
  value: string | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): number | null {
  const target = parseDateOnly(value);
  if (!target) return null;
  const today = parseDateOnly(todayDateOnly(timeZone, now));
  if (!today) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
