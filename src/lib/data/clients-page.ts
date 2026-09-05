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
  type BrandLogoRow,
} from '@/lib/brand-logo';

/**
 * brands.lockup_scale is the fraction of a directory TILE's height that the
 * logo box should occupy. Solved per brand from alpha bounds measured on the
 * file the tile actually renders, so every mark carries comparable ink AREA
 * rather than being clamped to the same max-height.
 *
 * Fixed clamps gave a 24.5x spread in ink area across the 67 tiles that show a
 * logo (Armani 0.011 of the tile, BERO 0.275). These values bring that to 1.5x.
 *
 * Its previous meaning — box height in vh over an 11vh base — belonged to the
 * 38vh bands, which no longer exist.
 */
export const TILE_LOGO_SCALE_DEFAULT = 0.40;

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

// Footage. Self-hosted in Supabase storage — these are the archive cuts
// (1.2-3.7MB each, 12s) rather than the Wix originals (14-27MB, 27s). Seven
// films in one grid made the payload decisive: ~17.5MB total against ~130MB.
const SB_CLIENTS =
  'https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/clients-page';
const FILM_BASE = `${SB_CLIENTS}/films`;

export const CLIPS: Record<string, string> = {
  adidas: `${FILM_BASE}/adidas.mp4`,
  cvs: `${FILM_BASE}/cvs.mp4`,
  allstate: `${FILM_BASE}/allstate.mp4`,
  crocs: `${FILM_BASE}/crocs.mp4`,
  '7eleven': `${FILM_BASE}/7-eleven.mp4`,
  'raising-canes': `${FILM_BASE}/raising-canes.mp4`,
  wendys: `${FILM_BASE}/wendys.mp4`,
};

export const POSTERS: Record<string, string> = {
  adidas: `${FILM_BASE}/adidas.jpg`,
  cvs: `${FILM_BASE}/cvs.jpg`,
  allstate: `${FILM_BASE}/allstate.jpg`,
  crocs: `${FILM_BASE}/crocs.jpg`,
  '7eleven': `${FILM_BASE}/7-eleven.jpg`,
  'raising-canes': `${FILM_BASE}/raising-canes.jpg`,
  wendys: `${FILM_BASE}/wendys.jpg`,
};

/**
 * Carousel stills. 3:4 portrait crops cut from each film.
 *
 * public.media holds 724 campaign images across four of these seven brands,
 * but `aspect_ratio` is null on all 3,530 image rows and `public_selected` is
 * false on every one — so there is no way to query for a portrait crop or for a
 * curated pick. allstate, crocs and 7-eleven have no campaign images at all.
 * Cutting from the films is what gives all seven a consistent 3:4 frame.
 */
const CAROUSEL_BASE = `${SB_CLIENTS}/carousel`;

export const CAROUSEL_STILLS: Record<string, string> = {
  // Cut from each film.
  adidas: `${CAROUSEL_BASE}/adidas.jpg`,
  cvs: `${CAROUSEL_BASE}/cvs.jpg`,
  allstate: `${CAROUSEL_BASE}/allstate.jpg`,
  crocs: `${CAROUSEL_BASE}/crocs.jpg`,
  wendys: `${CAROUSEL_BASE}/wendys.jpg`,
  'raising-canes': `${CAROUSEL_BASE}/raising-canes.jpg`,
  '7eleven': `${CAROUSEL_BASE}/7-eleven.jpg`,
  // Stills-only brands. Chosen from public.media by is_hero, then
  // quality_score, then rank; EXIF-rotated, cropped 3:4 biased 32% from the
  // top so faces do not sit dead-centre, and re-encoded at 900x1200.
  // aspect_ratio is null on every image row, so the crop could not be chosen
  // by query — each candidate was measured off its own pixels.
  brooks: `${CAROUSEL_BASE}/brooks.jpg`,
  bero: `${CAROUSEL_BASE}/bero.jpg`,
  hydroflask: `${CAROUSEL_BASE}/hydroflask.jpg`,
  statsports: `${CAROUSEL_BASE}/statsports.jpg`,
  'taco-johns': `${CAROUSEL_BASE}/taco-johns.jpg`,
  goodr: `${CAROUSEL_BASE}/goodr.jpg`,
  brewshock: `${CAROUSEL_BASE}/brewshock.jpg`,
  mcdonalds: `${CAROUSEL_BASE}/mcdonalds.jpg`,
  papatui: `${CAROUSEL_BASE}/papatui.jpg`,
  dove: `${CAROUSEL_BASE}/dove.jpg`,
  whoop: `${CAROUSEL_BASE}/whoop.jpg`,
  zenni: `${CAROUSEL_BASE}/zenni.jpg`,
};

