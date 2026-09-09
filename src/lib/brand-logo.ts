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

// ============================================================
// Theme-aware selection over the LEGACY brands.logo_* columns
//
// resolveBrandLogo() above works on the brand_logos table and is the right
// path when a brand has rows there. Most Hub surfaces don't use it — they read
// a single brands.logo_* column directly — so this is the equivalent for them.
//
// THE NAMING IS A TRAP, and it is the reason light mode shipped invisible:
// the column name describes the INK, not the background.
//   logo_light_url = light/white ink -> use on a DARK ground
//   logo_dark_url  = dark ink        -> use on a LIGHT ground
// So the theme and the column name are INVERTED. Reading logo_light_url in
// light mode is the bug, not the fix.
// ============================================================

export type HubTheme = "dark" | "light";

/** The brands.logo_* columns this picker knows about. */
export type BrandLogoColumns = {
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
  logo_primary_url?: string | null;
  logo_url?: string | null;
};

export type PickedBrandLogo = {
  url: string;
  /** Which column it came from — useful for auditing what actually rendered. */
  source: "theme-correct" | "primary" | "legacy";
  /**
   * True when the theme-correct variant was MISSING and we fell through to a
   * file whose ink is unverified for this ground.
   *
   * This is a sourcing signal, not a licence to render badly: the chain below
   * never reaches for the opposite-ink variant, so a mark that is known to be
   * wrong for the ground is not rendered at all.
   */
  inkMismatch: boolean;
};

/**
 * Pick a logo file for the active theme, or null when nothing safe exists.
 *
 * Chain: theme-correct variant -> logo_primary_url -> legacy logo_url -> null.
 *
 * THE OPPOSITE-INK VARIANT IS DELIBERATELY NOT IN THE CHAIN. Falling back to it
 * renders the exact failure this function exists to prevent — a light-ink mark
 * on a light ground. resolveBrandLogo()'s header makes the same argument for
 * the brand_logos table and names Raising Cane's as the case that proves it:
 * fall back on KIND, never on VARIANT. A deliberate empty slot tells you a file
 * is missing; an invisible mark just looks broken.
 *
 * `null` means "render the themed placeholder".
 */
export function pickBrandLogo(
  brand: BrandLogoColumns | null | undefined,
  theme: HubTheme
): PickedBrandLogo | null {
  if (!brand) return null;

  // Inverted on purpose — see the naming note above.
  const themeCorrect = theme === "light" ? brand.logo_dark_url : brand.logo_light_url;
  if (themeCorrect) return { url: themeCorrect, source: "theme-correct", inkMismatch: false };

  // No file is known-good for this ground. primary/legacy carry no ink metadata,
  // so they are a gamble rather than a wrong answer — worth trying, and flagged.
  if (brand.logo_primary_url) return { url: brand.logo_primary_url, source: "primary", inkMismatch: true };
  if (brand.logo_url) return { url: brand.logo_url, source: "legacy", inkMismatch: true };
  return null;
}

/**
 * True when a brand has no file whose ink is known-correct for this theme.
 *
 * The sourcing question, separated from the rendering one: these brands either
 * show an unverified file or the placeholder, and the fix is a logo file, not
 * code.
 */
export function needsLogoVariant(
  brand: BrandLogoColumns | null | undefined,
  theme: HubTheme
): boolean {
  if (!brand) return false;
  return !(theme === "light" ? brand.logo_dark_url : brand.logo_light_url);
}
