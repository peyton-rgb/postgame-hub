// ============================================================
// Public posting-package lookup — shared by /api/deliver/[token]/*
//
// Same shape as /api/submit/[token]: the delivery_token in the URL is the
// only gate, and the lookup runs server-side on the service-role client, so
// posting_packages needs no anon RLS policy at all.
//
//   • One row, matched by exact equality on delivery_token.
//   • Only the fields the athlete page renders go back to the browser —
//     never delivery_token, am_notes, or any internal id.
//   • Writes re-match on the token too (never on an id from the browser),
//     and touch ONLY the athlete-owned columns: confirmed_at, posted_at,
//     live_url — plus status, and only ever to 'posted'.
//
// No-store client (createLiveServiceSupabase) because this read decides
// access: a Data-Cached row would keep serving after staff change it.
//
// Campaign-level copy (tag handle, hashtag, FTC note, invoice address, which
// walkthrough to show) comes from posting_campaigns (migration 072), joined
// through posting_packages.posting_campaign_id. The deliverable a row is —
// reel or feed — is posting_packages.deliverable_key, looked up in that
// campaign's `deliverables` list.
// ============================================================

import { createLiveServiceSupabase } from '@/lib/supabase-server';
import {
  BRAND_LOGO_COLUMNS,
  pickBrandLogo,
  resolveBrandLogo,
  type BrandLogoRow,
} from '@/lib/brand-logo';

const POSTGAME_BRAND_ID = '7a0e28e9-d62f-427d-a207-cd22596fcf50';

// Columns read from posting_packages. am_notes is deliberately absent: it is
// internal and must never reach the athlete, so it is never even selected.
const READ_COLUMNS = [
  'athlete_name',
  'school',
  'ig_handle',
  'deliverable_key',
  'posting_campaign_id',
  'intended_post_date',
  'post_date_label',
  'date_conditional',
  'video_url',
  'cover_url',
  'video_status',
  'caption_short',
  'caption_medium',
  'caption_long',
  'caption_status',
  'ftc_note',
  'status',
  'confirmed_at',
  'posted_at',
  'live_url',
].join(', ');

type PackageRow = {
  athlete_name: string;
  school: string | null;
  ig_handle: string | null;
  deliverable_key: string | null;
  posting_campaign_id: string | null;
  intended_post_date: string | null;
  post_date_label: string | null;
  date_conditional: boolean | null;
  video_url: string | null;
  cover_url: string | null;
  video_status: string | null;
  caption_short: string | null;
  caption_medium: string | null;
  caption_long: string | null;
  caption_status: string | null;
  ftc_note: string | null;
  status: string | null;
  confirmed_at: string | null;
  posted_at: string | null;
  live_url: string | null;
};

type Deliverable = {
  key: string;
  label: string;
  order?: number;
  files?: string[];
  platforms?: string[];
  walkthrough?: string | null;
};

type CampaignRow = {
  brand_id: string;
  title: string | null;
  season_label: string | null;
  tag_handle: string | null;
  hashtag: string | null;
  ftc_note: string | null;
  invoice_email: string | null;
  deliverables: Deliverable[] | null;
};

type BrandRow = {
  id: string;
  name: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  logo_primary_url: string | null;
  logo_url: string | null;
};

/** One file slot on the page: 'video' | 'cover' | 'photo'. */
export type FileKind = 'video' | 'cover' | 'photo';

/** Exactly what GET /api/deliver/[token] returns. Nothing internal. */
export type DeliverView = {
  athlete: { name: string; school: string | null; handle: string | null };
  post: {
    deliverableKey: string | null;
    label: string | null;
    dateLabel: string | null;
    date: string | null;
    dateConditional: boolean;
  };
  files: {
    videoUrl: string | null;
    coverUrl: string | null;
    videoStatus: string | null;
    /** Which slots to render, in order. Reel: video + cover. Feed: photo. */
    slots: FileKind[];
  };
  caption: { text: string | null; status: string | null };
  campaign: {
    title: string | null;
    seasonLabel: string | null;
    brandName: string | null;
    tagHandle: string | null;
    hashtag: string | null;
    ftcNote: string | null;
    invoiceEmail: string | null;
    walkthrough: string | null;
    platforms: string[];
  };
  logos: { postgame: string | null; brand: string | null };
  link: { liveUrl: string | null; postedAt: string | null };
  status: string;
};

