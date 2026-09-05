// ============================================================
// /clients data loader — Supabase is the source of truth
//
// Replaces the static src/lib/data/brands.ts for this page only. That file is
// still imported by other routes (including /clients/[slug]) and is untouched.
//
// Two things this file owns that the page should not have to think about:
//
//   1. Which logo file belongs on which surface. `brand_logos` is the real
//      library; the legacy brands.logo_*_url columns are the fallback. The
//      resolver in @/lib/brand-logo never falls back across variants, so an
//      on_white file (dark ink) can never end up on a dark surface.
//
//   2. Whether a tile may link. /clients/[slug] resolves through
//      getBrandBySlug() against the STATIC brands.ts, so a Supabase slug that
//      file does not carry 404s. 13 brands have no detail page at all; they
//      render as tiles without an anchor rather than as broken links.
// ============================================================

import { createPlainSupabase } from '@/lib/supabase';
import {
  BRAND_LOGO_COLUMNS,
  groupLogosByBrand,
  resolveBrandLogo,
  type BrandLogoRow,
} from '@/lib/brand-logo';

/**
 * Band logo sizes live in brands.lockup_scale as a multiplier on this base,
 * which is the semantic the column already had (Adidas 0.72 == 7.91vh / 11).
 * Heights themselves were measured from each file's alpha bounds and equalise
 * ink AREA rather than box height — see the migration for the derivation.
 */
export const BAND_LOGO_BASE_VH = 11;

/**
 * Supabase slug -> brands.ts slug, for brands the detail route knows under a
 * different spelling. Every pair here was verified by comparing brand NAME on
 * both sides, not by string similarity.
 */
const ROUTE_SLUG_ALIASES: Record<string, string> = {
  '1800flowers': '1-800-flowers',
  '7eleven': '7-eleven',
  hydroflask: 'hydro-flask',
  mm: 'mms',
  statsports: 'stat-sports',
  yesly: 'yesly-water',
  'c4-energy': 'c4',
  'dicks-sporting-goods': 'dicks',
  'monday-haircare': 'monday',
  york: 'york-athletics',
};

/**
 * Brands with no /clients/[slug] page under any spelling. Tiles for these
 * render unlinked. Note free-people is NOT an alias of free-people-movement —
 * Supabase carries both as separate brands.
 */
const NO_DETAIL_PAGE = new Set([
  'athlete-ally',
  'betterhelp',
  'brewshock',
  'coty',
  'drink-lick',
  'flipgrid',
  'free-people',
  'gat-sport',
  'izod',
  'jewlr',
  'loreal',
  'mars',
  'topps',
]);

/** The seven bands with footage, in the order they appear. */
export const BAND_ORDER = [
  'adidas',
  'cvs',
  'allstate',
  'crocs',
  'wendys',
  '7eleven',
  'raising-canes',
] as const;

/** The three bands that have no footage, in the order they appear. */
export const SILENT_BAND_ORDER = ['hollister', 'mcdonalds', 'dove'] as const;

// Footage. Still hotlinked from the Wix CDN — the archive copies are smaller
// and self-hosted but the upload to Supabase storage is not approved yet.
export const CLIPS: Record<string, string> = {
  adidas: 'https://video.wixstatic.com/video/ba5ed8_ebf91867c7b84bc0b5198a8c85c50c0f/1080p/mp4/file.mp4',
  cvs: 'https://video.wixstatic.com/video/ba5ed8_bc5962641cd34a73bcf0e16398f387ad/1080p/mp4/file.mp4',
  allstate: 'https://video.wixstatic.com/video/ba5ed8_c6023f2d60c6486da454627cad71dd8a/1080p/mp4/file.mp4',
  crocs: 'https://video.wixstatic.com/video/ba5ed8_0b4b2841c82c40d8a4332a62cafe0f88/1080p/mp4/file.mp4',
  '7eleven': 'https://video.wixstatic.com/video/ba5ed8_8a2570e013304468aff3de0821397150/1080p/mp4/file.mp4',
  'raising-canes': 'https://video.wixstatic.com/video/ba5ed8_50e5c84c697443299a000521408f8645/1080p/mp4/file.mp4',
  wendys: 'https://video.wixstatic.com/video/ba5ed8_9e8bacb6acaa4e469d66c4fca67f290b/1080p/mp4/file.mp4',
};

