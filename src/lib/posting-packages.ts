// ============================================================
// Posting packages — shared rules for the staff editor
// (/dashboard/posting-instructions) and its API routes.
//
// Pure: no server imports, so the roster page and the routes read the same
// column list, the same status values and the same pill / filter / count
// logic. The athlete page has its own curated view in deliver-package.ts.
//
// Never fabricate: every count here is derived from the rows passed in, and a
// missing caption or file can only ever produce a "none" / "pending" pill,
// never "ok".
// ============================================================

// Columns the staff editor reads. am_notes is deliberately absent — it is
// messy legacy text and is never returned, even to staff.
export const STAFF_PACKAGE_COLUMNS = [
  'id',
  'posting_campaign_id',
  'deliverable_key',
  'athlete_name',
  'athlete_id',
  'school',
  'ig_handle',
  'delivery_token',
  'intended_post_date',
  'post_date_label',
  'date_conditional',
  'video_url',
  'cover_url',
  'video_status',
  'caption_medium',
  'caption_status',
  'status',
  'sent_at',
  'confirmed_at',
  'posted_at',
  'live_url',
  'updated_at',
].join(', ');

export type StaffPackage = {
  id: string;
  posting_campaign_id: string | null;
  deliverable_key: string | null;
  athlete_name: string;
  athlete_id: string | null;
  school: string | null;
  ig_handle: string | null;
  delivery_token: string;
  intended_post_date: string | null;
  post_date_label: string | null;
  date_conditional: boolean | null;
  video_url: string | null;
  cover_url: string | null;
  video_status: string | null;
  caption_medium: string | null;
  caption_status: string | null;
  status: string;
  sent_at: string | null;
  confirmed_at: string | null;
  posted_at: string | null;
  live_url: string | null;
  updated_at: string | null;
};

// posting_packages.status CHECK list, in lifecycle order.
export const PACKAGE_STATUSES = ['draft', 'sent', 'confirmed', 'posted', 'metrics_due', 'complete'] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];
export const STATUS_LABEL: Record<PackageStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
  posted: 'Posted',
  metrics_due: 'Metrics due',
  complete: 'Complete',
};

