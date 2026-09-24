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

/** File slots a deliverable needs. Reel: video + cover. Feed: photos. */
export type Slot = 'video' | 'cover' | 'photo';
export function slotsFor(deliverableKey: string | null): Slot[] {
  return deliverableKey === 'feed' ? ['photo'] : ['video', 'cover'];
}
/**
 * Which column a slot's file lives in — or null for 'photo'.
 *
 * A Feed post is a carousel of several photos, so they cannot live in one
 * column: they are rows in posting_package_files, ordered by `position`
 * (migration 074). cover_url is left alone on feed rows; it is null on all of
 * them and stays that way.
 */
export function slotColumn(slot: Slot): 'video_url' | 'cover_url' | null {
  if (slot === 'video') return 'video_url';
  if (slot === 'cover') return 'cover_url';
  return null;
}

/** One carousel photo, as the staff editor sees it. */
export type PostingPhoto = {
  id: string;
  package_id: string;
  position: number;
  url: string;
  storage_path: string | null;
  drive_file_id: string | null;
  file_name: string | null;
};

export const PHOTO_COLUMNS = 'id, package_id, position, url, storage_path, drive_file_id, file_name';

/** Photos grouped by package id, each list already in carousel order. */
export function groupPhotos(rows: PostingPhoto[]): Record<string, PostingPhoto[]> {
  const by: Record<string, PostingPhoto[]> = {};
  for (const r of rows) (by[r.package_id] ??= []).push(r);
  for (const list of Object.values(by)) list.sort((a, b) => a.position - b.position);
  return by;
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
export function pillsFor(p: StaffPackage, photoCount = 0): Pill[] {
  const pills: Pill[] = [reviewPill('Caption', !!p.caption_medium?.trim(), p.caption_status)];
  for (const slot of slotsFor(p.deliverable_key)) {
    if (slot === 'video') {
      const has = !!p.video_url;
      if (!has && p.video_status !== 'In Revision') {
        pills.push({ label: 'Video', state: p.video_status === 'Awaiting Approval' ? 'pending' : 'none' });
      } else {
        pills.push(reviewPill('Video', has, p.video_status));
      }
    } else if (slot === 'cover') {
      pills.push({ label: 'Cover', state: p.cover_url ? 'ok' : 'none' });
    } else {
      // A carousel: the pill carries its count, and is done at one or more.
      pills.push({ label: `Photos ${photoCount}`, state: photoCount > 0 ? 'ok' : 'none' });
    }
  }
  return pills;
}

/** True when a post is still missing a file it needs. */
export function missingFiles(p: StaffPackage, photoCount = 0): boolean {
  return slotsFor(p.deliverable_key).some((s) => {
    const column = slotColumn(s);
    return column ? !p[column] : photoCount === 0;
  });
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
  /**
   * The ONE post whose token is the athlete's link. Both of an athlete's
   * tokens open the same combined page, so the roster shows a single link
   * and never changes which one it shows — an athlete who was texted this
   * link keeps using it for every post in the campaign.
   */
  link: StaffPackage;
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
 * The post whose delivery_token is the athlete's one link.
 *
 * Their first post — the Reel for everyone today, else the earliest-dated.
 * Deliberately NOT "the next one due": the link must not move to a different
 * token as posts go live, because the one already texted out has to keep
 * working and keep being the one staff copy.
 */
export function linkPost(posts: StaffPackage[]): StaffPackage {
  const reel = posts.find((p) => p.deliverable_key === 'reel');
  return reel ?? posts.slice().sort(byDate)[0];
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
      link: linkPost(posts),
    });
  }
  return rows;
}

export function postsOf(a: AthleteRow): StaffPackage[] {
  return [a.reel, a.feed, ...a.other].filter((p): p is StaffPackage => !!p);
}

// ---- stages ----------------------------------------------------------------
//
// The redesigned roster puts every post in EXACTLY ONE stage, tested in this
// order, first match wins. The old filters overlapped — a post with no caption
// and no files counted in two places, so the tab numbers never added up to the
// roster. These do.
//
//   posted         → a live link, or a posted time
//   sent           → sent_at, or status past draft
//   needs_caption  → no caption text, or a caption not yet Approved
//   awaiting_files → reel: video not Approved AND attached, or no cover
//                    feed: no photos yet
//   ready          → everything else
//
// An ATHLETE counts in a stage if ANY of their posts is in it.

export type PostStage = 'posted' | 'sent' | 'needs_caption' | 'awaiting_files' | 'ready';