/**
 * The row, in display order: the seven film brands interleaved with the twelve
 * stills-only ones rather than grouped, so the row does not read as "the real
 * ones first, then the rest". Only the seven with a clip can take the hero.
 */
export const CARD_ORDER = [
  'adidas',
  'brooks',
  'cvs',
  'bero',
  'allstate',
  'hydroflask',
  'crocs',
  'statsports',
  'wendys',
  'taco-johns',
  '7eleven',
  'goodr',
  'raising-canes',
  'brewshock',
  'mcdonalds',
  'papatui',
  'dove',
  'whoop',
  'zenni',
] as const;

/**
 * Hero fallback video, kept for reference. The carousel replaced it as the
 * page's opening element. — a clients page should not
 * lead with one client's logo. Re-encoded from the 60MB HEVC master in
 * banner_videos: HEVC does not play in Chrome or Firefox, so this is H.264,
 * 1920x1038, 30fps, 5.5MB.
 */
export const HERO = {
  video: `https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/clients-page/hero/postgame-hero.mp4`,
  poster: `https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/clients-page/hero/postgame-hero.jpg`,
};

/** One featured film: a brand, its clip, and a real campaign line. */
export type FeaturedFilm = ClientBrand & {
  /** null for the twelve stills-only brands. */
  clip: string | null;
  poster: string | null;
  /** 3:4 portrait crop. Every card has one. */
  still: string;
  campaignCount: number;
  campaignName: string | null;
  /**
   * Whether this card may take the hero. False for the stills-only brands: a
   * frozen photo where every other hero plays reads as a video that failed to
   * load. They render an identical card and link to their detail page instead.
   */
  canPromote: boolean;
};