// caption_status / video_status are free text in the table; the editor only
// ever writes one of these.
export const REVIEW_STATUSES = ['Awaiting Approval', 'In Revision', 'Approved'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const CAPTION_LIMIT = 2200;

export const POSTED_STATUSES = new Set(['posted', 'metrics_due', 'complete']);
const SENT_OR_LATER = new Set(['sent', 'confirmed', 'posted', 'metrics_due', 'complete']);

export function isPosted(p: Pick<StaffPackage, 'status' | 'posted_at'>): boolean {
  return !!p.posted_at || POSTED_STATUSES.has(p.status);
}
export function isSent(p: Pick<StaffPackage, 'status' | 'sent_at'>): boolean {
  return !!p.sent_at || SENT_OR_LATER.has(p.status);
}

/** File slots a deliverable needs. Reel: video + cover. Feed: one photo. */
export type Slot = 'video' | 'cover' | 'photo';
export function slotsFor(deliverableKey: string | null): Slot[] {
  return deliverableKey === 'feed' ? ['photo'] : ['video', 'cover'];
}
/** Which column a slot's file lives in. Feed photos use cover_url. */
export function slotColumn(slot: Slot): 'video_url' | 'cover_url' {
  return slot === 'video' ? 'video_url' : 'cover_url';
}

// ---- pills ----------------------------------------------------------------

export type PillState = 'ok' | 'pending' | 'rev' | 'none';
export type Pill = { label: string; state: PillState };

function reviewPill(label: string, hasThing: boolean, status: string | null): Pill {
  if (status === 'In Revision') return { label, state: 'rev' };
  if (!hasThing) return { label, state: 'none' };
  if (status === 'Approved') return { label, state: 'ok' };
  return { label, state: 'pending' };
}

/**
 * Pills for one post. A missing caption or file is never 'ok':
 *   caption — none if empty; rev if In Revision; ok only if Approved.
 *   video   — none if no file (unless In Revision); ok only if Approved.
 *             A video still with the brand (no file, Awaiting Approval)
 *             reads 'pending'.
 *   cover / photo — no status column, so a file present is 'ok' and a
 *             missing one is 'none'.
 */
export function pillsFor(p: StaffPackage): Pill[] {
  const pills: Pill[] = [reviewPill('Caption', !!p.caption_medium?.trim(), p.caption_status)];
  for (const slot of slotsFor(p.deliverable_key)) {
    if (slot === 'video') {
      const has = !!p.video_url;
      if (!has && p.video_status !== 'In Revision') {
        pills.push({ label: 'Video', state: p.video_status === 'Awaiting Approval' ? 'pending' : 'none' });
      } else {
        pills.push(reviewPill('Video', has, p.video_status));
      }
    } else {
      pills.push({ label: slot === 'cover' ? 'Cover' : 'Photo', state: p.cover_url ? 'ok' : 'none' });
    }
  }
  return pills;
}

export function missingFiles(p: StaffPackage): boolean {
  return slotsFor(p.deliverable_key).some((s) => !p[slotColumn(s)]);
}
export function hasCaption(p: StaffPackage): boolean {
  return !!p.caption_medium?.trim();
}

// ---- dates ----------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** '2026-09-26' → 'Sat, Sept 26'. Same format as the athlete page. */
export function formatPostDate(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** 'Sept 24' from a timestamp, in the viewer's local time. */
export function formatShortDay(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Today as 'YYYY-MM-DD' in the viewer's local time. */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

// ---- athletes -------------------------------------------------------------

export type AthleteRow = {
  key: string;
  name: string;
  school: string | null;
  handle: string | null;
  reel: StaffPackage | null;
  feed: StaffPackage | null;
  /** Any post that isn't reel/feed (none today) — kept, never dropped. */
  other: StaffPackage[];
  /** The post the "Their link" column, Copy links and Mark as sent act on. */
  next: StaffPackage;
};

// Names can carry stray spaces and case differences (CLAUDE.md: match with
// TRIM + ILIKE), so athletes are grouped on the trimmed, lower-cased name.
function athleteKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function byDate(a: StaffPackage, b: StaffPackage): number {
  return (a.intended_post_date ?? '9999').localeCompare(b.intended_post_date ?? '9999');
}

/**
 * The athlete's next post that's due: the earliest-dated post not yet posted.
 * Each post has its own private link, so the roster's single "Their link"
 * column needs one. When everything is posted, the latest post.
 */
export function nextPost(posts: StaffPackage[]): StaffPackage {
  const sorted = posts.slice().sort(byDate);
  return sorted.find((p) => !isPosted(p)) ?? sorted[sorted.length - 1];
}

export function groupAthletes(packages: StaffPackage[]): AthleteRow[] {
  const map = new Map<string, StaffPackage[]>();
  for (const p of packages) {
    const k = athleteKey(p.athlete_name);
    const list = map.get(k);
    if (list) list.push(p);
    else map.set(k, [p]);
  }
  const rows: AthleteRow[] = [];
  for (const [key, posts] of Array.from(map.entries())) {
    const reel = posts.find((p) => p.deliverable_key === 'reel') ?? null;
    const feed = posts.find((p) => p.deliverable_key === 'feed') ?? null;
    const other = posts.filter((p) => p !== reel && p !== feed);
    // School / handle: the first non-empty value across their posts. Blank
    // stays blank — never guessed.
    const first = (f: 'school' | 'ig_handle') =>
      posts.map((p) => p[f]?.trim()).find((v) => !!v) ?? null;
    rows.push({
      key,
      name: (reel ?? feed ?? posts[0]).athlete_name.trim(),
      school: first('school'),
      handle: first('ig_handle')?.replace(/^@+/, '') ?? null,
      reel,
      feed,
      other,
      next: nextPost(posts),
    });
  }
  return rows;
}

export function postsOf(a: AthleteRow): StaffPackage[] {
  return [a.reel, a.feed, ...a.other].filter((p): p is StaffPackage => !!p);
}

// ---- filters and counts ----------------------------------------------------

export type FilterKey = 'all' | 'needs_caption' | 'awaiting_files' | 'ready' | 'sent' | 'posted' | 'past_draft';

/** Ready to send: still a draft, has a caption and every file it needs. */
export function isReady(p: StaffPackage): boolean {
  return p.status === 'draft' && !isSent(p) && hasCaption(p) && !missingFiles(p);
}

/** Per-athlete filters: an athlete matches if any of their posts does. */
export function matchesFilter(a: AthleteRow, f: FilterKey, today: string): boolean {
  const posts = postsOf(a);
  switch (f) {
    case 'all':
      return true;
    case 'needs_caption':
      return posts.some((p) => !hasCaption(p));
    case 'awaiting_files':
      return posts.some(missingFiles);
    case 'ready':
      return posts.some(isReady);
    case 'sent':
      return posts.some((p) => isSent(p) && !isPosted(p));
    case 'posted':
      return posts.some(isPosted);
    case 'past_draft':
      return posts.some((p) => isPastDraft(p, today));
  }
}

export function isPastDraft(p: StaffPackage, today: string): boolean {
  return p.status === 'draft' && !!p.intended_post_date && p.intended_post_date < today;
}

export type RosterCounts = {
  athletes: number;
  posts: number;
  linksSent: number;
  posted: number;
  captionsMissing: number;
};

export function rosterCounts(packages: StaffPackage[]): RosterCounts {
  return {
    athletes: new Set(packages.map((p) => athleteKey(p.athlete_name))).size,
    posts: packages.length,
    linksSent: packages.filter(isSent).length,
    posted: packages.filter(isPosted).length,
    captionsMissing: packages.filter((p) => !hasCaption(p)).length,
  };
}

// ---- links ------------------------------------------------------------------

// Links always point at production, even when staff are on a preview deploy:
// they get texted to athletes.
export const DELIVER_BASE =
  (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postgame-hub.vercel.app').replace(/\/+$/, '') + '/deliver/';

export function deliverUrl(token: string): string {
  return DELIVER_BASE + token;
}
