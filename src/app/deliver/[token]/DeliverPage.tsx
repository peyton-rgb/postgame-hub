'use client';

// ============================================================
// /deliver/[token] — the athlete page, redesigned (Step 4)
//
// TWO SCREENS behind one link:
//
//   HOME     every post the athlete has this season, as cards
//   POST     one post, with its four steps all open on the page
//
// The old page put tiles and one checklist on a single screen, which meant
// the four steps belonged to whichever tile happened to be selected. Splitting
// them makes "what do I have to do" and "how do I do this one" two different
// questions, which is how the athlete actually reads it on a phone.
//
// ONE DROPDOWN on the whole page: "See it step by step, with screenshots".
// Everything else is open. Inside it every group shows at once, each a
// sideways-scrolling row of the real screenshots — no nested dropdowns.
//
// The tick-offs are the athlete's own and live only in their browser
// (localStorage, keyed per post, every access wrapped — private mode throws).
// The ONLY thing written to the database is the live link, through
// POST /api/deliver/[token]/posted, exactly as before.
//
// Missing data is never invented: a file that isn't attached shows a dashed
// "On its way" slot and never blocks the other steps.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DeliverPhoto, DeliverPost, DeliverView } from '@/lib/deliver-package';
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
const STEP_NAMES = ['Save your files', 'Copy your caption', 'Post it', 'Send us the link'];

