// ============================================================
// Public posting-package lookup — shared by /api/deliver/[token]/*
//
// Same shape as /api/submit/[token]: the delivery_token in the URL is the
// only gate, and the lookup runs server-side on the service-role client, so
// posting_packages needs no anon RLS policy at all.
//
// ONE LINK, EVERY POST. A token still identifies exactly one row, but the
// page it opens shows every post that row's athlete has in that campaign —
// the rows sharing (posting_campaign_id, athlete_key). Each athlete kept the
// tokens they were already texted, so either of them opens the same combined
// page. Sibling tokens are NEVER returned: posts are addressed by their
// package id (`postId`), and every write re-checks that the id belongs to the
// token's own athlete before touching it.
//
//   • Only the fields the athlete page renders go back to the browser —
//     never delivery_token, am_notes, or any other internal column.
//   • Writes re-match on the token server-side and touch ONLY the
//     athlete-owned columns: confirmed_at, posted_at, live_url — plus
//     status, and only ever to 'posted'.
//   • No payment or invoice copy reaches the athlete page; invoice_email
//     stays in posting_campaigns for staff, and is not read here.
//
// No-store client (createLiveServiceSupabase) because this read decides
// access: a Data-Cached row would keep serving after staff change it.
//
// Campaign-level copy (tag handle, hashtag, FTC note, which walkthrough to
// show) comes from posting_campaigns (migration 072), joined through
// posting_packages.posting_campaign_id. The deliverable a row is — reel or
// feed — is posting_packages.deliverable_key, looked up in that campaign's
// `deliverables` list, which also gives each post its order and platforms.
//
// Feed posts are carousels: their photos live in posting_package_files
// (migration 074), ordered by `position`. The Reel keeps video_url/cover_url.
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
// delivery_token is never selected either — the token comes in from the URL.
const READ_COLUMNS = [
  'id',
  'athlete_name',
  'school',
  'ig_handle',
  'athlete_key',
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
  id: string;
  athlete_name: string;
  school: string | null;
  ig_handle: string | null;
  athlete_key: string | null;
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

type PhotoRow = {
  package_id: string;
  position: number;
  url: string;
  file_name: string | null;
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

/** One photo of a Feed carousel, in the order it should be posted. */
export type DeliverPhoto = { url: string; position: number; fileName: string | null };

/** One of the athlete's posts. `postId` is the package id — never a token. */
export type DeliverPost = {
  postId: string;
  deliverableKey: string | null;
  label: string | null;
  date: string | null;
  dateLabel: string | null;
  dateConditional: boolean;
  status: string;
  caption: { text: string | null; status: string | null };
  files: {
    videoUrl: string | null;
    coverUrl: string | null;
    videoStatus: string | null;
    photos: DeliverPhoto[];
    /** Which slots to render, in order. Reel: video + cover. Feed: photo. */
    slots: FileKind[];
  };
  walkthrough: string | null;
  platforms: string[];
  link: { liveUrl: string | null; postedAt: string | null };
};

/** Exactly what GET /api/deliver/[token] returns. Nothing internal. */
export type DeliverView = {
  athlete: { name: string; school: string | null; handle: string | null };
  campaign: {
    title: string | null;
    seasonLabel: string | null;
    brandName: string | null;
    tagHandle: string | null;
    hashtag: string | null;
    ftcNote: string | null;
  };
  logos: { postgame: string | null; brand: string | null };
  posts: DeliverPost[];
  /** The post to open on: the first not yet posted, else the last one. */
  activePostId: string;
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
  const brand = brandId ? plateLogo(brandId, byId.get(brandId), rowsFor(brandId)) : null;

  return { postgame, brand, brandName: brandId ? byId.get(brandId)?.name?.trim() || null : null };
}

// True when a logo's measured ink is light enough to vanish on the off-white
// plate (#FAF8F5). sRGB relative luminance; anything above 0.6 is light ink.
function isLightInk(hex: string | null | undefined): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex?.trim() ?? '');
  if (!m) return false;
  const lin = (c: string) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
  return L > 0.6;
}