export const POSTERS: Record<string, string> = {
  adidas: 'https://static.wixstatic.com/media/ba5ed8_ebf91867c7b84bc0b5198a8c85c50c0ff000.jpg',
  cvs: 'https://static.wixstatic.com/media/ba5ed8_bc5962641cd34a73bcf0e16398f387adf000.jpg',
  allstate: 'https://static.wixstatic.com/media/ba5ed8_c6023f2d60c6486da454627cad71dd8af000.jpg',
  crocs: 'https://static.wixstatic.com/media/ba5ed8_0b4b2841c82c40d8a4332a62cafe0f88f000.jpg',
  '7eleven': 'https://static.wixstatic.com/media/ba5ed8_8a2570e013304468aff3de0821397150f000.jpg',
  'raising-canes': 'https://static.wixstatic.com/media/ba5ed8_50e5c84c697443299a000521408f8645f000.jpg',
  wendys: 'https://static.wixstatic.com/media/ba5ed8_9e8bacb6acaa4e469d66c4fca67f290bf000.jpg',
};

export type ClientBrand = {
  id: string;
  name: string;
  slug: string;
  /** null when no detail page exists — the tile renders without an anchor. */
  href: string | null;
  fill: string | null;
  fillConfidence: string | null;
  /** Dark-ink file, for the white tile at rest. */
  logoOnLight: string | null;
  /** Light-ink file, for the brand-colour tile on hover and for the bands. */
  logoOnDark: string | null;
  /** False when no variant reads on the tile ground — the tile shows its name. */
  restLogoReads: boolean;
  /** Box height in vh for a full-bleed band, from lockup_scale. */
  bandLogoVh: number | null;
  hasFootage: boolean;
};

type BrandRow = {
  id: string;
  name: string;
  slug: string | null;
  fill_color: string | null;
  fill_color_confidence: string | null;
  logo_primary_url: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  logo_white_url: string | null;
  lockup_scale: number | string | null;
};

/** The tile ground. Every rest-state logo has to survive on this. */
export const TILE_GROUND = '#FAF8F5';

