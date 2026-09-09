// ============================================================
// Deal ledger formatting — the small decisions the /deals table repeats
// 400 times, kept in one place so they cannot drift apart.
// ============================================================

/**
 * `deals.date_announced` is a Postgres `date` and arrives as "2026-05-11".
 *
 * new Date("2026-05-11") parses that as midnight UTC, and every Date method
 * that is not the UTC one then reads it back in the viewer's zone — so a
 * server in UTC renders "May 11" and a reader in Los Angeles renders "May 10".
 * On a ledger whose entire claim is "this is when the deal happened", an
 * off-by-one date is a factual error, so the string is split rather than
 * parsed and no Date is constructed at all.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** "Sep 4, 2026" — the ledger's date cell. */
export function dealDate(date: string | null | undefined): string {
  const p = parts(date);
  if (!p) return "—";
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

/** "Sep 4" — the latest strip, where the year is implied by the ordering. */
export function dealDateShort(date: string | null | undefined): string {
  const p = parts(date);
  if (!p) return "—";
  return `${MONTHS[p.m - 1]} ${p.d}`;
}

/** The year, for the year facet. Null when the deal has no announced date. */
export function dealYear(date: string | null | undefined): number | null {
  return parts(date)?.y ?? null;
}

/** ISO date for <time dateTime>, or undefined so the attribute is dropped. */
export function dealDateISO(date: string | null | undefined): string | undefined {
  const p = parts(date);
  return p ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : undefined;
}

/**
 * A facet value as it appears in the URL: "Raising Cane's" -> "raising-canes".
 * Lossy on purpose — it is a lookup key, and the page always matches a param
 * back against the real values rather than trying to reverse it.
 */
export function facetSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Initials for the placeholder tile. "Zeke Mayo & Devin Neal" -> "ZM".
 * Two letters at most: three is a monogram, and these sit in a 4:5 frame.
 */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return "—";
  const words = name.split(/[\s&,]+/).filter(Boolean);
  if (!words.length) return "—";
  const first = words[0][0] ?? "";
  const second = words.length > 1 ? words[1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

/**
 * A thumbnail-sized copy of a Supabase Storage image.
 *
 * The ledger shows fifty rows and the originals average 1.8 MB — one page
 * would be 90 MB of image. Supabase's transform endpoint is the documented
 * fix (CLAUDE.md): swap /object/public/ for /render/image/public/ and ask for
 * a size.
 *
 * `resize=contain` matters. Passing width alone does NOT preserve the aspect
 * ratio — it squashes the image into width x (default height); a 776x776
 * photo comes back 160x776. contain fits the whole image inside the box and
 * keeps its shape, so the 4:5 crop stays a CSS decision and the row can still
 * honour the deal's focal_point, which the transform endpoint knows nothing
 * about.
 *
 * Anything not on Supabase Storage is returned untouched.
 */
export function thumbUrl(url: string | null | undefined, box = 320, quality = 72): string | null {
  if (!url) return null;
  if (!url.includes("/storage/v1/object/public/")) return url;
  const base = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  return `${base}?width=${box}&height=${box}&resize=contain&quality=${quality}`;
}

/**
 * The full-bleed hero photo. Same transform, a much bigger box and a higher
 * quality, because this one fills the screen: the newest deal's original is
 * 2000x2000 and 3.2 MB, and at 1800/q80 it is 381 KB for a frame that is at
 * most 1400px tall.
 */
export function heroUrl(url: string | null | undefined): string | null {
  return thumbUrl(url, 1800, 80);
}

/**
 * A deal's stored zoom arrives from Postgres `numeric` as a string ("1.0").
 * Anything that is not a usable number above 1 means "no zoom", and returning
 * undefined rather than 1 lets the caller drop the transform entirely.
 */
export function zoomScale(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 1 ? n : undefined;
}

/**
 * A brand colour, dimmed to a tint that can sit behind off-white type on the
 * black ground. Falls back to the glass fill rather than to orange: orange is
 * an accent, and a wall of placeholder tiles in orange would read as a design
 * choice instead of as missing data.
 */
export function brandTint(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return "rgba(250,248,245,0.05)";
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.22)`;
}
