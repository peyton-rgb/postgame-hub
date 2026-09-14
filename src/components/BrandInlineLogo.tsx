"use client";

// ============================================================
// Brand logo for the dashboard's inline list rows (Trackers, Campaign Opt-In).
//
// These lists used to read `logo_light_url || logo_url` straight off the row.
// logo_light_url is light INK, built for a DARK ground — so in light mode they
// rendered a white mark on a white card and the logo simply vanished. The
// column name describes the ink, not the background; pickBrandLogo() is the one
// place that knows that, and it never reaches for the opposite-ink variant.
//
// When pickBrandLogo returns a file whose ink is UNVERIFIED for this ground
// (inkMismatch — the brand has no variant for this theme, so primary/legacy is
// being shown on a guess), the mark goes on an inverse-ground chip rather than
// bare on the card. rgb(var(--ink-rgb)) is the ink colour used as a fill, which
// is by definition the opposite of the ground in both themes, so an unverified
// file has contrast whichever way it was drawn.
//
// Deliberately NOT a CSS filter inversion: that recolours real client artwork,
// which is not ours to do, and it turns a two-colour lockup into mud.
// ============================================================

import { pickBrandLogo, type BrandLogoColumns, type HubTheme } from "@/lib/brand-logo";

export function BrandInlineLogo({
  brand,
  name,
  theme,
}: {
  brand: BrandLogoColumns | null | undefined;
  name: string;
  theme: HubTheme;
}) {
  const picked = pickBrandLogo(brand, theme);

  // No safe file. The brand name sits directly beside this in both lists, so an
  // empty slot reads as "no logo on file" rather than as something broken —
  // and an invisible mark would read as neither.
  if (!picked) return null;

  const img = (
    <img
      src={picked.url}
      alt={name}
      className="h-[16px] max-w-[60px] object-contain flex-shrink-0"
    />
  );

  if (!picked.inkMismatch) return img;

  return (
    <span
      className="inline-flex items-center rounded px-1 py-0.5 flex-shrink-0"
      style={{ backgroundColor: "rgb(var(--ink-rgb))" }}
      title={`${name} has no logo variant for this theme`}
    >
      {img}
    </span>
  );
}
