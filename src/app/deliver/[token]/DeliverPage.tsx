'use client';

// ============================================================
// /deliver/[token] — the interactive athlete page
//
// ONE LINK, EVERY POST. The token identifies one row, but the page shows all
// of that athlete's posts in the campaign (see src/lib/deliver-package.ts).
// Tiles across the top switch between them; the four-step checklist below
// belongs to whichever tile is selected. Either of an athlete's existing
// links opens this same page, so nothing already texted out has to change.
//
// The tick-offs are the athlete's own checklist and live only in their
// browser (localStorage, keyed per post, every access wrapped — private mode
// throws). They are never written to the database. The one thing that IS
// saved is the post link, through POST /api/deliver/[token]/posted, which
// carries the postId so only that post is marked.
//
// A Feed post is a CAROUSEL: several photos, saved and posted in order. They
// come from posting_package_files. The Reel keeps its video + cover.
//
// Missing data never gets made up: no file → a labelled pending slot, no
// caption → a pending panel, no walkthrough → quick steps + "Screenshots
// coming". No payment or invoice copy appears anywhere on this page.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DeliverPhoto, DeliverPost, DeliverView, FileKind } from '@/lib/deliver-package';
import { checkLiveUrl } from '@/lib/post-link';

// --- walkthrough.json (public/posting/walkthroughs/<key>/) -----------------

type Highlight = { tag?: string; x: number; y: number; w: number; h: number; label: string };
type WalkStep = { n: number; image: string; caption_html: string; highlights?: Highlight[] };
type Walkthrough = {
  key: string;
  platform: string;
  phases: { title: string; from_step: number; to_step: number }[];
  steps: WalkStep[];
  quick_steps?: Record<string, string[]>;
};

const TAG_PLACEMENTS = new Set(['above-left', 'right', 'below', 'side-right', 'side-left', 'in-right', 'in-tl']);
const WALKTHROUGH_KEY = /^[a-z0-9-]{1,80}$/;
// The walkthrough was shot on the Cane's campaign; its copy names this handle.
const SHOT_HANDLE = 'raisingcanes';

const PLATFORM_LABEL: Record<string, string> = {
  instagram_reel: 'Instagram Reel',
  instagram_feed: 'Instagram',
  tiktok: 'TikTok',
};

const TASK_COUNT = 4;

// --- helpers ---------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function possessive(name: string): string {
  if (/['’]s$/i.test(name)) return name; // "Raising Cane's" is already possessive
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// Fallback quick steps, used only when a platform has none in its
// walkthrough.json (Feed today). `who` is already HTML-escaped.
function fallbackQuickSteps(platform: string, who: string): string[] {
  if (platform === 'instagram_feed') {
    // A carousel, not a single photo: the order the athlete taps in IS the
    // order the photos appear in the post.
    return [
      'Tap <b>+</b> → <b>Post</b>.',
      'Tap <b>Select multiple</b>, then tap your photos <b>in the order shown above</b>.',
      'Tap <b>Next</b>, then paste your caption.',
      `Tap <b>Tag people</b> → add <b>${who}</b>.`,
      `<b>More options</b> → <b>Partnership label &amp; ads</b> → switch on → add <b>${who}</b>. It'll say <i>Pending</i> — that's fine.`,
      'Tap <b>Share</b>.',
    ];
  }
  if (platform === 'tiktok') {
    return [
      'Tap <b>+</b> → <b>Upload</b> → pick the video → <b>Next</b>.',
      'Tap <b>Select cover</b> → <b>Upload cover</b> → pick the cover photo.',
      `Paste your caption. Type <b>@${who}</b> in it so the tag links.`,
      '<b>More options</b> → <b>Branded content</b> → switch on <b>Paid partnership</b> → add the brand.',
      'Tap <b>Post</b>.',
    ];
  }
  return [
    'Tap <b>+</b> → <b>Reel</b> → pick the video → <b>Next</b>.',
    'Tap <b>Edit cover</b> → <b>Add from camera roll</b> → pick the cover photo.',
    `Tap <b>Tag people</b> → add <b>${who}</b>. Paste your caption.`,
    `<b>More options</b> → <b>Partnership label &amp; ads</b> → switch on → add <b>${who}</b>. It'll say <i>Pending</i> — that's fine.`,
    'Tap <b>Share</b>.',
  ];
}

// Supabase public objects download (instead of opening) with ?download=name.
// Anything else just opens in a new tab, where the athlete can save it.
function downloadHref(url: string, filename: string): string {
  try {
    const u = new URL(url);
    if (u.pathname.includes('/storage/v1/object/public/')) {
      u.searchParams.set('download', filename);
      return u.toString();
    }
  } catch {
    /* fall through */
  }
  return url;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'post';
}

function extOf(url: string): string {
  return /\.([a-z0-9]{2,5})(?:$|\?)/i.exec(new URL(url, 'https://x').pathname)?.[1] ?? '';
}

function fileName(athlete: string, kind: FileKind, url: string): string {
  const ext = extOf(url);
  return ext ? `${slugify(athlete)}-${kind}.${ext}` : `${slugify(athlete)}-${kind}`;
}

function photoName(athlete: string, index: number, url: string): string {
  const ext = extOf(url);
  const base = `${slugify(athlete)}-photo-${index + 1}`;
  return ext ? `${base}.${ext}` : base;
}

async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall back below */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* nothing else to try */
  }
  document.body.removeChild(ta);
}

