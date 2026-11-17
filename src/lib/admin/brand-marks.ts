// ============================================================
// Brand icons for admin lists (the square 26–56px marks on rows and
// cards).
//
// Every client logo now comes from Supabase. The approved logo kit stores
// each brand's files side by side in one folder
// (campaign-media/brand-kits/kit-2026-11/<brand>/), so when a caller hands
// us any file from that folder — the full lockup, the dark logo, etc. — we
// swap it for the brand's square icon from the same folder. Files outside
// the kit are used as given.
//
// Postgame is the one exception: its icon is defined by the design system
// (orange circle + plus) and lives in /public/brand-marks/postgame.png.
// Client-safe (no server imports).
// ============================================================

const KIT_FILE =
  /(\/brand-kits\/kit-2026-11\/[a-z0-9_]+\/)(?:primary|secondary|light|dark|plate|icon_light|icon_dark|icon)((?:_v2|_silver)?)\.(?:png|svg)$/;

/** The square icon that sits next to a logo-kit file, or null if `src` isn't a kit file. */
export function kitIconFor(src: string | null | undefined): string | null {
  if (!src) return null;
  const m = src.match(KIT_FILE);
  return m ? src.replace(KIT_FILE, `$1icon$2.png`) : null;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isPostgame(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = normalize(name);
  return n === "postgame" || n.startsWith("postgame ");
}

/**
 * The icon to show for a brand in a square admin slot.
 * `src` is whatever logo URL the page already has for the brand.
 */
export function brandMarkFor(name: string | null | undefined, src: string | null | undefined): string | null {
  if (isPostgame(name)) return "/brand-marks/postgame.png";
  return kitIconFor(src) ?? src ?? null;
}
