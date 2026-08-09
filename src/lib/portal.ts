// Shared design tokens + helpers for the private brand portal surface
// (/portal/[token]). Kept in one place so the layout, home page, and media
// library all match the existing design system exactly.
//
// CLIENT-SAFE. PortalNav and LibraryGallery are "use client", so nothing in
// this file may import the service-role Supabase client. Server-only portal
// data helpers live in src/lib/portal-data.ts instead.

export const ORANGE = "#D73F09";
export const OFFWHITE = "#FAF8F5";
export const BG = "#07070a";

// Glass + surface tokens, from the approved design file. Radius is 8px on Hub
// app surfaces (marketing surfaces use 16px) — an approved amendment to the
// design system, so it is deliberate that these are not the rounder values.
export const CARD = "rgba(250,248,245,.035)";
export const CARD_B = "rgba(250,248,245,.11)";
export const RAISED = "rgba(250,248,245,.06)";
export const RAISED_B = "rgba(250,248,245,.15)";
export const HAIR = "rgba(250,248,245,.09)";
export const RADIUS = 8;
export const BLUR = "blur(26px)";

// Opacity ladder — 100 display / 90 lead / 68 body (default) / 50 labels.
export const INK_DISPLAY = "rgba(250,248,245,1)";
export const INK_LEAD = "rgba(250,248,245,.90)";
export const INK_BODY = "rgba(250,248,245,.68)";
export const INK_LABEL = "rgba(250,248,245,.50)";

// Four fonts only. Bebas + JetBrains Mono come from the root layout; Anton and
// Arimo are loaded scoped to this surface (see ./fonts.ts) so we never touch
// the root layout, which propagates to 34 other surfaces.
export const BEBAS = {
  fontFamily: "var(--font-bebas), 'Bebas Neue', Arial, sans-serif",
} as const;
export const ANTON = {
  fontFamily: "var(--font-anton), Anton, Arial, sans-serif",
} as const;
export const ARIMO = {
  fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif",
} as const;
export const MONO = {
  fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: ".14em",
} as const;

// The brand's preferred logo, in fallback order.
export function pickBrandLogo(brand: any): string | null {
  return (
    brand?.logo_primary_url ||
    brand?.logo_dark_url ||
    brand?.logo_light_url ||
    brand?.logo_white_url ||
    null
  );
}