function readTicks(key: string): boolean[] {
  try {
    const raw = window.localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr)) return Array.from({ length: TASK_COUNT }, (_, i) => arr[i] === true);
  } catch {
    /* private mode or cleared storage */
  }
  return Array(TASK_COUNT).fill(false);
}

function writeTicks(key: string, ticks: boolean[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ticks));
  } catch {
    /* not critical */
  }
}

/**
 * Save every carousel photo at once.
 *
 * On a phone the Web Share API with files hands them to the share sheet, so
 * iOS can "Save N Images" straight into Photos — the only way to get them
 * into the camera roll from a browser. Everywhere else (and whenever the
 * share sheet refuses the files) each photo downloads on its own. Never a
 * zip: a phone can't open one.
 *
 * Returns how the save went, so the button can say something true.
 */
async function saveAllPhotos(
  photos: DeliverPhoto[],
  athlete: string
): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  const named = photos.map((p, i) => ({ url: p.url, name: photoName(athlete, i, p.url) }));

  // navigator.share must be called in the same gesture, but fetching first is
  // unavoidable — Safari tolerates the await as long as nothing else blocks.
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
    try {
      const files = await Promise.all(
        named.map(async ({ url, name }) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          const blob = await res.blob();
          return new File([blob], name, { type: blob.type || 'image/jpeg' });
        })
      );
      if (navigator.canShare({ files })) {
        await navigator.share({ files });
        return 'shared';
      }
    } catch (err) {
      // The athlete dismissed the share sheet — don't then spray downloads.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      /* otherwise fall through to downloads */
    }
  }

  try {
    named.forEach(({ url, name }, i) => {
      // Stagger: browsers drop a burst of simultaneous downloads.
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = downloadHref(url, name);
        a.download = name;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 350);
    });
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

// --- small pieces ----------------------------------------------------------

const CHECK = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function CopyButton({
  text,
  label,
  variant,
  disabled,
}: {
  text: string;
  label: string;
  variant: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className={`btn ${variant}`}
      disabled={disabled}
      onClick={async () => {
        await copyText(text);
        setCopied(true);
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function Task({
  done,
  onToggle,
  children,
}: {
  done: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`task${done ? ' done' : ''}`}>
      <button
        type="button"
        className="tick"
        aria-pressed={done}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        onClick={onToggle}
        style={{ color: '#fff' }}
      >
        {CHECK}
      </button>
      <div className="tbody">{children}</div>
    </div>
  );
}

// Highlight boxes are positioned in % of the image, so until the image has
// loaded they would collapse into thin lines across a zero-height box. Hold
// them back until it arrives (or was already cached when this mounted).
// Not loading="lazy": these only mount after the screenshots are asked for,
// so all 16 (~520 KB) load then, for people who asked for them.
function Shot({ step, base }: { step: WalkStep; base: string }) {
  const [ready, setReady] = useState(false);
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setReady(true);
  }, []);
  return (
    <div className="shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={`${base}/${step.image}`} alt="" onLoad={() => setReady(true)} />
      {ready && (step.highlights ?? []).map((h, i) => {
        const tag = h.tag && TAG_PLACEMENTS.has(h.tag) && h.tag !== 'above-left' ? ` ${h.tag}` : '';
        return (
          <span
            key={i}
            className={`hl${tag}`}
            style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }}
          >
            <i>{h.label}</i>
          </span>
        );
      })}
    </div>
  );
}

