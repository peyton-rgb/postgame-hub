/**
 * campaign-readiness — one row per campaign describing what it still needs.
 *
 * Twelve status lookups across 626 campaigns. Everything here is BULK: seven
 * queries total, no per-row lookups. Adding a query inside the row loop would
 * turn this into ~7,500 round trips on the Hub's landing page.
 *
 * PURE module — no server imports, so the client bundle can use the types,
 * column order and link targets without dragging next/headers in.
 * The bulk fetch lives in campaign-readiness-data.ts.
 *
 * Verified against live data 20 Aug 2026: 63 live / 543 archived / 20 null,
 * and the brand-kit roll-up reproduces the expected 19 full · 35 partial · 9 none.
 */

/** 'g' complete · 'y' partial/draft · 'r' nothing yet.
 *  Link-style columns only ever use 'g' (exists) or 'r' (not created). */
export type State = "g" | "y" | "r";

/**
 * Column order is fixed — it drives both the table and the progress score.
 *
 * `instructions` IS ALWAYS RED, AND THAT IS NOT A BUG. Verified 20 Aug 2026:
 * `campaign_instructions` carries `id, title, slug, brand_id, brand_name,
 * brand_logo, brand_color, campaign_date, hero_image, hero_video,
 * athlete_section, crew_section, created_at` — there is no `campaign_id`, no
 * `admin_campaign_id`, and no join table. The rows key to a BRAND, never to a
 * campaign, so no query can light this column up. It is structural, not an
 * empty table, and it cannot resolve without a schema change (which is
 * deliberately out of scope here).
 *
 * The column stays in on purpose: a permanently unfillable cell is honest about
 * a real gap, which is the point of this table. Do not "fix" it by dropping it,
 * and do not go hunting for a query that works — there isn't one.
 *
 * `optin` is a different failure with the same symptom: `optin_campaigns` DOES
 * have `admin_campaign_id`, but it is null on every row, so the two opt-in
 * pages that exist cannot be matched to a campaign. That one is fixable in
 * data; instructions is not.
 */
export const COLUMNS = [
  "drive", "frameio", "kit", "brief",
  "optin", "instructions", "submission", "recap",
  "clients", "campaign", "casestudy", "press",
] as const;
export type ColumnKey = (typeof COLUMNS)[number];

export interface ReadinessBrand {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  /** Dark-ink logo → sits on a white chip so it reads on the dark row. */
  chip: boolean;
}

export interface ReadinessRow {
  id: string;
  name: string;
  slug: string | null;
  adminId: string | null;
  live: boolean;
  brand: ReadinessBrand | null;
  driveFolderId: string | null;
  frameioUrl: string | null;
  briefUrl: string | null;
  /** 0–4, the brand-kit roll-up. */
  kitCount: number;
  states: Record<ColumnKey, State>;
  /** g=1, y=0.5, r=0, out of 12. */
  score: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

export const txt = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
};

export const jsonHasItems = (v: unknown): boolean => Array.isArray(v) && v.length > 0;

/**
 * Brand kit is a 4-part roll-up, checked for SUBSTANCE not presence:
 * `brand_fonts` is non-null on nearly every brand but almost all hold an empty
 * `[]`, so a presence check reads 100% complete when it is nowhere near it.
 */
export function kitScore(b: Record<string, unknown> | null | undefined): number {
  if (!b) return 0;
  const logo = [
    "logo_url", "logo_primary_url", "logo_light_url", "logo_dark_url",
    "logo_icon_url", "logo_mark_url", "logo_white_url",
  ].some((k) => txt(b[k]));
  const font = jsonHasItems(b.brand_fonts) || !!txt(b.font_primary_url) || !!txt(b.font_primary);
  const color = jsonHasItems(b.brand_colors) || !!txt(b.primary_color);
  const guide = jsonHasItems(b.brand_guidelines) || !!txt(b.brand_guidelines_url);
  return [logo, font, color, guide].filter(Boolean).length;
}

/**
 * Pick a logo that reads on the dark row, and say whether it needs a white chip.
 *
 * Column names lie — Raising Cane's `logo_light_url` points at
 * `canes-logo-black.png`. Measuring actual ink would mean decoding every image
 * server-side on the landing page, so this reads the filename, which is what
 * actually encodes the ink in this dataset, and falls back to a chip when the
 * file is ambiguous but the brand is known-dark.
 */
export function pickLogo(b: Record<string, unknown> | null | undefined): { url: string | null; chip: boolean } {
  if (!b) return { url: null, chip: false };
  const order = [
    "logo_white_url", "logo_light_url", "logo_primary_url",
    "logo_url", "logo_icon_url", "logo_mark_url", "logo_dark_url",
  ];
  let url: string | null = null;
  for (const k of order) {
    const v = txt(b[k]);
    if (v) { url = v; break; }
  }
  if (!url) return { url: null, chip: false };
  const f = url.toLowerCase();
  const darkInk = /black|dark|navy|-blk|_blk/.test(f);
  // SVG/AVIF brand marks in this set are predominantly dark-ink.
  const ambiguousDark = /\.(svg|avif)(\?|$)/.test(f);
  return { url, chip: darkInk || ambiguousDark };
}

export const SCORE: Record<State, number> = { g: 1, y: 0.5, r: 0 };

// ── link targets ──────────────────────────────────────────────────────────────

/**
 * Confirmed against the real routes 20 Aug 2026 — dashboard detail pages are
 * UUID-based, not slug-based. Where a thing doesn't exist yet, the link goes to
 * the section's list page (where you'd create it). No href="#" anywhere.
 */
export function hrefFor(col: ColumnKey, row: ReadinessRow): string {
  const editor = `/dashboard/${row.id}`;
  const brand = row.brand ? `/dashboard/brands/${row.brand.id}` : "/dashboard/brands";
  switch (col) {
    case "drive":
      return row.driveFolderId ? `https://drive.google.com/drive/folders/${row.driveFolderId}` : editor;
    case "frameio":
      return row.frameioUrl ?? editor;
    case "kit":
      return brand;
    case "brief":
      return row.briefUrl ?? editor;
    case "optin":
      return "/dashboard/campaign-optin";
    case "instructions":
      return "/dashboard/campaign-instructions";
    case "submission":
      // No per-campaign detail route without a token; the list page is both
      // where an existing link is found and where a new one is created.
      return "/dashboard/submission-forms";
    case "recap":
      return editor;
    case "clients":
      return brand;
    case "campaign":
      return row.slug ? `/campaign/${row.slug}` : editor;
    case "casestudy":
      return row.slug ? `/case-studies/${row.slug}` : "/dashboard/case-studies";
    case "press":
      return "/dashboard/press";
  }
}

export const campaignHref = (row: ReadinessRow) => `/dashboard/${row.id}`;
export const brandHref = (row: ReadinessRow) =>
  row.brand ? `/dashboard/brands/${row.brand.id}` : "/dashboard/brands";
