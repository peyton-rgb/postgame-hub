// ============================================================
// Brand logo resolver — one place that decides which file to render
//
// The real logo library is `brand_logos`, a child table of `brands`. The legacy
// `brands.logo_*` columns hold one guessed file per brand; this table holds the
// actual set, tagged with what each file is and what it was made for.
//
//   kind    — mark | lockup | wordmark | mono
//   variant — on_white | on_black | on_brand
//
// `variant` is the surface the file was BUILT FOR, not the colour of its ink.
// An `on_white` asset carries dark ink, so on a dark surface it disappears.
// That is not a cosmetic issue: Raising Cane's only mark is on_white with ink
// #060606, and the readiness rail is #07070A — rendering it there produces an
// invisible logo, strictly worse than the wordmark it would have replaced.
//
// Hence the ordering rule: fall back on KIND, never on VARIANT. A wordmark that
// can be seen beats a mark that cannot. If a surface has no file in its own
// variant, this returns null and the caller uses its legacy path.
// ============================================================

export type LogoSurface = "dark" | "light" | "brand";
export type LogoKind = "mark" | "lockup" | "wordmark" | "mono";
export type LogoVariant = "on_white" | "on_black" | "on_brand";

/** A `brand_logos` row, as selected by BRAND_LOGO_COLUMNS. */
export type BrandLogoRow = {
  brand_id: string;
  kind: string;
  variant: string;
  url: string;
  has_alpha: boolean | null;
  ink_hex: string | null;
  bg_hex: string | null;
  dated: boolean;
  reject_reason: string | null;
  width: number | null;
  height: number | null;
};

export const BRAND_LOGO_COLUMNS =
  "brand_id,kind,variant,url,has_alpha,ink_hex,bg_hex,dated,reject_reason,width,height";

export type ResolvedBrandLogo = {
  url: string;
  kind: LogoKind;
  variant: LogoVariant;
  /** True when the preferred kind was unavailable and a later one was used. */
  fellBack: boolean;
  /**
   * false means the background is baked into the image — a plate. Because a
   * file is only ever chosen for its own variant, a plate here already matches
   * the surface; callers that place a logo somewhere else should still check.
   */
  hasAlpha: boolean | null;
  inkHex: string | null;
  bgHex: string | null;
  width: number | null;
  height: number | null;
};

const VARIANT_FOR_SURFACE: Record<LogoSurface, LogoVariant> = {
  dark: "on_black",
  light: "on_white",
  brand: "on_brand",
};

// mono last: it is a single-ink reduction, correct when nothing else exists but
// never the first choice when a full-colour file is available.
const KIND_ORDER: LogoKind[] = ["mark", "lockup", "wordmark", "mono"];

/** Files that must never render: superseded, or rejected for some other reason. */
export function isUsableLogo(row: BrandLogoRow): boolean {
  return !row.dated && !row.reject_reason && !!row.url;
}

/**
 * Pick the best file for one brand on one surface, or null if it has none.
 *
 * `logos` may be every row for the brand; anything unusable is filtered here.
 * Returns what it actually resolved to — a caller asking for a mark and getting
 * a wordmark needs to know, because the two do not lay out the same.
 */
export function resolveBrandLogo(
  logos: BrandLogoRow[] | null | undefined,
  opts: { surface: LogoSurface; prefer?: LogoKind }
): ResolvedBrandLogo | null {
  if (!logos?.length) return null;

  const wantVariant = VARIANT_FOR_SURFACE[opts.surface];
  const prefer = opts.prefer ?? "mark";

  // Only this surface's own variant is eligible. Stepping outside it to find a
  // preferred kind is what makes a logo invisible.
  const candidates = logos.filter((l) => isUsableLogo(l) && l.variant === wantVariant);
  if (!candidates.length) return null;

  const order = [prefer, ...KIND_ORDER.filter((k) => k !== prefer)];
  for (const kind of order) {
    const hit = candidates.find((l) => l.kind === kind);
    if (!hit) continue;
    return {
      url: hit.url,
      kind: hit.kind as LogoKind,
      variant: hit.variant as LogoVariant,
      fellBack: kind !== prefer,
      hasAlpha: hit.has_alpha,
      inkHex: hit.ink_hex,
      bgHex: hit.bg_hex,
      width: hit.width,
      height: hit.height,
    };
  }

  // A variant match whose kind is outside the known set — still better than
  // nothing, and still the right variant.
  const first = candidates[0];
  return {
    url: first.url,
    kind: first.kind as LogoKind,
    variant: first.variant as LogoVariant,
    fellBack: true,
    hasAlpha: first.has_alpha,
    inkHex: first.ink_hex,
    bgHex: first.bg_hex,
    width: first.width,
    height: first.height,
  };
}

/** Group flat `brand_logos` rows by brand, for bulk page loads. */
export function groupLogosByBrand(rows: BrandLogoRow[] | null | undefined): Map<string, BrandLogoRow[]> {
  const map = new Map<string, BrandLogoRow[]>();
  for (const r of rows ?? []) {
    if (!r?.brand_id) continue;
    const list = map.get(r.brand_id);
    if (list) list.push(r);
    else map.set(r.brand_id, [r]);
  }
  return map;
}