// --- helpers ---------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Fallback quick steps, used only when a platform has none in its
// walkthrough.json (Feed today). `who` is already HTML-escaped.
// WORDING UNCHANGED from the shipped page.
function fallbackQuickSteps(platform: string, who: string): string[] {
  if (platform === 'instagram_feed') {
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
function fileName(athlete: string, kind: string, url: string): string {
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
 * iOS can "Save N Images" straight into Photos — the only way into the camera
 * roll from a browser. Everywhere else each photo downloads on its own.
 * Never a zip: a phone can't open one.
 */
async function saveAllPhotos(
  photos: DeliverPhoto[],
  athlete: string
): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  const named = photos.map((p, i) => ({ url: p.url, name: photoName(athlete, i, p.url) }));
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
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      /* otherwise fall through to downloads */
    }
  }
  try {
    named.forEach(({ url, name }, i) => {
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

const CLOCK = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 4.8V8l2.2 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PHOTO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="8.5" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4 17l4.8-4.2 3.4 3 3-2.4L20 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A save button that turns green once it has been used. */
function SaveLink({ href, label, saved, onSaved }: { href: string; label: string; saved: boolean; onSaved: () => void }) {
  return (
    <a
      className={`btn ${saved ? 'done' : 'primary'} full`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download
      onClick={onSaved}
    >
      {saved ? 'Saved ✓' : label}
    </a>
  );
}

function CopyButton({
  text,
  label,
  variant,
  onCopied,
}: {
  text: string;
  label: string;
  variant: 'primary' | 'ghost';
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className={`btn ${copied ? 'done' : variant}`}
      onClick={async () => {
        await copyText(text);
        setCopied(true);
        onCopied?.();
      }}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

// Highlight boxes are positioned in % of the image, so until the image has
// loaded they would collapse into thin lines across a zero-height box.
function Shot({ step, base }: { step: WalkStep; base: string }) {
  const [ready, setReady] = useState(false);
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setReady(true);
  }, []);
  return (
    <figure className="shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={`${base}/${step.image}`} alt="" loading="lazy" onLoad={() => setReady(true)} />
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
      <figcaption className="snum">{step.n}</figcaption>
    </figure>
  );
}

// --- date helpers ----------------------------------------------------------

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const then = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((then - today) / 86400000);
}

// ============================================================
// HOME — every post
// ============================================================

function Home({
  view,
  ticksFor,
  onOpen,
}: {
  view: DeliverView;
  ticksFor: (postId: string) => boolean[];
  onOpen: (postId: string) => void;
}) {
  const { athlete, campaign, posts } = view;
  const postedCount = posts.filter((p) => p.link.liveUrl || p.status === 'posted').length;
  const nextId = posts.find((p) => !(p.link.liveUrl || p.status === 'posted'))?.postId ?? null;
  const school = athlete.school;

  return (
    <>
      <p className="kicker">
        {[campaign.title, campaign.seasonLabel].filter(Boolean).join(' · ')}
      </p>
      <h1 className="h1">Your posting instructions</h1>
      <p className="who">
        {[athlete.name, school, athlete.handle ? `@${athlete.handle}` : null].filter(Boolean).join(' · ')}
      </p>

      <div className="prog">
        <div className="row">
          <span className="lab">
            <b>{postedCount}</b> of {posts.length} posted
          </span>
          <span className="lab">{posts.length} posts this season</span>
        </div>
        <div className="track">
          <div className="fill ok" style={{ width: `${posts.length ? (postedCount / posts.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="plist">
        {posts.map((p, i) => {
          const done = !!(p.link.liveUrl || p.status === 'posted');
          const isNext = p.postId === nextId;
          const days = daysUntil(p.date);
          const badge = done
            ? 'Done'
            : !isNext
              ? 'Later'
              : days === null
                ? 'Up next'
                : days < 0
                  ? 'Up next'
                  : days === 0
                    ? 'Today'
                    : days === 1
                      ? 'Tomorrow'
                      : `In ${days} days`;
          // A reel always reads "Reel + cover": the cover is part of the same
          // post, and calling it just "Reel" hides a file they must save.
          const kind = p.deliverableKey === 'reel' ? 'Reel + cover' : p.label ?? 'Feed post';
          const label = `Post ${i + 1} · ${kind.toUpperCase()}`;
          const filesReady =
            p.deliverableKey === 'feed' ? p.files.photos.length > 0 : !!p.files.video && !!p.files.cover;
          const ticks = ticksFor(p.postId);
          const doneSteps = ticks.filter(Boolean).length + (done && !ticks[3] ? 1 : 0);
          const status = done
            ? '✓ Posted · link received'
            : !filesReady
              // Photos are plural, the video is one file — so the verb differs.
              ? `${p.deliverableKey === 'feed' ? 'Photos on their way' : 'Video on its way'} · you can prep the rest`
              : doneSteps > 0
                ? `${Math.min(doneSteps, TASK_COUNT)} of ${TASK_COUNT} steps done`
                : `Everything's ready · ${TASK_COUNT} quick steps`;
          const thumb = p.files.cover ?? p.files.photos[0]?.url ?? null;

          return (
            <button
              type="button"
              key={p.postId}
              className={`pcard${isNext && !done ? ' next' : ''}${done ? ' done' : ''}`}
              onClick={() => onOpen(p.postId)}
            >
              <span className="thumb">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" />
                ) : (
                  <span className="ph">{PHOTO_ICON}</span>
                )}
              </span>
              <span className="body">
                <span className="top">
                  <span className="lab">{label}</span>
                  <span className={`badge ${done ? 'done' : isNext ? 'next' : 'later'}`}>{badge}</span>
                </span>
                <span className="date">{p.dateLabel ?? 'Date TBC'}</span>
                {p.dateConditional && (
                  <span className="cond">· only if {school ?? 'they'} wins</span>
                )}
                <span className={`status${done ? ' ok' : ''}`}>{status}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="everypost">
        <span className="lab">Every post</span>
        <p>
          {campaign.tagHandle && (
            <>
              Tag <b>@{campaign.tagHandle}</b>
            </>
          )}
          {campaign.hashtag && (
            <>
              {campaign.tagHandle ? ' · ' : ''}use <b>#{campaign.hashtag}</b>
            </>
          )}
          {campaign.brandName && (
            <>
              {campaign.tagHandle || campaign.hashtag ? ' · ' : ''}turn on the paid partnership label with{' '}
              <b>{campaign.brandName}</b>.
            </>
          )}
        </p>
      </div>
    </>
  );
}

// ============================================================
// POST — one post, four open steps
// ============================================================

function Step({
  n,
  title,
  status,
  done,
  isNext,
  children,
}: {
  n: number;
  title: string;
  status: string;
  done: boolean;
  isNext: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`step${done ? ' done' : ''}${isNext ? ' next' : ''}`}>
      <header>
        <span className="circle" aria-hidden="true">{done ? CHECK : n}</span>
        <span className="h">
          <span className="t">{title}</span>
          <span className="s">{status}</span>
        </span>
      </header>
      <div className="sbody">{children}</div>
    </section>
  );
}

function PostScreen({
  view,
  post,
  token,
  ticks,
  setTick,
  onBack,
  onPosted,
}: {
  view: DeliverView;
  post: DeliverPost;
  token: string;
  ticks: boolean[];
  setTick: (i: number, v: boolean) => void;
  onBack: () => void;
  onPosted: (url: string) => void;
}) {
  const { athlete, campaign } = view;
  const isFeed = post.deliverableKey === 'feed';
  const photos = post.files.photos;
  const label = isFeed ? post.label ?? 'Feed post' : 'Reel + cover';
  const liveUrl = post.link.liveUrl;
  const school = athlete.school ?? 'they';

  // ---- walkthrough ----
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

  const tagHtml = campaign.tagHandle ? esc(campaign.tagHandle) : null;
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
  useEffect(() => {
    setPlatform(platforms[0]);
    setShowShots(false);
  }, [post.postId, platforms]);

  const who = tagHtml ?? (campaign.brandName ? esc(campaign.brandName) : 'the brand');
  const quickFor = (p: string) => (walk?.quick_steps?.[p] ?? fallbackQuickSteps(p, who)).map(personalise);
  const shots = walk && walk.platform === platform ? walk : null;

  // ---- saving files ----
  const [savedVideo, setSavedVideo] = useState(false);
  const [savedCover, setSavedCover] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  useEffect(() => {
    if (!saveNote) return;
    const t = setTimeout(() => setSaveNote(null), 2600);
    return () => clearTimeout(t);
  }, [saveNote]);

  async function saveAll() {
    setSavingAll(true);
    const how = await saveAllPhotos(photos, athlete.name);
    setSavingAll(false);
    if (how === 'shared') setSaveNote('Sent to your share sheet — choose Save Images.');
    else if (how === 'downloaded') setSaveNote(`Saving ${photos.length} photos…`);
    else if (how === 'failed') setSaveNote('Couldn’t save them together — save each one below.');
    if (how === 'shared' || how === 'downloaded') setTick(0, true);
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
      onPosted(saved);
    } catch {
      setSubmitError('Could not reach us. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---- progress ----
  const shown = ticks.map((t, i) => (i === 3 && liveUrl ? true : t));
  const doneCount = shown.filter(Boolean).length;
  const nextStep = shown.findIndex((t) => !t);
  const firstName = athlete.name.trim().split(/\s+/)[0];

  const videoSlot = post.files.video;
  const coverSlot = post.files.cover;
  const filesReady = isFeed ? photos.length > 0 : !!videoSlot && !!coverSlot;

  return (
    <>
      <button type="button" className="back" onClick={onBack}>‹ All your posts</button>

      {liveUrl && (
        <div className="postedbanner">
          {CHECK}
          Posted
        </div>
      )}

      <p className="kicker">{label.toUpperCase()}</p>
      <h1 className="h1 big">{post.dateLabel ?? 'Date TBC'}</h1>

      <div className={`golive${post.dateConditional ? ' cond' : ''}`}>
        <span className="ic">{CLOCK}</span>
        <div>
          <div className="t">Goes live · {post.dateLabel ?? 'Date TBC'}</div>
          <p>
            {post.dateConditional
              ? `Only post if ${school} wins that day. Any time after the win works.`
              : 'Any time that day works.'}
          </p>
        </div>
      </div>

      <div className="prog">
        <div className="row">
          <span className="lab">
            <b>{doneCount}</b> of {TASK_COUNT} done
          </span>
          {nextStep >= 0 && <span className="lab">Next: {STEP_NAMES[nextStep]}</span>}
        </div>
        <div className="track">
          <div className="fill ok" style={{ width: `${(doneCount / TASK_COUNT) * 100}%` }} />
        </div>
      </div>

      {/* ---- 1 · files ---- */}
      <Step
        n={1}
        title={isFeed ? 'Save your photos' : 'Save your files'}
        status={
          filesReady
            ? isFeed
              ? `${photos.length} photo${photos.length === 1 ? '' : 's'}, post them in the order shown`
              : 'Video and cover ready'
            : `Waiting on ${campaign.brandName ?? 'the brand'} — you can prep the rest`
        }
        done={shown[0]}
        isNext={nextStep === 0}
      >
        {isFeed ? (
          photos.length ? (
            <>
              <button type="button" className="btn primary full" disabled={savingAll} onClick={saveAll}>
                {savingAll ? 'Preparing…' : `Save all ${photos.length} photos`}
              </button>
              {saveNote && <p className="hint" role="status">{saveNote}</p>}
              <div className="pgrid">
                {photos.map((p, i) => (
                  <figure className="pcell" key={`${p.position}-${p.url}`}>
                    <div className="pframe">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`Photo ${i + 1}`} />
                      <span className="pnumber">{i + 1}</span>
                    </div>
                  </figure>
                ))}
              </div>
              <p className="fnote">Post them in the order shown.</p>
            </>
          ) : (
            <div className="onway">
              <span className="lab">Photos · the post</span>
              <p>Waiting on {campaign.brandName ?? 'the brand'}&apos;s approval. They appear here on their own.</p>
            </div>
          )
        ) : (
          <>
            <div className="tiles">
              <div className="tile">
                <span className="lab">Video · the post</span>
                {videoSlot ? (
                  <>
                    <video className="media" src={videoSlot} controls playsInline preload="metadata" />
                    <SaveLink
                      href={downloadHref(videoSlot, fileName(athlete.name, 'video', videoSlot))}
                      label="Save"
                      saved={savedVideo}
                      onSaved={() => {
                        setSavedVideo(true);
                        if (savedCover || !coverSlot) setTick(0, true);
                      }}
                    />
                  </>
                ) : (
                  <div className="onway">
                    <p>Waiting on {campaign.brandName ?? 'the brand'}&apos;s approval. It appears here on its own.</p>
                  </div>
                )}
              </div>
              <div className="tile">
                <span className="lab">Photo · the cover</span>
                {coverSlot ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="media" src={coverSlot} alt="" />
                    <SaveLink
                      href={downloadHref(coverSlot, fileName(athlete.name, 'cover', coverSlot))}
                      label="Save"
                      saved={savedCover}
                      onSaved={() => {
                        setSavedCover(true);
                        if (savedVideo || !videoSlot) setTick(0, true);
                      }}
                    />
                  </>
                ) : (
                  <div className="onway">
                    <p>Waiting on {campaign.brandName ?? 'the brand'}&apos;s approval. It appears here on its own.</p>
                  </div>
                )}
              </div>
            </div>
            <p className="fnote">Vertical 9:16 video. The photo is the Reel&apos;s cover, never a separate post.</p>
          </>
        )}
      </Step>

      {/* ---- 2 · caption ---- */}
      <Step
        n={2}
        title="Copy your caption"
        status={post.caption.text ? 'Paste it exactly' : 'On its way'}
        done={shown[1]}
        isNext={nextStep === 1}
      >
        <div className="card">
          {post.caption.text ? (
            <>
              <p className="captext">{post.caption.text}</p>
              <CopyButton
                text={post.caption.text}
                label="Copy caption"
                variant="primary"
                onCopied={() => setTick(1, true)}
              />
            </>
          ) : (
            <>
              <p className="captext pending">Your caption is on its way. It&apos;ll appear here once it&apos;s approved.</p>
              <button type="button" className="btn primary" disabled>Copy caption</button>
            </>
          )}
          {campaign.tagHandle && (
            <div className="tagrow">
              <div>
                <span className="lab">Tag this account</span>
                <div className="val">@{campaign.tagHandle}</div>
              </div>
              <CopyButton text={`@${campaign.tagHandle}`} label="Copy" variant="ghost" />
            </div>
          )}
          <p className="fnote">Paste it exactly. The hashtag is already in it.</p>
        </div>
      </Step>

      {/* ---- 3 · post it ---- */}
      <Step
        n={3}
        title="Post it"
        status={
          platforms.length > 1
            ? `${platforms.map((p) => (p === 'instagram_reel' ? 'Reel' : PLATFORM_LABEL[p])).join(' or ')} — either counts`
            : `On ${PLATFORM_LABEL[platforms[0]]}`
        }
        done={shown[2]}
        isNext={nextStep === 2}
      >
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
        <ol className="quick">
          {quickFor(platform).map((html, i) => (
            <li key={i}>
              <span className="n">{i + 1}</span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </li>
          ))}
        </ol>

        {campaign.ftcNote && (
          <div className="required">
            <span className="lab">Required</span>
            <p>{campaign.ftcNote}</p>
          </div>
        )}

        {shots ? (
          <details className="shotsblock" open={showShots} onToggle={(e) => setShowShots((e.target as HTMLDetailsElement).open)}>
            <summary>See it step by step, with screenshots</summary>
            <div className="groups">
              {shots.phases.map((ph, pi) => {
                const steps = shots.steps.filter((s) => s.n >= ph.from_step && s.n <= ph.to_step);
                return (
                  <div className="sgroup" key={pi}>
                    <div className="ghead">
                      <span className="gt">{ph.title}</span>
                      <span className="lab">{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span>
                    </div>
                    <div className="scroller">
                      {steps.map((s) => (
                        <div className="scell" key={s.n}>
                          <Shot step={s} base={walkBase} />
                          <p className="scap" dangerouslySetInnerHTML={{ __html: personalise(s.caption_html) }} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="hint">Screenshots are from the Postgame account. Your app may look slightly different.</p>
          </details>
        ) : (
          <p className="hint">Screenshots coming.</p>
        )}

        <button
          type="button"
          className={`btn ${shown[2] ? 'done' : 'ghost'} full`}
          onClick={() => setTick(2, !ticks[2])}
        >
          {shown[2] ? 'Posted ✓' : 'I’ve posted it'}
        </button>
      </Step>

      {/* ---- 4 · link ---- */}
      <Step
        n={4}
        title="Send us the link"
        status={liveUrl ? 'Link received' : 'So we know it’s up'}
        done={shown[3]}
        isNext={nextStep === 3}
      >
        {liveUrl ? (
          <div className="received">
            <div className="t">{CHECK} Link received. Thanks, {firstName}.</div>
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">{liveUrl}</a>
          </div>
        ) : (
          <div className="card">
            <label className="lab" htmlFor="postlink">Link to your post</label>
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
              Instagram: tap <b>···</b> on your post → <b>Copy link</b>. TikTok: tap <b>Share</b> → <b>Copy link</b>.
            </p>
            {submitError && <p className="err" role="alert">{submitError}</p>}
            <button
              type="button"
              className="btn primary full big"
              style={{ marginTop: 14 }}
              disabled={!draftOk || submitting}
              onClick={submit}
            >
              {submitting ? 'Sending…' : 'Send link'}
            </button>
          </div>
        )}
      </Step>
    </>
  );
}

// ============================================================
// The page
// ============================================================

export default function DeliverPage({ token, view }: { token: string; view: DeliverView }) {
  const { logos, campaign } = view;
  const [openId, setOpenId] = useState<string | null>(null);
  const [liveUrls, setLiveUrls] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(view.posts.map((p) => [p.postId, p.link.liveUrl]))
  );
  const [allTicks, setAllTicks] = useState<Record<string, boolean[]>>({});

  // Ticks are per post and live only in this browser.
  const keyFor = useCallback((postId: string) => `pg-deliver:${token}:${postId}`, [token]);
  useEffect(() => {
    const next: Record<string, boolean[]> = {};
    for (const p of view.posts) next[p.postId] = readTicks(keyFor(p.postId));
    setAllTicks(next);
  }, [view.posts, keyFor]);

  const ticksFor = useCallback(
    (postId: string) => allTicks[postId] ?? Array(TASK_COUNT).fill(false),
    [allTicks]
  );
  const setTick = useCallback(
    (postId: string, i: number, v: boolean) => {
      setAllTicks((prev) => {
        const cur = prev[postId] ?? Array(TASK_COUNT).fill(false);
        const next = cur.slice();
        next[i] = v;
        writeTicks(keyFor(postId), next);
        return { ...prev, [postId]: next };
      });
    },
    [keyFor]
  );

  const posts = useMemo(
    () =>
      view.posts.map((p) =>
        liveUrls[p.postId] && !p.link.liveUrl
          ? { ...p, status: 'posted', link: { ...p.link, liveUrl: liveUrls[p.postId] } }
          : p
      ),
    [view.posts, liveUrls]
  );
  const shownView: DeliverView = { ...view, posts };
  const post = openId ? posts.find((p) => p.postId === openId) ?? null : null;

  // Back to the top whenever the screen changes — a phone keeps its scroll.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [openId]);

  return (
    <div className="dv">
      <main className="wrap">
        <header className="masthead">
          <div className="lockup">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logos.postgame && <img className="pg" src={logos.postgame} alt="Postgame" />}
          </div>
          {logos.brand && (
            <div className="plate">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="cn" src={logos.brand} alt={campaign.brandName ?? ''} />
            </div>
          )}
        </header>

        {post ? (
          <PostScreen
            view={shownView}
            post={post}
            token={token}
            ticks={ticksFor(post.postId)}
            setTick={(i, v) => setTick(post.postId, i, v)}
            onBack={() => setOpenId(null)}
            onPosted={(url) => setLiveUrls((prev) => ({ ...prev, [post.postId]: url }))}
          />
        ) : (
          <Home view={shownView} ticksFor={ticksFor} onOpen={setOpenId} />
        )}

        <div className="help">
          <p>
            Date doesn&apos;t work, or stuck on a step? Reply to the text this link came in,{' '}
            <b>before</b> you post.
          </p>
        </div>
      </main>
    </div>
  );
}