// The athlete no longer writes most of `status` (it belongs to staff), so the
// page's sent → confirmed → posted flow is derived from the timestamps the
// athlete DOES own. A status staff set directly still wins when further along.
export function athleteStage(row: Pick<PackageRow, 'status' | 'confirmed_at' | 'posted_at'>): string {
  const status = row.status ?? 'draft';
  if (row.posted_at || ['posted', 'metrics_due', 'complete'].includes(status)) return 'posted';
  if (row.confirmed_at || status === 'confirmed') return 'confirmed';
  return status;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// intended_post_date is a plain `date` ('2026-09-26'). Read it as a calendar
// day in UTC so no server timezone can shift it to the 25th.
export function formatPostDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function slotsFor(deliverable: Deliverable | undefined, key: string | null): FileKind[] {
  const known = (deliverable?.files ?? []).filter(
    (f): f is FileKind => f === 'video' || f === 'cover' || f === 'photo'
  );
  if (known.length) return known;
  // No campaign row yet: fall back on the deliverable key alone.
  return key === 'feed' ? ['photo'] : ['video', 'cover'];
}

function stripAt(handle: string | null | undefined): string | null {
  const h = (handle ?? '').trim().replace(/^@+/, '');
  return h || null;
}

async function loadLogos(
  supabase: ReturnType<typeof createLiveServiceSupabase>,
  brandId: string | null
): Promise<{ postgame: string | null; brand: string | null; brandName: string | null }> {
  const ids = brandId ? [POSTGAME_BRAND_ID, brandId] : [POSTGAME_BRAND_ID];
  const [{ data: brands }, { data: logoRows }] = await Promise.all([
    supabase
      .from('brands')
      .select('id, name, logo_light_url, logo_dark_url, logo_primary_url, logo_url')
      .in('id', ids),
    supabase.from('brand_logos').select(BRAND_LOGO_COLUMNS).in('brand_id', ids),
  ]);

  const byId = new Map(((brands ?? []) as BrandRow[]).map((b) => [b.id, b]));
  const rows = (logoRows ?? []) as BrandLogoRow[];
  const rowsFor = (id: string) => rows.filter((r) => r.brand_id === id);

  // Postgame sits on the dark page: its on_black lockup, else the light-ink
  // column. The brand sits on an off-white plate: its on_white lockup, else
  // the dark-ink column. Never the opposite ink (see brand-logo.ts).
  const postgame =
    resolveBrandLogo(rowsFor(POSTGAME_BRAND_ID), { surface: 'dark', prefer: 'lockup' })?.url ??
    pickBrandLogo(byId.get(POSTGAME_BRAND_ID), 'dark')?.url ??
    null;
  const brand = brandId
    ? resolveBrandLogo(rowsFor(brandId), { surface: 'light', prefer: 'lockup' })?.url ??
      pickBrandLogo(byId.get(brandId), 'light')?.url ??
      null
    : null;

  return { postgame, brand, brandName: brandId ? byId.get(brandId)?.name?.trim() || null : null };
}

// Tokens exist in three shapes: crypto.randomUUID() / the column default
// (36 chars), randomBytes(24).toString('hex') (48), and the 12-hex tokens on
// every row loaded 2026-09-01/02. All hex-and-dash, so reject anything else
// before a query is ever made — but do not tighten the length floor without
// checking the live rows, or real links 404.
const TOKEN_RE = /^[0-9a-f-]{12,64}$/i;

export function isPlausibleToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

async function loadRow(token: string): Promise<PackageRow | null> {
  if (!isPlausibleToken(token)) return null;
  const supabase = createLiveServiceSupabase();
  const { data, error } = await supabase
    .from('posting_packages')
    .select(READ_COLUMNS)
    .eq('delivery_token', token)
    .maybeSingle();
  if (error) {
    console.error('deliver: package lookup failed', error);
    return null;
  }
  return (data as PackageRow | null) ?? null;
}

export async function loadDeliverView(token: string): Promise<DeliverView | null> {
  const row = await loadRow(token);
  if (!row) return null;

  const supabase = createLiveServiceSupabase();
  let campaign: CampaignRow | null = null;
  if (row.posting_campaign_id) {
    const { data, error } = await supabase
      .from('posting_campaigns')
      .select('brand_id, title, season_label, tag_handle, hashtag, ftc_note, invoice_email, deliverables')
      .eq('id', row.posting_campaign_id)
      .maybeSingle();
    if (error) console.error('deliver: campaign lookup failed', error);
    campaign = (data as CampaignRow | null) ?? null;
  }

  const deliverable = (campaign?.deliverables ?? []).find((d) => d.key === row.deliverable_key);
  const logos = await loadLogos(supabase, campaign?.brand_id ?? null);

  return {
    athlete: {
      name: row.athlete_name,
      school: row.school?.trim() || null,
      handle: stripAt(row.ig_handle),
    },
    post: {
      deliverableKey: row.deliverable_key,
      label: deliverable?.label ?? null,
      dateLabel: row.post_date_label?.trim() || formatPostDate(row.intended_post_date),
      date: row.intended_post_date,
      dateConditional: !!row.date_conditional,
    },
    files: {
      videoUrl: row.video_url,
      coverUrl: row.cover_url,
      videoStatus: row.video_status,
      slots: slotsFor(deliverable, row.deliverable_key),
    },
    caption: {
      text: row.caption_medium?.trim() || row.caption_short?.trim() || row.caption_long?.trim() || null,
      status: row.caption_status,
    },
    campaign: {
      title: campaign?.title ?? null,
      seasonLabel: campaign?.season_label ?? null,
      brandName: logos.brandName,
      tagHandle: stripAt(campaign?.tag_handle),
      hashtag: campaign?.hashtag ?? null,
      ftcNote: campaign?.ftc_note ?? row.ftc_note,
      invoiceEmail: campaign?.invoice_email ?? null,
      walkthrough: deliverable?.walkthrough ?? null,
      platforms: deliverable?.platforms ?? [],
    },
    logos: { postgame: logos.postgame, brand: logos.brand },
    link: { liveUrl: row.live_url, postedAt: row.posted_at },
    status: athleteStage(row),
  };
}

/** Just the state the write routes need to decide what to do. */
export async function loadPackageState(
  token: string
): Promise<(Pick<PackageRow, 'status' | 'confirmed_at' | 'posted_at' | 'live_url'> & { stage: string }) | null> {
  const row = await loadRow(token);
  if (!row) return null;
  return {
    status: row.status,
    confirmed_at: row.confirmed_at,
    posted_at: row.posted_at,
    live_url: row.live_url,
    stage: athleteStage(row),
  };
}

// The only columns an athlete may write. Anything else in a caller's object
// is dropped here, so a route cannot widen the write by accident. status is
// typed to the single value the athlete path may set.
type AthleteWrite = Partial<Pick<PackageRow, 'confirmed_at' | 'posted_at' | 'live_url'>> & {
  status?: 'posted';
};

export async function writeAthleteFields(
  token: string,
  fields: AthleteWrite
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPlausibleToken(token)) return { ok: false, error: 'Package not found' };
  const patch: AthleteWrite = {};
  if ('confirmed_at' in fields) patch.confirmed_at = fields.confirmed_at;
  if ('posted_at' in fields) patch.posted_at = fields.posted_at;
  if ('live_url' in fields) patch.live_url = fields.live_url;
  if (fields.status === 'posted') patch.status = 'posted';
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = createLiveServiceSupabase();
  const { error } = await supabase
    .from('posting_packages')
    .update(patch)
    .eq('delivery_token', token);
  if (error) {
    console.error('deliver: athlete write failed', error);
    return { ok: false, error: 'Could not save. Please try again.' };
  }
  return { ok: true };
}

/** Postgame's logo for the dark page, for the invalid-link screen. */
export async function loadPostgameLogo(): Promise<string | null> {
  return (await loadLogos(createLiveServiceSupabase(), null)).postgame;
}

/**
 * Postgame's logo (for a dark ground) and a brand's logo (for its off-white
 * plate), plus the brand's name. Same lookup as the athlete page, reused by
 * the staff editor (/api/posting-campaigns).
 */
export async function loadBrandLockup(
  brandId: string | null
): Promise<{ postgame: string | null; brand: string | null; brandName: string | null }> {
  return loadLogos(createLiveServiceSupabase(), brandId);
}
