// Shared design tokens + helpers for the private brand portal surface
// (/portal/[token]). Kept in one place so the layout, home page, and media
// library all match the existing design system exactly.

export const ORANGE = "#D73F09";
export const OFFWHITE = "#FAF8F5";
export const BG = "#07070a";
export const BEBAS = {
  fontFamily: "var(--font-bebas), 'Bebas Neue', Arial, sans-serif",
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