export type ClientBrand = {
  id: string;
  name: string;
  slug: string;
  /** null when no detail page exists — the tile renders without an anchor. */
  href: string | null;
  fill: string | null;
  fillConfidence: string | null;
  /** Rest-state file for the dark tile: light-ink artwork. */
  logoOnLight: string | null;
  /** Light-ink file, for the brand-colour tile on hover and for the bands. */
  logoOnDark: string | null;
  /**
   * The file to use over photography: full-colour where it survives the scrim
   * ground, light-ink otherwise. Set by the loader; it was missing from this
   * type, so every consumer of it was an implicit `any`.
   */
  photoLogo: string | null;
  /** Always false — the file renders as drawn rather than being silhouetted. */
  photoLogoKnockout: boolean;
  /** False when no variant reads on the tile ground — the tile shows its name. */
  restLogoReads: boolean;
  /** Fraction of the tile's height the logo box should occupy. */
  tileLogoScale: number | null;
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

/**
 * The tile ground. Every rest-state logo has to survive on this.
 *
 * The directory was a slab of white tiles on a black page, which read as a
 * different site. Inverting it also fixed a data problem: on white only 67 of
 * 88 brands had a logo that read, because most of the library is light-ink
 * artwork built for dark grounds. On #0A0A0A that becomes 85 of 88.
 */
export const TILE_GROUND = '#0A0A0A';   // bg-surface-2 — the directory is dark now

/**
 * The effective ground a carousel mark sits on: a photograph under the card's
 * 0.70 scrim. Dark frames composite to roughly this, so it is what a colour
 * logo has to survive. pickForGround measures against it, which is how a mark
 * whose own colour cannot hold (Allstate's navy) falls through to the brand's
 * light-ink file instead.
 */
export const PHOTO_SCRIM_GROUND = '#1C1C1F';

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

/**
 * Pick one file for one ground.
 *
 * This does what @/lib/brand-logo's resolveBrandLogo does, plus two things the
 * tile grid needs and the shared resolver deliberately leaves to its caller:
 *
 *   1. It ranks by whether the file's INK actually reads on the ground, not by
 *      a fixed kind preference. Asking for `prefer: 'lockup'` returns the
 *      lockup and stops — so Drink Lick got its #728859 lockup while a #060606
 *      wordmark sat unused in the same variant at 19:1.
 *
 *   2. It handles plates. `has_alpha === false` means the background is baked
 *      in, and the variant label does NOT tell you what colour it is: several
 *      files here are tagged on_white but are 78-86% dark pixels, so on a white
 *      tile they draw a dark box. A plate is therefore only used when bg_hex is
 *      recorded AND matches the ground it is going onto. Unknown background =
 *      not used, because the failure is a visible rectangle, not a subtle one.
 *      Bands reject plates outright: they knock the logo out with
 *      brightness(0) invert, which turns any plate into a solid rectangle.
 *
 * It never crosses variants. `brand-logo.ts` is explicit that falling back on
 * variant is what makes a logo invisible — an on_black file carries light ink
 * by definition and can never be the right answer on a white tile. When no file
 * in the requested variant reads, this returns null and the tile shows its name.
 */
function pickForGround(
  logos: BrandLogoRow[],
  variant: 'on_white' | 'on_black' | 'on_brand',
  ground: string,
  opts: { requireAlpha?: boolean; kindOrder?: string[] } = {}
): { url: string; inkHex: string | null } | null {
  const KIND_RANK = opts.kindOrder ?? ['lockup', 'mark', 'wordmark', 'mono'];
  const candidates = logos
    .filter(
      (l) =>
        l.variant === variant &&
        !l.dated &&
        !l.reject_reason &&
        !!l.url &&
        (l.has_alpha !== false ||
          (!opts.requireAlpha &&
            l.bg_hex != null &&
            (contrastRatio(l.bg_hex, ground) ?? 99) < 1.3))
    )
    .map((l) => {
      const c = contrastRatio(l.ink_hex, ground);
      return { row: l, contrast: c, reads: c == null || c >= MIN_LOGO_CONTRAST };
    })
    .filter((x) => x.reads)
    .sort((a, b) => {
      const ra = KIND_RANK.indexOf(a.row.kind);
      const rb = KIND_RANK.indexOf(b.row.kind);
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
    });

  const best = candidates[0];
  return best ? { url: best.row.url, inkHex: best.row.ink_hex } : null;
}

export async function loadClientsPage(): Promise<{
  films: FeaturedFilm[];
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

    // Rest state: the tile is dark, so it wants light-ink artwork — on_black
    // first, on_brand second. No crossing into on_white: that is dark ink and
    // would vanish.
    const restPick =
      pickForGround(logos, 'on_black', TILE_GROUND) ??
      pickForGround(logos, 'on_brand', TILE_GROUND);

    // Hover state: the tile fills with the brand's own colour. On a light fill
    // white ink dies, so the ground still decides which variant to ask for.
    const fill = r.fill_color ?? '#07070A';
    const hoverPick = isLightFill(fill)
      ? pickForGround(logos, 'on_white', fill) ?? pickForGround(logos, 'on_brand', fill)
      : pickForGround(logos, 'on_brand', fill) ?? pickForGround(logos, 'on_black', fill);

    // Legacy columns are the last resort, and only for the rest state — their
    // ink is unknown, so they are trusted only when brand_logos has nothing.
    // On a photograph the mark renders in its own colours, so the pick is the
    // brand-colour file — which lives in on_white, since on_black variants are
    // usually white knockouts.
    //
    // A scrim can only darken, so it rescues a light mark and actively hurts a
    // dark one. Allstate's colour artwork is #0033A0 navy: measured against its
    // own frame under a 0.70 scrim it reaches 1.6:1 and cannot be saved by more
    // scrim. Where the colour ink cannot hold against a scrimmed frame, fall
    // back to the brand's light-ink file instead.
    const colourPick = pickForGround(logos, 'on_white', PHOTO_SCRIM_GROUND, {
      requireAlpha: true,
      kindOrder: ['lockup', 'wordmark', 'mark', 'mono'],
    });
    const lightInkPick =
      pickForGround(logos, 'on_black', PHOTO_SCRIM_GROUND, { requireAlpha: true }) ??
      pickForGround(logos, 'on_brand', PHOTO_SCRIM_GROUND, { requireAlpha: true });

    const photoLogo = colourPick?.url ?? lightInkPick?.url ?? r.logo_light_url ?? null;
    // Nothing is knocked out any more — the file renders as drawn.
    const photoLogoKnockout = false;

    const onLight =
      restPick?.url ??
      (logos.length ? null : r.logo_light_url ?? r.logo_white_url) ??
      null;
    const onDark = hoverPick?.url ?? r.logo_light_url ?? r.logo_white_url ?? null;


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
      photoLogo,
      photoLogoKnockout,
      /** False when no on_white file survives the tile ground — use a named tile. */
      restLogoReads: Boolean(onLight),
      tileLogoScale: scale != null && Number.isFinite(scale) ? scale : null,
      hasFootage: Boolean(CLIPS[slug]),
    };
  });

  const bySlug = new Map(all.map((b) => [b.slug, b]));

  // Campaign lines come from brand_campaigns — real campaign names and counts,
  // not invented copy. brands.tagline is empty for all 88, so it is not an option.
  const filmSlugs = [...CARD_ORDER];
  const filmIds = filmSlugs
    .map((sl) => bySlug.get(sl)?.id)
    .filter((x): x is string => Boolean(x));

  const { data: campaignRows } = filmIds.length
    ? await supabase
        .from('brand_campaigns')
        .select('brand_id,name,created_at')
        .in('brand_id', filmIds)
    : { data: [] as { brand_id: string; name: string | null; created_at: string | null }[] };

  const campaignsByBrand = new Map<string, { count: number; latest: string | null }>();
  for (const row of campaignRows ?? []) {
    const cur = campaignsByBrand.get(row.brand_id) ?? { count: 0, latest: null };
    cur.count += 1;
    if (row.name && !cur.latest) cur.latest = row.name;
    campaignsByBrand.set(row.brand_id, cur);
  }

  const films: FeaturedFilm[] = CARD_ORDER.map((sl) => bySlug.get(sl))
    .filter((b): b is ClientBrand => Boolean(b))
    // A slug with no uploaded still would render an empty card, so drop it
    // rather than leave a hole in the row.
    .filter((b) => Boolean(CAROUSEL_STILLS[b.slug]))
    .map((b) => {
      const c = campaignsByBrand.get(b.id);
      const clip = CLIPS[b.slug] ?? null;
      return {
        ...b,
        clip,
        poster: POSTERS[b.slug] ?? null,
        still: CAROUSEL_STILLS[b.slug],
        campaignCount: c?.count ?? 0,
        campaignName: c?.latest ?? null,
        canPromote: Boolean(clip),
      };
    });

  return {
    films,
    // The directory is the whole roster, alphabetically. Brands with a film
    // still appear here — a directory lists everyone.
    tiles: all.slice().sort((a, b) => {
      const an = /^\d/.test(a.name.trim());
      const bn = /^\d/.test(b.name.trim());
      if (an !== bn) return an ? 1 : -1;
      return a.name.localeCompare(b.name);
    }),
  };
}