// The brand logo for the off-white plate.
//
// brand_logos' variant is not always right: Postgame's on_white lockup is
// measured at ink #FAE9E3 — white on white. So the plate never trusts the
// label alone. For Postgame, or when the chosen file's measured ink is light,
// it uses the brand's dark-ink column (logo_dark_url = dark ink, for light
// grounds). No dark-ink file → no logo, never an invisible one.
function plateLogo(brandId: string, brand: BrandRow | undefined, rows: BrandLogoRow[]): string | null {
  const resolved = resolveBrandLogo(rows, { surface: 'light', prefer: 'lockup' });
  if (brandId === POSTGAME_BRAND_ID || (resolved && isLightInk(resolved.inkHex))) {
    return brand?.logo_dark_url || null;
  }
  return resolved?.url ?? pickBrandLogo(brand, 'light')?.url ?? null;
}

// Tokens exist in three shapes: crypto.randomUUID() / the column default
// (36 chars), randomBytes(24).toString('hex') (48), and the 12-hex tokens on
// every row loaded 2026-09-01/02. All hex-and-dash, so reject anything else
// before a query is ever made — but do not tighten the length floor without
// checking the live rows, or real links 404.
const TOKEN_RE = /^[0-9a-f-]{12,64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlausibleToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

/** A postId from the browser is only ever a uuid. Checked before any query. */
export function isPlausiblePostId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id);
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

/**
 * Every post belonging to the token's athlete, the token's own row included.
 *
 * Grouped on (posting_campaign_id, athlete_key). A row with no athlete_key —
 * only possible before migration 074's backfill runs — degrades to just that
 * row rather than guessing at a grouping, so the page stays correct.
 */
async function loadAthletePosts(row: PackageRow): Promise<PackageRow[]> {
  if (!row.athlete_key || !row.posting_campaign_id) return [row];

  const supabase = createLiveServiceSupabase();
  const { data, error } = await supabase
    .from('posting_packages')
    .select(READ_COLUMNS)
    .eq('posting_campaign_id', row.posting_campaign_id)
    .eq('athlete_key', row.athlete_key);
  if (error) {
    console.error('deliver: sibling lookup failed', error);
    return [row];
  }
  // Cast through unknown: the generated types don't narrow a multi-row select
  // built from a joined column string, the way they do for maybeSingle().
  const rows = (data as unknown as PackageRow[] | null) ?? [];
  // Never lose the token's own row to a race or a filter.
  return rows.some((r) => r.id === row.id) ? rows : [...rows, row];
}

async function loadPhotos(packageIds: string[]): Promise<Map<string, DeliverPhoto[]>> {
  const byPackage = new Map<string, DeliverPhoto[]>();
  if (!packageIds.length) return byPackage;

  const supabase = createLiveServiceSupabase();
  const { data, error } = await supabase
    .from('posting_package_files')
    .select('package_id, position, url, file_name')
    .in('package_id', packageIds)
    .eq('kind', 'photo')
    .order('position', { ascending: true });
  if (error) {
    // A missing table (before migration 074) must not take the page down:
    // the Feed post simply renders its pending state.
    console.error('deliver: photo lookup failed', error);
    return byPackage;
  }
  for (const p of (data as PhotoRow[] | null) ?? []) {
    const list = byPackage.get(p.package_id) ?? [];
    list.push({ url: p.url, position: p.position, fileName: p.file_name });
    byPackage.set(p.package_id, list);
  }
  return byPackage;
}

