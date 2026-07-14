// Shared types + helpers for the Editor Asset Packages surface.
//
// - /packages           → staff index (Postgame Liquid Glass dark)
// - /pkg/[token]        → public, token-gated, client-skinned package page
//
// The package page reads its look from the brand's kit row (brands table),
// so these helpers turn that row into the CSS variables + font/logo lists the
// client-skinned page consumes. Kept next to lib/portal.ts, which does the
// same job for the brand portal.

// ── Postgame dark index tokens (mirror lib/portal.ts) ──
export const PKG_ORANGE = "#D73F09";
export const PKG_OFFWHITE = "#FAF8F5";
export const PKG_BG = "#07070a";

export type BrandKit = {
  id: string;
  name: string;
  slug: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  brand_colors: { hex: string; name: string }[] | null;
  font_primary: string | null;
  font_secondary: string | null;
  font_primary_url: string | null;
  font_secondary_url: string | null;
  logo_primary_url: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  logo_white_url: string | null;
  logo_mark_url: string | null;
};

export type AssetPackage = {
  id: string;
  brand_id: string;
  campaign_recap_id: string | null;
  name: string;
  slug: string;
  status: "draft" | "live";
  share_token: string;
  roster_label: "Names" | "Athletes" | string | null;
  settings: Record<string, any> | null;
};

export type Talent = {
  id: string;
  name: string;
  subtext: string | null;
  tag_url: string | null;
  slug: string | null;
  status: string | null;
  sort_order: number | null;
};

// A search row shared by the roster and the celeb library.
export type TagRow = {
  name: string;
  subtext: string;
  slug: string;
  tag_url: string | null;
  // roster-only decoration
  rank?: number;
  pin?: boolean;
  statusShort?: "2026" | "PAST" | "";
  source: "roster" | "library";
};

// name -> url-safe slug (matches scripts/seed-canes-package.ts + tag filenames)
export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// The logo to drop on the brand-colored hero. A white/light mark reads best on
// a saturated field; primary/dark are the fallbacks.
export function pickHeroLogo(b: BrandKit): string | null {
  return (
    b.logo_white_url ||
    b.logo_light_url ||
    b.logo_primary_url ||
    b.logo_dark_url ||
    b.logo_mark_url ||
    null
  );
}

// Labeled, de-duped logo files for the "Logos" grab bar. `dark` = the file is a
// light/white mark meant to sit on a colored field (preview it on the brand red).
export function brandLogos(
  b: BrandKit
): { label: string; url: string; onColor: boolean; file: string }[] {
  const raw: { label: string; url: string | null; onColor: boolean }[] = [
    { label: "Primary", url: b.logo_primary_url, onColor: false },
    { label: "White", url: b.logo_white_url, onColor: true },
    { label: "Light", url: b.logo_light_url, onColor: true },
    { label: "Dark", url: b.logo_dark_url, onColor: false },
    { label: "Mark", url: b.logo_mark_url, onColor: false },
  ];
  const seen = new Set<string>();
  const out: { label: string; url: string; onColor: boolean; file: string }[] = [];
  for (const r of raw) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    const ext = (r.url.split(".").pop() || "png").split("?")[0].toLowerCase();
    out.push({
      label: r.label,
      url: r.url,
      onColor: r.onColor,
      file: `${b.slug || slugify(b.name)}-${r.label.toLowerCase()}.${ext}`,
    });
  }
  return out;
}

// Map a brand's font display name to the OTF families we bundle in
// /public/fonts. Falls back to a hosted font_*_url when present, else no
// download (specimen only). The canvas generator hard-requires BerthCity +
// Proxima, which are always bundled regardless of the brand.
const BUNDLED_FONTS: Record<string, { family: string; files: string[] }> = {
  "berthold city": { family: "BerthCity", files: ["/fonts/BerthCity-Bold.otf"] },
  "proxima nova": {
    family: "Proxima",
    files: ["/fonts/Proxima-Regular.otf", "/fonts/Proxima-Bold.otf"],
  },
  veneer: { family: "Veneer", files: ["/fonts/Veneer.otf"] },
};

export type FontSpec = {
  name: string;
  role: string;
  family: string; // CSS family to render the specimen in
  files: string[]; // downloadable OTF(s)
};

export function brandFonts(b: BrandKit): FontSpec[] {
  const out: FontSpec[] = [];
  const add = (name: string | null, role: string, hostedUrl: string | null) => {
    if (!name) return;
    const bundled = BUNDLED_FONTS[name.trim().toLowerCase()];
    if (bundled) {
      out.push({ name, role, family: bundled.family, files: bundled.files });
    } else if (hostedUrl) {
      // Hosted family: specimen falls back to a serif/sans; download the file.
      out.push({ name, role, family: name, files: [hostedUrl] });
    } else {
      out.push({ name, role, family: name, files: [] });
    }
  };
  add(b.font_primary, "Display / headlines", b.font_primary_url);
  add(b.font_secondary, "Body / subtitles", b.font_secondary_url);
  return out;
}

// Gold used for the tag spine + a couple of index accents when the brand has a
// named gold; else a sensible default.
export function brandGold(b: BrandKit): string {
  const g = (b.brand_colors || []).find((c) => /gold/i.test(c.name));
  return g?.hex || "#F5A800";
}