/** The tile row: one per post, with its date and where it stands. */
function PostTiles({
  posts,
  activeId,
  onPick,
}: {
  posts: DeliverPost[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  const firstOpen = posts.find((p) => p.status !== 'posted')?.postId ?? null;
  const postedCount = posts.filter((p) => p.status === 'posted').length;

  return (
    <section className="posts" aria-label="Your posts">
      <div className="prow">
        <span className="lab">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} this season
        </span>
        <span className="count">
          <b>{postedCount}</b> of {posts.length} posted
        </span>
      </div>
      <div className="tiles" role="tablist" aria-label="Your posts">
        {posts.map((p, i) => {
          const done = p.status === 'posted';
          const badge = done ? 'Posted' : p.postId === firstOpen ? 'Up next' : 'Later';
          const state = done ? 'done' : p.postId === firstOpen ? 'next' : 'later';
          return (
            <button
              key={p.postId}
              type="button"
              role="tab"
              aria-selected={p.postId === activeId}
              className={`tile ${state}${p.postId === activeId ? ' on' : ''}`}
              onClick={() => onPick(p.postId)}
            >
              <span className="tnum lab">Post {i + 1}</span>
              <span className="tlabel">{p.label ?? (p.deliverableKey === 'feed' ? 'Feed post' : 'Reel')}</span>
              <span className="tdate">{p.dateLabel ?? 'Date TBC'}</span>
              <span className={`tbadge ${state}`}>
                {done && CHECK}
                {badge}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The numbered 4:5 grid of carousel photos, each saveable on its own. */
function PhotoGrid({ photos, athlete }: { photos: DeliverPhoto[]; athlete: string }) {
  return (
    <div className="pgrid">
      {photos.map((p, i) => (
        <figure className="pcell" key={`${p.position}-${p.url}`}>
          <div className="pframe">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Photo ${i + 1}`} />
            <span className="pnumber">{i + 1}</span>
          </div>
          <a
            className="btn ghost full"
            href={downloadHref(p.url, photoName(athlete, i, p.url))}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            Save photo {i + 1}
          </a>
        </figure>
      ))}
    </div>
  );
}

// --- the page --------------------------------------------------------------

export default function DeliverPage({ token, view }: { token: string; view: DeliverView }) {
  const { athlete, campaign, logos, posts } = view;
  const brandName = campaign.brandName;
  const tagHandle = campaign.tagHandle;

  // ---- which post is on screen ----
  const [activeId, setActiveId] = useState(view.activePostId);
  // Links submitted this session, so a tile flips to Posted without a reload.
  const [liveUrls, setLiveUrls] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(posts.map((p) => [p.postId, p.link.liveUrl]))
  );

  const shownPosts = useMemo(
    () =>
      posts.map((p) =>
        liveUrls[p.postId] && p.status !== 'posted'
          ? { ...p, status: 'posted', link: { ...p.link, liveUrl: liveUrls[p.postId] } }
          : p
      ),
    [posts, liveUrls]
  );

  const post = shownPosts.find((p) => p.postId === activeId) ?? shownPosts[0];
  const liveUrl = liveUrls[post.postId] ?? null;
  const isFeed = post.deliverableKey === 'feed';
  const photos = post.files.photos;
  const postLabel = post.label ?? (isFeed ? 'Feed post' : 'Reel');

  // ---- checklist (browser-only, per post) ----
  const storageKey = `pg-deliver:${token}:${post.postId}`;
  const [ticks, setTicks] = useState<boolean[]>(() => Array(TASK_COUNT).fill(false));
  useEffect(() => {
    setTicks(readTicks(storageKey));
  }, [storageKey]);
  const toggle = useCallback(
    (i: number) =>
      setTicks((prev) => {
        const next = prev.slice();
        next[i] = !next[i];
        writeTicks(storageKey, next);
        return next;
      }),
    [storageKey]
  );
  // A link on file means task 4 is done, whatever the checkbox says.
  const shown = ticks.map((t, i) => (i === 3 && liveUrl ? true : t));
  const doneCount = shown.filter(Boolean).length;

  // ---- walkthrough (per post) ----
  const [walk, setWalk] = useState<Walkthrough | null>(null);
  const walkKey = post.walkthrough && WALKTHROUGH_KEY.test(post.walkthrough) ? post.walkthrough : null;
  const walkBase = walkKey ? `/posting/walkthroughs/${walkKey}` : '';
  useEffect(() => {
    setWalk(null);
    if (!walkKey) return;
    let live = true;
    fetch(`/posting/walkthroughs/${walkKey}/walkthrough.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (live && j && Array.isArray(j.steps)) setWalk(j as Walkthrough);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [walkKey]);

  // Walkthrough copy was written for @raisingcanes; point it at this campaign.
  const tagHtml = tagHandle ? esc(tagHandle) : null;
  const personalise = useCallback(
    (html: string) => (tagHtml ? html.split(SHOT_HANDLE).join(tagHtml) : html),
    [tagHtml]
  );

  const platforms = useMemo(() => {
    const known = post.platforms.filter((p) => PLATFORM_LABEL[p]);
    if (known.length) return known;
    return isFeed ? ['instagram_feed'] : ['instagram_reel', 'tiktok'];
  }, [post.platforms, isFeed]);
  const [platform, setPlatform] = useState(platforms[0]);
  const [showShots, setShowShots] = useState(false);
  // Switching posts resets the platform tab and folds the screenshots away.
  useEffect(() => {
    setPlatform(platforms[0]);
    setShowShots(false);
  }, [post.postId, platforms]);

  const who = tagHtml ?? (brandName ? esc(brandName) : 'the brand');
  const quickFor = (p: string) => (walk?.quick_steps?.[p] ?? fallbackQuickSteps(p, who)).map(personalise);
  const shotsFor = (p: string) => (walk && walk.platform === p ? walk : null);

  // ---- saving the carousel ----
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  useEffect(() => {
    if (!saveNote) return;
    const t = setTimeout(() => setSaveNote(null), 2600);
    return () => clearTimeout(t);
  }, [saveNote]);

  async function saveAll() {
    setSaving(true);
    const how = await saveAllPhotos(photos, athlete.name);
    setSaving(false);
    if (how === 'shared') setSaveNote('Sent to your share sheet — choose Save Images.');
    else if (how === 'downloaded') setSaveNote(`Saving ${photos.length} photos…`);
    else if (how === 'failed') setSaveNote('Couldn’t save them together — save each one below.');
  }

  // ---- link ----
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pasted, setPasted] = useState(false);
  const draftOk = checkLiveUrl(draft).ok;
  useEffect(() => {
    if (!pasted) return;
    const t = setTimeout(() => setPasted(false), 1400);
    return () => clearTimeout(t);
  }, [pasted]);
  // A fresh box per post: one post's draft must not leak into the next.
  useEffect(() => {
    setDraft('');
    setSubmitError(null);
  }, [post.postId]);

  async function paste() {
    try {
      const t = await navigator.clipboard?.readText?.();
      if (t) {
        setDraft(t.trim());
        setSubmitError(null);
        setPasted(true);
        return;
      }
    } catch {
      /* permission denied: let them paste by hand */
    }
    document.getElementById('postlink')?.focus();
  }

  async function submit() {
    const check = checkLiveUrl(draft);
    if (!check.ok) {
      setSubmitError(check.error);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/deliver/${encodeURIComponent(token)}/posted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.postId, live_url: check.url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(body?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      const saved =
        (body?.posts ?? []).find((p: DeliverPost) => p.postId === post.postId)?.link?.liveUrl ?? check.url;
      setLiveUrls((prev) => ({ ...prev, [post.postId]: saved }));
    } catch {
      setSubmitError('Could not reach us. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---- header bits ----
  const who2 = [athlete.school, athlete.handle ? `@${athlete.handle}` : null].filter(Boolean).join(' · ');
  const approval = `Awaiting ${brandName ? possessive(brandName) : 'brand'} approval`;
  const markLine = ['Postgame', brandName ? `× ${brandName}` : null].filter(Boolean).join(' ');
  // Two lines of Bebas, as in the mockup: "King" over "Miller".
  const nameParts = athlete.name.trim().split(/\s+/);
  const nameTop = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : athlete.name;
  const nameBottom = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;

  const slotMeta: Record<FileKind, { label: string; note: string; button: string; url: string | null }> = {
    video: {
      label: 'Video · the post',
      note: 'Vertical 9:16',
      button: 'Save video',
      url: post.files.videoUrl,
    },
    cover: {
      label: 'Photo · the cover',
      note: 'Cover image for the reel — not its own post',
      button: 'Save cover photo',
      url: post.files.coverUrl,
    },
    photo: {
      label: 'Photo · the post',
      note: 'The photo for your feed post',
      button: 'Save photo',
      url: post.files.coverUrl,
    },
  };
  const reelSlots = post.files.slots.filter((s) => s !== 'photo');

  return (
    <div className="dv">
      <main className="wrap">
        {/* ===================== HEADER ===================== */}
        <header className="masthead">
          <div className="lockup">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logos.postgame && <img className="pg" src={logos.postgame} alt="Postgame" />}
            {logos.postgame && logos.brand && <div className="bar" />}
            {logos.brand && (
              <div className="plate">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="cn" src={logos.brand} alt={brandName ?? ''} />
              </div>
            )}
          </div>
          {(campaign.title || campaign.seasonLabel) && (
            <div className="season">
              {campaign.title}
              {campaign.title && campaign.seasonLabel && <br />}
              {campaign.seasonLabel}
            </div>
          )}
        </header>

        <div className="hero">
          <p className="eyebrow">Your posting instructions</p>
          <h1>
            {nameTop}
            {nameBottom && (
              <>
                <br />
                {nameBottom}
              </>
            )}
          </h1>
          {who2 && <p className="who">{who2}</p>}
        </div>

        {/* ===================== POST TILES ===================== */}
        <PostTiles posts={shownPosts} activeId={post.postId} onPick={setActiveId} />

        {/* ===================== DATE BAND ===================== */}
        <div className="dband">
          <span className="lab">Goes live</span>
          <div className="d">{post.dateLabel ?? 'Date TBC'}</div>
          <div className="rule" />
          {post.dateLabel && (
            <p className="dnote">
              {post.dateConditional
                ? "This date isn't locked yet. We'll confirm it with you before you post."
                : 'Any time that day works.'}
            </p>
          )}
        </div>

        {/* ===================== PROGRESS ===================== */}
        <div className="prog">
          <div className="row">
            <span className="lab">{postLabel} checklist</span>
            <span className="count">
              <b>{doneCount}</b> of {TASK_COUNT} done
            </span>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${(doneCount / TASK_COUNT) * 100}%` }} />
          </div>
        </div>

        {/* ===================== 1 · FILES ===================== */}
        <Task done={shown[0]} onToggle={() => toggle(0)}>
          {isFeed ? (
            <>
              <p className="ttitle">Save your photos</p>
              <p>
                {photos.length > 0
                  ? `This post is a carousel of ${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}. Post them in the order shown.`
                  : 'This post is a carousel — several photos in one post.'}
              </p>
              {photos.length > 0 ? (
                <>
                  <div className="saveall">
                    <button
                      type="button"
                      className="btn primary full"
                      disabled={saving}
                      onClick={saveAll}
                    >
                      {saving ? 'Preparing…' : `Save all ${photos.length} photos`}
                    </button>
                    {saveNote && (
                      <p className="hint" role="status">
                        {saveNote}
                      </p>
                    )}
                  </div>
                  <PhotoGrid photos={photos} athlete={athlete.name} />
                  <p className="fnote">Post them in the order shown.</p>
                </>
              ) : (
                <div className="assets">
                  <div className="asset">
                    <span className="kind lab">Photos · the post</span>
                    <div className="slot">
                      <span className="em">—</span>
                      <span className="chip muted">
                        <span className="dot" />
                        {approval}
                      </span>
                    </div>
                    <p className="fnote">Your photos will appear here once they&apos;re approved.</p>
                    <button type="button" className="btn primary full" style={{ marginTop: 12 }} disabled>
                      Save all photos
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="ttitle">{reelSlots.length > 1 ? 'Save your files' : 'Save your file'}</p>
              <p>The video is the post. The photo is its cover — never a separate post.</p>
              <div className={`assets${reelSlots.length > 1 ? ' two' : ''}`}>
                {reelSlots.map((kind) => {
                  const m = slotMeta[kind];
                  return (
                    <div className="asset" key={kind}>
                      <span className="kind lab">{m.label}</span>
                      {m.url ? (
                        kind === 'video' ? (
                          <video className="media" src={m.url} controls playsInline preload="metadata" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="media" src={m.url} alt="" />
                        )
                      ) : (
                        <div className="slot">
                          <span className="em">—</span>
                          <span className="chip muted">
                            <span className="dot" />
                            {approval}
                          </span>
                        </div>
                      )}
                      <p className="fnote">{m.note}</p>
                      {m.url ? (
                        <a
                          className="btn primary full"
                          style={{ marginTop: 12 }}
                          href={downloadHref(m.url, fileName(athlete.name, kind, m.url))}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          {m.button}
                        </a>
                      ) : (
                        <button type="button" className="btn primary full" style={{ marginTop: 12 }} disabled>
                          {m.button}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Task>

        {/* ===================== 2 · CAPTION ===================== */}
        <Task done={shown[1]} onToggle={() => toggle(1)}>
          <p className="ttitle">Copy your caption</p>
          <p>
            Paste it exactly.
            {brandName ? ` ${brandName} gets tagged separately inside the app.` : ''}
          </p>
          <div className="card" style={{ marginTop: 14 }}>
            <span className="lab">Your caption</span>
            {post.caption.text ? (
              <>
                <p className="captext">{post.caption.text}</p>
                <CopyButton text={post.caption.text} label="Copy caption" variant="primary" />
              </>
            ) : (
              <>
                <p className="captext pending">
                  Your caption is on its way. It&apos;ll appear here once it&apos;s approved.
                </p>
                <button type="button" className="btn primary" disabled>
                  Copy caption
                </button>
              </>
            )}
            {tagHandle && (
              <div className="tagrow">
                <div>
                  <span className="lab">Tag this account</span>
                  <div className="val">@{tagHandle}</div>
                </div>
                <CopyButton text={`@${tagHandle}`} label="Copy" variant="ghost" />
              </div>
            )}
          </div>
        </Task>

        {/* ===================== 3 · POST ===================== */}
        <Task done={shown[2]} onToggle={() => toggle(2)}>
          <p className="ttitle">Post it</p>
          <p>
            {platforms.length > 1
              ? `${platforms.map((p) => (p === 'instagram_reel' ? 'Reel' : PLATFORM_LABEL[p])).join(' or ')} — either one counts.`
              : `Post it on ${PLATFORM_LABEL[platforms[0]]}.`}
          </p>
          {platforms.length > 1 && (
            <div className="plat" role="tablist" aria-label="Platform">
              {platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={platform === p}
                  onClick={() => setPlatform(p)}
                >
                  {PLATFORM_LABEL[p]}
                </button>
              ))}
            </div>
          )}
          {platforms.map((p) => {
            const w = shotsFor(p);
            return (
              <div key={p} hidden={platform !== p} role={platforms.length > 1 ? 'tabpanel' : undefined}>
                <ol className="quick">
                  {quickFor(p).map((html, i) => (
                    <li key={i}>
                      <span className="n">{i + 1}</span>
                      <span dangerouslySetInnerHTML={{ __html: html }} />
                    </li>
                  ))}
                </ol>
                {w ? (
                  <>
                    <div style={{ marginTop: 18 }}>
                      <button type="button" className="btn ghost full" onClick={() => setShowShots((v) => !v)}>
                        {showShots ? 'Hide the screenshots' : 'See it step by step, with screenshots'}
                      </button>
                    </div>
                    {showShots && (
                      <>
                        <div className="phases">
                          {w.phases.map((ph, pi) => {
                            const steps = w.steps.filter((s) => s.n >= ph.from_step && s.n <= ph.to_step);
                            return (
                              <details className="phase" key={pi} open={pi === 0}>
                                <summary>
                                  <span className="pnum">{pi + 1}</span>
                                  <span className="ptitle">{ph.title}</span>
                                  <span className="pcount">
                                    {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                                  </span>
                                  <span className="chev" aria-hidden="true" />
                                </summary>
                                <ol className="sublist">
                                  {steps.map((s) => (
                                    <li className="sstep" key={s.n}>
                                      <p className="scap">
                                        <span className="snum">{s.n}</span>
                                        <span dangerouslySetInnerHTML={{ __html: personalise(s.caption_html) }} />
                                      </p>
                                      <Shot step={s} base={walkBase} />
                                    </li>
                                  ))}
                                </ol>
                              </details>
                            );
                          })}
                        </div>
                        <p className="hint">
                          Screenshots are from the Postgame account. Your app may look slightly different.
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  !walkKey && <p className="hint">Screenshots coming.</p>
                )}
              </div>
            );
          })}
        </Task>

        {/* ===================== 4 · LINK ===================== */}
        <Task done={shown[3]} onToggle={() => toggle(3)}>
          <p className="ttitle">Send us the link</p>
          <p>Once your {postLabel.toLowerCase()} is live, paste its link here so we know it&apos;s up.</p>
          <div className="card" style={{ marginTop: 14 }}>
            {liveUrl ? (
              <>
                <div className="sent">
                  {CHECK}
                  {postLabel} received, nice work
                </div>
                <a className="sentlink" href={liveUrl} target="_blank" rel="noopener noreferrer">
                  {liveUrl}
                </a>
              </>
            ) : (
              <>
                <label className="lab" htmlFor="postlink">
                  Link to your post
                </label>
                <div className="linkfield">
                  <input
                    type="url"
                    id="postlink"
                    inputMode="url"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={isFeed ? 'https://instagram.com/p/…' : 'https://instagram.com/reel/…'}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setSubmitError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draftOk && !submitting) submit();
                    }}
                  />
                  <button type="button" className="btn ghost" onClick={paste}>
                    {pasted ? 'Pasted' : 'Paste'}
                  </button>
                </div>
                <p className="hint">
                  {isFeed ? (
                    <>
                      On Instagram: open your post, tap <b>···</b> → <b>Link</b> → <b>Copy link</b>.
                    </>
                  ) : (
                    <>
                      On Instagram: open your reel, tap <b>···</b> → <b>Link</b> → <b>Copy link</b>. On TikTok: tap{' '}
                      <b>Share</b> → <b>Copy link</b>.
                    </>
                  )}
                </p>
                {submitError && (
                  <p className="err" role="alert">
                    {submitError}
                  </p>
                )}
                <button
                  type="button"
                  className="btn primary full"
                  style={{ marginTop: 14 }}
                  disabled={!draftOk || submitting}
                  onClick={submit}
                >
                  {submitting ? 'Sending…' : 'Send link'}
                </button>
              </>
            )}
          </div>
        </Task>

        <p className="foot">
          Date doesn&apos;t work, or stuck on a step? Reply to the text this link came in,{' '}
          <b>before</b> you post.
        </p>
        {logos.postgame && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="footmark" src={logos.postgame} alt="Postgame" />
        )}
        <p className="mark">
          {markLine}
          {campaign.seasonLabel ? ` · ${campaign.seasonLabel}` : ''}
        </p>
      </main>
    </div>
  );
}