export async function loadDeliverView(token: string): Promise<DeliverView | null> {
  const row = await loadRow(token);
  if (!row) return null;

  const supabase = createLiveServiceSupabase();
  let campaign: CampaignRow | null = null;
  if (row.posting_campaign_id) {
    const { data, error } = await supabase
      .from('posting_campaigns')
      .select('brand_id, title, season_label, tag_handle, hashtag, ftc_note, deliverables')
      .eq('id', row.posting_campaign_id)
      .maybeSingle();
    if (error) console.error('deliver: campaign lookup failed', error);
    campaign = (data as CampaignRow | null) ?? null;
  }

  const deliverables = campaign?.deliverables ?? [];
  const rows = await loadAthletePosts(row);
  const [photos, logos] = await Promise.all([
    loadPhotos(rows.map((r) => r.id)),
    loadLogos(supabase, campaign?.brand_id ?? null),
  ]);

  // Campaign order first (reel = 1, feed = 2), then the date, so a campaign
  // with no deliverables list still comes out in a stable, sensible order.
  const orderOf = (key: string | null) => {
    const i = deliverables.findIndex((d) => d.key === key);
    if (i < 0) return Number.MAX_SAFE_INTEGER;
    return deliverables[i].order ?? i + 1;
  };
  const sorted = rows.slice().sort((a, b) => {
    const byOrder = orderOf(a.deliverable_key) - orderOf(b.deliverable_key);
    if (byOrder !== 0) return byOrder;
    return (a.intended_post_date ?? '9999-12-31').localeCompare(b.intended_post_date ?? '9999-12-31');
  });

  const posts: DeliverPost[] = sorted.map((r) => {
    const deliverable = deliverables.find((d) => d.key === r.deliverable_key);
    return {
      postId: r.id,
      deliverableKey: r.deliverable_key,
      label: deliverable?.label ?? null,
      date: r.intended_post_date,
      dateLabel: r.post_date_label?.trim() || formatPostDate(r.intended_post_date),
      dateConditional: !!r.date_conditional,
      status: athleteStage(r),
      caption: {
        text: r.caption_medium?.trim() || r.caption_short?.trim() || r.caption_long?.trim() || null,
        status: r.caption_status,
      },
      files: {
        videoUrl: r.video_url,
        coverUrl: r.cover_url,
        videoStatus: r.video_status,
        photos: photos.get(r.id) ?? [],
        slots: slotsFor(deliverable, r.deliverable_key),
      },
      walkthrough: deliverable?.walkthrough ?? null,
      platforms: deliverable?.platforms ?? [],
      link: { liveUrl: r.live_url, postedAt: r.posted_at },
    };
  });

  const activePostId = (posts.find((p) => p.status !== 'posted') ?? posts[posts.length - 1]).postId;

  return {
    athlete: {
      name: row.athlete_name,
      school: row.school?.trim() || null,
      handle: stripAt(row.ig_handle),
    },
    campaign: {
      title: campaign?.title ?? null,
      seasonLabel: campaign?.season_label ?? null,
      brandName: logos.brandName,
      tagHandle: stripAt(campaign?.tag_handle),
      hashtag: campaign?.hashtag ?? null,
      ftcNote: campaign?.ftc_note ?? row.ftc_note,
    },
    logos: { postgame: logos.postgame, brand: logos.brand },
    posts,
    activePostId,
  };
}

/**
 * The state one post is in, for the write routes.
 *
 * `postId` must name a post belonging to the SAME athlete as `token` — same
 * posting_campaign_id and athlete_key. Anything else returns null and the
 * route answers 404, so a token can never move another athlete's post. Left
 * out, it means the token's own row.
 */
export async function loadPackageState(
  token: string,
  postId?: string | null
): Promise<
  | (Pick<PackageRow, 'id' | 'status' | 'confirmed_at' | 'posted_at' | 'live_url'> & { stage: string })
  | null
> {
  const row = await loadRow(token);
  if (!row) return null;

  let target: PackageRow = row;
  if (postId && postId !== row.id) {
    if (!isPlausiblePostId(postId)) return null;
    const sibling = (await loadAthletePosts(row)).find((r) => r.id === postId);
    if (!sibling) return null;
    target = sibling;
  }

  return {
    id: target.id,
    status: target.status,
    confirmed_at: target.confirmed_at,
    posted_at: target.posted_at,
    live_url: target.live_url,
    stage: athleteStage(target),
  };
}

// The only columns an athlete may write. Anything else in a caller's object
// is dropped here, so a route cannot widen the write by accident. status is
// typed to the single value the athlete path may set.
type AthleteWrite = Partial<Pick<PackageRow, 'confirmed_at' | 'posted_at' | 'live_url'>> & {
  status?: 'posted';
};

/**
 * Write the athlete-owned columns of ONE post.
 *
 * The post is re-resolved from the token here — the caller's postId is never
 * trusted straight into the WHERE clause — so the write can only ever land on
 * a row belonging to this token's athlete.
 */
export async function writeAthleteFields(
  token: string,
  postId: string | null | undefined,
  fields: AthleteWrite
): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = await loadPackageState(token, postId);
  if (!state) return { ok: false, error: 'Package not found' };

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
    .eq('id', state.id);
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
