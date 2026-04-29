// ============================================================
// Social-follower string helpers.
//
// The WhyYou section stores per-platform follower counts as
// human-readable strings (e.g. "4.9M", "2.67M", "1.4M", "94K",
// "350"). The pitch deck wants a derived total like "13.47M"
// shown below the platform icons, and the editor wants to show
// the same total live as Peyton edits the numbers.
//
// Both call sites need to:
//   1) Parse the strings into numbers
//   2) Sum them
//   3) Format the sum back into a compact human string
//
// This file centralizes that logic so the display + editor stay
// in sync.
// ============================================================

/**
 * Parse a follower string like "4.9M", "2.67M", "94K", "350",
 * "1.4 m", "12,500", "1B+" into a numeric count.
 *
 * Returns null if the string is empty / unparseable.
 */
export function parseFollowerCount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  // Strip whitespace, commas, and a trailing "+" (e.g. "13.5M+").
  const cleaned = raw.toString().trim().replace(/,/g, "").replace(/\+$/, "");
  if (!cleaned) return null;

  // Match: a number (with optional decimal) followed by an optional
  // suffix letter (k/m/b — case-insensitive).
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([kmbKMB]?)$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;

  const suffix = match[2].toLowerCase();
  if (suffix === "k") return value * 1_000;
  if (suffix === "m") return value * 1_000_000;
  if (suffix === "b") return value * 1_000_000_000;
  return value;
}

/**
 * Format a numeric follower count back into a compact string.
 *   12,300,000  -> "12.3M"
 *   13,470,000  -> "13.47M"
 *   4_900_000   -> "4.9M"
 *   350_000     -> "350K"
 *   500         -> "500"
 *
 * Rounds to 2 decimals max, but strips trailing zeros so "13.0M"
 * collapses to "13M".
 */
export function formatFollowerCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";

  let value: number;
  let suffix: string;
  if (n >= 1_000_000_000) {
    value = n / 1_000_000_000;
    suffix = "B";
  } else if (n >= 1_000_000) {
    value = n / 1_000_000;
    suffix = "M";
  } else if (n >= 1_000) {
    value = n / 1_000;
    suffix = "K";
  } else {
    return Math.round(n).toString();
  }

  // Round to 2 decimals, then strip trailing zeros so "4.50" -> "4.5".
  const fixed = value.toFixed(2);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return `${trimmed}${suffix}`;
}

export interface FollowerSumResult {
  /** Total in raw integer form. */
  total: number;
  /** Human-friendly string, e.g. "13.47M". */
  formatted: string;
  /** How many entries successfully parsed. */
  parsedCount: number;
  /** How many entries had a follower string that couldn't be parsed. */
  unparseableCount: number;
}

/**
 * Sum follower counts from a list of social handles. Each entry
 * may have an optional `followers` string. Entries with missing or
 * unparseable follower strings are skipped (and counted in
 * `unparseableCount` if non-empty).
 *
 * The "skip empty, count unparseable" split lets the editor show
 * "13.47M total — 1 entry couldn't be parsed" if Peyton typed
 * something the parser doesn't understand, vs. simply omitting
 * platforms that haven't been filled in yet.
 */
export function sumFollowerCounts(
  handles: Array<{ followers?: string | null | undefined }> | undefined | null,
): FollowerSumResult {
  let total = 0;
  let parsedCount = 0;
  let unparseableCount = 0;

  for (const h of handles ?? []) {
    const raw = h?.followers;
    if (raw == null || raw.toString().trim() === "") continue;
    const parsed = parseFollowerCount(raw);
    if (parsed == null) {
      unparseableCount += 1;
      continue;
    }
    total += parsed;
    parsedCount += 1;
  }

  return {
    total,
    formatted: formatFollowerCount(total),
    parsedCount,
    unparseableCount,
  };
}