function rgb(hex: string | null): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(c: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/** WCAG contrast ratio between two hexes; null when either is unknown. */
export function contrastRatio(a: string | null, b: string | null): number | null {
  const ca = rgb(a);
  const cb = rgb(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The bar a logo must clear against the ground it sits on.
 *
 * Deliberately below WCAG's 3:1 — that figure is for UI components that must be
 * *identified*, and a brand mark is not one. The job here is narrower: catch
 * marks that are genuinely invisible (a white file mistagged on_white -- there
 * are 13 such rows in brand_logos) without
 * demoting quiet-but-legible ones. goodr's teal at 2.4:1 and Heydude's mid-tone
 * at 2.6:1 read perfectly well on off-white; Dove's #CDCDCF at 1.7:1 does not.
 *
 * Note the ink figures themselves are conservative: they are the mean of every
 * opaque pixel, so a mark with dark outlines over a pale field scores lower than
 * it actually reads.
 */
const MIN_LOGO_CONTRAST = 1.8;


/** Relative luminance, for deciding which ink survives on a given fill. */
export function isLightFill(hex: string | null): boolean {
  if (!hex) return false;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2] > 0.45;
}

function routeHref(slug: string): string | null {
  if (NO_DETAIL_PAGE.has(slug)) return null;
  return `/clients/${ROUTE_SLUG_ALIASES[slug] ?? slug}`;
}

export async function loadClientsPage(): Promise<{
  bands: ClientBrand[];
  silentBands: ClientBrand[];
  tiles: ClientBrand[];
}> {
  const supabase = createPlainSupabase();

  const { data: brandRows } = await supabase
    .from('brands')
    .select(
      'id,name,slug,fill_color,fill_color_confidence,logo_primary_url,logo_dark_url,logo_light_url,logo_white_url,lockup_scale'
    )
    .eq('show_on_clients_page', true)
    .not('slug', 'is', null);

  const rows = (brandRows ?? []) as BrandRow[];
  const ids = rows.map((r) => r.id);

  const { data: logoRows } = ids.length
    ? await supabase.from('brand_logos').select(BRAND_LOGO_COLUMNS).in('brand_id', ids)
    : { data: [] as BrandLogoRow[] };

  const byBrand = groupLogosByBrand((logoRows ?? []) as BrandLogoRow[]);

  const all: ClientBrand[] = rows.map((r) => {
    const logos = byBrand.get(r.id) ?? [];
    const slug = r.slug as string;

    // brand_logos first, legacy columns second. A lockup reads better than a
    // bare mark at tile size, so that is the preferred kind here.
    const lightPick = resolveBrandLogo(logos, { surface: 'light', prefer: 'lockup' });
    const darkPick =
      resolveBrandLogo(logos, { surface: 'brand', prefer: 'lockup' }) ??
      resolveBrandLogo(logos, { surface: 'dark', prefer: 'lockup' });

    // The variant LABEL is not enough. Several files tagged on_white carry white
    // ink, and rendering one on the off-white tile produces an invisible logo —
    // exactly the failure the resolver's own comment warns about, one level up.
    // So the rest logo is chosen by its ink's contrast against the tile ground,
    // and only falls back to the label when no ink is known either way.
    // ink_hex is populated for every non-dated row now, so the column is the
    // only source — no override map. A null here means genuinely unknown.
    const lightInk = lightPick?.inkHex ?? null;
    const darkInk = darkPick?.inkHex ?? null;
    const lightContrast = contrastRatio(lightInk, TILE_GROUND);
    const darkContrast = contrastRatio(darkInk, TILE_GROUND);

    const lightReads = lightContrast == null || lightContrast >= MIN_LOGO_CONTRAST;
    const darkReads = darkContrast != null && darkContrast >= MIN_LOGO_CONTRAST;

    // Prefer the on_white file, but hand over to the other variant when its ink
    // measurably fails and the other measurably passes.
    const restPick = lightReads ? lightPick : darkReads ? darkPick : null;

    const onLight =
      restPick?.url ??
      (lightReads ? r.logo_dark_url ?? r.logo_primary_url : null) ??
      null;

    const onDark = darkPick?.url ?? r.logo_light_url ?? r.logo_white_url ?? null;

    const scale = r.lockup_scale == null ? null : Number(r.lockup_scale);

    return {
      id: r.id,
      name: r.name,
      slug,
      href: routeHref(slug),
      fill: r.fill_color,
      fillConfidence: r.fill_color_confidence,
      logoOnLight: onLight,
      logoOnDark: onDark,
      /** False when no variant's ink survives the tile ground — use a named tile. */
      restLogoReads: Boolean(onLight) && (lightReads || darkReads),
      bandLogoVh:
        scale != null && Number.isFinite(scale) ? scale * BAND_LOGO_BASE_VH : null,
      hasFootage: Boolean(CLIPS[slug]),
    };
  });

  const bySlug = new Map(all.map((b) => [b.slug, b]));
  const pick = (slugs: readonly string[]) =>
    slugs.map((s) => bySlug.get(s)).filter((b): b is ClientBrand => Boolean(b));

  return {
    bands: pick(BAND_ORDER),
    silentBands: pick(SILENT_BAND_ORDER),
    // The grid is the full roster, bands included — a brand that headlines a
    // band still belongs in the alphabetical roster below it.
    tiles: all.slice().sort((a, b) => {
      const an = /^\d/.test(a.name.trim());
      const bn = /^\d/.test(b.name.trim());
      if (an !== bn) return an ? 1 : -1;
      return a.name.localeCompare(b.name);
    }),
  };
}