export const STAGES: { key: PostStage | 'all'; label: string }[] = [
  { key: 'all', label: 'All athletes' },
  { key: 'needs_caption', label: 'Need a caption' },
  { key: 'awaiting_files', label: 'Waiting on files' },
  { key: 'ready', label: 'Ready to send' },
  { key: 'sent', label: 'Link sent' },
  { key: 'posted', label: 'Posted' },
];

/** A caption only counts when it exists AND the brand has approved it. */
export function captionApproved(p: StaffPackage): boolean {
  return hasCaption(p) && p.caption_status === 'Approved';
}

/** A reel's video counts when the file is attached AND approved. */
export function videoReady(p: StaffPackage): boolean {
  return !!p.video_url && p.video_status === 'Approved';
}

/** Whether every file this post needs is in place. */
export function filesDone(p: StaffPackage, photoCount: number): boolean {
  if (p.deliverable_key === 'feed') return photoCount > 0;
  return videoReady(p) && !!p.cover_url;
}

export function stageOf(p: StaffPackage, photoCount: number): PostStage {
  if (isPosted(p) || p.live_url) return 'posted';
  if (isSent(p)) return 'sent';
  if (!captionApproved(p)) return 'needs_caption';
  if (!filesDone(p, photoCount)) return 'awaiting_files';
  return 'ready';
}

/** An athlete is in a stage when any of their posts is. */
export function athleteInStage(
  a: AthleteRow,
  stage: PostStage | 'all',
  photoCount: (p: StaffPackage) => number
): boolean {
  if (stage === 'all') return true;
  return postsOf(a).some((p) => stageOf(p, photoCount(p)) === stage);
}

// ---- the one status pill ----------------------------------------------------

export type PillTone = 'red' | 'amber' | 'orange' | 'blue' | 'green';

/**
 * The single pill a post cell shows. Sized to its text, never full width.
 * The brand name is passed in — it comes from the campaign, never hard-coded.
 */
export function statusPill(
  p: StaffPackage,
  photoCount: number,
  brandName: string | null
): { label: string; tone: PillTone } {
  const stage = stageOf(p, photoCount);
  if (stage === 'posted') return { label: 'Posted', tone: 'green' };
  if (stage === 'sent') return { label: 'Link sent', tone: 'blue' };
  if (stage === 'needs_caption') return { label: 'Needs caption', tone: 'red' };
  if (stage === 'ready') return { label: 'Ready to send', tone: 'orange' };

  // awaiting_files — say WHICH file, so the row is actionable at a glance.
  if (p.deliverable_key === 'feed') return { label: 'Needs photos', tone: 'amber' };
  if (p.video_status === 'In Revision') return { label: 'Video in revision', tone: 'amber' };
  if (!videoReady(p)) return { label: `Video with ${brandName ?? 'the brand'}`, tone: 'amber' };
  return { label: 'Needs cover', tone: 'amber' };
}

// ---- the small part dots ----------------------------------------------------

export type DotState = 'done' | 'rev' | 'missing';
export type Part = { label: string; state: DotState };

/** Caption / Video / Cover for a reel; Caption / Photos N for a feed post. */
export function partsFor(p: StaffPackage, photoCount: number): Part[] {
  const caption: Part = {
    label: 'Caption',
    state: captionApproved(p) ? 'done' : p.caption_status === 'In Revision' ? 'rev' : 'missing',
  };
  if (p.deliverable_key === 'feed') {
    return [caption, { label: `Photos ${photoCount}`, state: photoCount > 0 ? 'done' : 'missing' }];
  }
  return [
    caption,
    {
      label: 'Video',
      state: videoReady(p) ? 'done' : p.video_status === 'In Revision' ? 'rev' : 'missing',
    },
    { label: 'Cover', state: p.cover_url ? 'done' : 'missing' },
  ];
}

// ---- grouping by the athlete's next post date -------------------------------

/**
 * The date the roster groups an athlete under: their earliest post that isn't
 * posted yet. When everything is posted, their last date. Null when undated.
 */
export function nextPostDate(a: AthleteRow): string | null {
  const posts = postsOf(a);
  const open = posts.filter((p) => !isPosted(p) && p.intended_post_date);
  const pool = open.length ? open : posts.filter((p) => p.intended_post_date);
  if (!pool.length) return null;
  const dates = pool.map((p) => p.intended_post_date!).sort();
  return open.length ? dates[0] : dates[dates.length - 1];
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
