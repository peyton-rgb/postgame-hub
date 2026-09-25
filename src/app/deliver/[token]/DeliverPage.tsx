'use client';

// ============================================================
// /deliver/[token] — the athlete page: one job per screen
//
// TWO SCREENS behind one link (approved boards 7, 8, 9):
//
//   HOME   a greeting, one headline about the active post, a hero card with
//          ONE orange button, then "Coming up" and "Done" as compact rows.
//   POST   the four steps as a list where only one is open at a time. The
//          open step has exactly one orange button; pressing it does the
//          action, ticks the step and opens the next one.
//
// Everything the page did before still works: Web Share into Photos (now for
// the Reel's two files too), the one-file-at-a-time download fallback, Save
// all photos, copy caption, copy tag (kept only where a caption lacks the
// tag), the Instagram / TikTok toggle, the screenshot walkthrough, Send link
// (URL checks, no overwrite — both server-side), the pending "on its way"
// slots, the conditional date, the posted state and the help box.
//
// The tick-offs are the athlete's own and live only in their browser
// (localStorage, same keys as before: pg-deliver:<token>:<postId>). The ONLY
// thing written to the database is the live link, through
// POST /api/deliver/[token]/posted, exactly as before.
//
// DATES. intended_post_date is a plain calendar date. "Today", "in N days"
// and "due today" are worked out in the athlete's browser against their own
// calendar, after the page mounts — never on the server, whose UTC clock is
// already on tomorrow during a Florida evening. A post with no date counts as
// undated even when its label holds placeholder text ("TBD").
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DeliverPost, DeliverView } from '@/lib/deliver-package';
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
const STEP_NAMES = ['Save your files', 'Copy your caption', 'Post it on Instagram', 'Send us the link'];

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

type NamedFile = { url: string; name: string };

/**
 * Save several files at once — a Feed carousel, or a Reel's video + cover.
 *
 * On a phone the Web Share API with files hands them to the share sheet, so
 * iOS can "Save Images" straight into Photos — the only way into the camera
 * roll from a browser. Everywhere else (or if sharing fails) each file
 * downloads on its own, one after another. Never a zip: a phone can't open one.
 */
async function saveFiles(
  files: NamedFile[],
  opts: { downloadFallback: boolean } = { downloadFallback: true }
): Promise<'shared' | 'downloaded' | 'cancelled' | 'unavailable' | 'failed'> {
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
    try {
      const blobs = await Promise.all(
        files.map(async ({ url, name }) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          const blob = await res.blob();
          return new File([blob], name, { type: blob.type || 'application/octet-stream' });
        })
      );
      if (navigator.canShare({ files: blobs })) {
        await navigator.share({ files: blobs });
        return 'shared';
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      /* otherwise fall through to downloads */
    }
  }
  // The Reel asks for no automatic fallback: its fallback is the per-file
  // links the athlete taps (see saveStepFiles), which browsers never block.
  if (!opts.downloadFallback) return 'unavailable';
  try {
    files.forEach(({ url, name }, i) => {
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

// --- dates (always the athlete's own calendar) ------------------------------

/** Today as 'YYYY-MM-DD' in the browser's local time. */
function localToday(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

/** Whole days from `today` to a plain calendar date. Both are Y-M-D strings. */
function daysBetween(today: string, iso: string | null): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(today);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!a || !b) return null;
  return Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86400000);
}

// --- post facts ------------------------------------------------------------

const isPosted = (p: DeliverPost) => !!p.link.liveUrl || p.status === 'posted';
const isFeed = (p: DeliverPost) => p.deliverableKey === 'feed';
/** "Reel" / "Feed post" — for "Your Reel", "Your Feed post's link". */
const shortLabel = (p: DeliverPost) => (isFeed(p) ? p.label ?? 'Feed post' : 'Reel');
/** "Reel + cover" / "Feed post" — the post's title on cards. */
const cardLabel = (p: DeliverPost) => (isFeed(p) ? p.label ?? 'Feed post' : 'Reel + cover');
/** A post is undated when it has no date — whatever placeholder its label holds. */
const hasDate = (p: DeliverPost) => !!p.date;

function dateLine(p: DeliverPost, school: string | null): string {
  if (!hasDate(p)) return "Date coming soon. We'll text you.";
  return p.dateConditional
    ? `${p.dateLabel} · only if ${school ?? 'your team'} wins`
    : `${p.dateLabel} · any time that day`;
}

// --- icons -----------------------------------------------------------------

const CHECK = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CLOCK = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 4.8V8l2.2 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const CHEVRON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BACK = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ARROW = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DOWNLOAD = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const COPY = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="5" y="5" width="8.5" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 10.5V4a1.5 1.5 0 011.5-1.5H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const PHOTO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="8.5" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4 17l4.8-4.2 3.4 3 3-2.4L20 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Thumb({ p, size }: { p: DeliverPost; size: 'big' | 'small' }) {
  const src = p.files.cover ?? p.files.photos[0]?.url ?? null;
  return (
    <span className={`thumb ${size}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="ph">{PHOTO_ICON}</span>
      )}
    </span>
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

function HelpBox() {
  // Wording unchanged from the shipped page.
  return (
    <div className="help">
      <p>
        Date doesn&apos;t work, or stuck on a step? Reply to the text this link came in, <b>before</b> you post.
      </p>
    </div>
  );
}

// ============================================================
// HOME — board 7
// ============================================================

function Home({
  view,
  activeId,
  today,
  onOpen,
}: {
  view: DeliverView;
  activeId: string;
  today: string | null;
  onOpen: (postId: string) => void;
}) {
  const { athlete, campaign, posts, logos } = view;
  const firstName = athlete.name.trim().split(/\s+/)[0];
  const allDone = posts.length > 0 && posts.every(isPosted);
  const active = allDone ? null : posts.find((p) => p.postId === activeId) ?? null;
  const days = active && today ? daysBetween(today, active.date) : null;

  const headline = !active
    ? "You're all done"
    : !hasDate(active)
      ? `Your ${shortLabel(active)} is next`
      : days === 0
        ? `Your ${shortLabel(active)} goes up today`
        : days !== null && days < 0
          ? `Your ${shortLabel(active)} is next`
          : `Your ${shortLabel(active)} goes up ${active.dateLabel}`;

  const when =
    !active || !hasDate(active)
      ? 'Date coming soon'
      : days === null
        ? active.dateLabel
        : days === 0
          ? 'Due today'
          : days === 1
            ? 'Tomorrow'
            : days > 1
              ? `In ${days} days`
              : `Due ${active.dateLabel}`;

  const comingUp = posts.filter((p) => !isPosted(p) && p.postId !== active?.postId);
  const done = posts.filter(isPosted);
  const greeting = [campaign.title, campaign.seasonLabel].filter(Boolean).join(', ');

  return (
    <>
      <p className="greet">
        Hi {firstName}
        {greeting ? ` · ${greeting}` : ''}
      </p>
      <h1 className="headline">{headline}</h1>

      {active && (
        <div className="hero">
          <div className="hero-top">
            <Thumb p={active} size="big" />
            <div className="hero-text">
              <div className="when">
                Post {posts.indexOf(active) + 1} of {posts.length} · {when}
              </div>
              <div className="ptitle">{cardLabel(active)}</div>
              <div className="dline">{dateLine(active, athlete.school)}</div>
            </div>
          </div>
          <button type="button" className="btn primary" onClick={() => onOpen(active.postId)}>
            Start · {TASK_COUNT} quick steps {ARROW}
          </button>
        </div>
      )}

      {comingUp.length > 0 && (
        <section className="group">
          <h2 className="gtitle">Coming up</h2>
          {comingUp.map((p) => (
            <button type="button" className="prow" key={p.postId} onClick={() => onOpen(p.postId)}>
              <Thumb p={p} size="small" />
              <span className="prow-text">
                <span className="prow-t">
                  {cardLabel(p)}
                  {isFeed(p) && p.files.photos.length > 0
                    ? ` · ${p.files.photos.length} photo${p.files.photos.length === 1 ? '' : 's'}`
                    : ''}
                </span>
                <span className="prow-s">{dateLine(p, athlete.school)}</span>
              </span>
              <span className="chev">{CHEVRON}</span>
            </button>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="group">
          <h2 className="gtitle">Done</h2>
          {done.map((p) => (
            <button type="button" className="prow done" key={p.postId} onClick={() => onOpen(p.postId)}>
              <span className="tick">{CHECK}</span>
              <span className="prow-text">
                <span className="prow-t">{cardLabel(p)}</span>
                <span className="prow-s ok">Posted · link received</span>
              </span>
              <span className="chev">{CHEVRON}</span>
            </button>
          ))}
        </section>
      )}

      <HelpBox />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logos.postgame && <img className="footmark" src={logos.postgame} alt="Postgame" />}
    </>
  );
}

// ============================================================
// POST — boards 8 and 9
// ============================================================

type StepState = 'done' | 'current' | 'todo' | 'locked';

function StepRow({
  n,
  title,
  line,
  state,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  line: string | null;
  state: StepState;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const locked = state === 'locked';
  return (
    <div className={`srow ${state}${open ? ' open' : ''}`}>
      <button
        type="button"
        className="shead"
        onClick={onToggle}
        disabled={locked}
        aria-expanded={open}
        aria-controls={`step-${n}`}
      >
        <span className="circle" aria-hidden="true">{state === 'done' ? CHECK : n}</span>
        <span className="stext">
          <span className="st">{title}</span>
          {line && <span className="ss">{line}</span>}
        </span>
      </button>
      {open && !locked && (
        <div className="sbody" id={`step-${n}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function PostScreen({
  view,
  post,
  token,
  today,
  ticks,
  setTick,
  onBack,
  onPosted,
}: {
  view: DeliverView;
  post: DeliverPost;
  token: string;
  today: string | null;
  ticks: boolean[];
  setTick: (i: number, v: boolean) => void;
  onBack: () => void;
  onPosted: (url: string) => void;
}) {
  const { athlete, campaign, logos, posts } = view;
  const feed = isFeed(post);
  const photos = post.files.photos;
  const liveUrl = post.link.liveUrl;
  const firstName = athlete.name.trim().split(/\s+/)[0];
  const undated = !hasDate(post);
  const days = today ? daysBetween(today, post.date) : null;

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
    return feed ? ['instagram_feed'] : ['instagram_reel', 'tiktok'];
  }, [post.platforms, feed]);
  const [platform, setPlatform] = useState(platforms[0]);
  const [showShots, setShowShots] = useState(false);
  useEffect(() => {
    setPlatform(platforms[0]);
    setShowShots(false);
  }, [post.postId, platforms]);

  const who = tagHtml ?? (campaign.brandName ? esc(campaign.brandName) : 'the brand');
  const quick = (walk?.quick_steps?.[platform] ?? fallbackQuickSteps(platform, who)).map(personalise);
  const shots = walk && walk.platform === platform ? walk : null;

  // ---- step state ----
  const locked = [false, false, undated, undated];
  const done = ticks.map((t) => (liveUrl ? true : t));
  const current = done.findIndex((d, i) => !d && !locked[i]);
  // Finished means the link is in — the only thing that ends a post.
  const allDone = !!liveUrl && done.every(Boolean);
  const doneCount = done.filter(Boolean).length;
  // 'auto' = open whichever step is current. Ticks load from localStorage
  // after the first render, so a step chosen on mount would be stale; 'auto'
  // follows them until the athlete taps a row or presses a button.
  const [openSel, setOpenSel] = useState<number | null | 'auto'>('auto');
  const open = openSel === 'auto' ? (current >= 0 ? current : null) : openSel;
  useEffect(() => {
    setOpenSel('auto'); // a different post: back to its current step
  }, [post.postId]);
  const setOpen = (v: number | null) => setOpenSel(v);

  /** Tick step i and open the next step that still needs doing. */
  const advance = (i: number) => {
    setTick(i, true);
    const after = done.map((d, j) => (j === i ? true : d));
    const nxt = after.findIndex((d, j) => j > i && !d && !locked[j]);
    const any = nxt >= 0 ? nxt : after.findIndex((d, j) => !d && !locked[j]);
    setOpen(any >= 0 ? any : null);
  };
  const stateOf = (i: number): StepState =>
    done[i] ? 'done' : locked[i] ? 'locked' : i === current ? 'current' : 'todo';

  // ---- step 1: save ----
  const videoSlot = post.files.video;
  const coverSlot = post.files.cover;
  const filesReady = feed ? photos.length > 0 : !!videoSlot && !!coverSlot;
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  // Reel fallback: today's one-file-at-a-time links, shown when the share
  // sheet can't take both files (e.g. desktop, or a video too big to hand over).
  const [showSingles, setShowSingles] = useState(false);
  const [savedVideo, setSavedVideo] = useState(false);
  const [savedCover, setSavedCover] = useState(false);
  useEffect(() => {
    setShowSingles(false);
    setSavedVideo(false);
    setSavedCover(false);
  }, [post.postId]);
  useEffect(() => {
    if (!saveNote) return;
    const t = setTimeout(() => setSaveNote(null), 3200);
    return () => clearTimeout(t);
  }, [saveNote]);

  async function saveStepFiles() {
    const files: NamedFile[] = feed
      ? photos.map((p, i) => ({ url: p.url, name: photoName(athlete.name, i, p.url) }))
      : [
          ...(videoSlot ? [{ url: videoSlot, name: fileName(athlete.name, 'video', videoSlot) }] : []),
          ...(coverSlot ? [{ url: coverSlot, name: fileName(athlete.name, 'cover', coverSlot) }] : []),
        ];
    if (!files.length) return;
    setSaving(true);
    const how = await saveFiles(files, { downloadFallback: feed });
    setSaving(false);
    if (how === 'shared') setSaveNote('Sent to your share sheet. Choose Save to keep them in Photos.');
    else if (how === 'downloaded') setSaveNote(`Saving ${files.length} photos…`);
    else if (how === 'unavailable') {
      setShowSingles(true);
      setSaveNote('Save them one at a time with the two buttons below.');
    } else if (how === 'failed') setSaveNote('Couldn’t save them together. Tap and hold each one to save it.');
    if (how === 'shared' || how === 'downloaded') advance(0);
  }

  /** One file saved from the per-file links; both saved ticks the step. */
  function savedOne(which: 'video' | 'cover') {
    const v = which === 'video' ? true : savedVideo || !videoSlot;
    const c = which === 'cover' ? true : savedCover || !coverSlot;
    if (which === 'video') setSavedVideo(true);
    else setSavedCover(true);
    if (v && c) advance(0);
  }

  // ---- step 2: caption ----
  const caption = post.caption.text;
  const [copied, setCopied] = useState(false);
  const [tagCopied, setTagCopied] = useState(false);
  // Keep the tag row only where this caption doesn't already carry the tag.
  const captionHasTag =
    !!caption && !!campaign.tagHandle && caption.toLowerCase().includes(`@${campaign.tagHandle.toLowerCase()}`);
  async function copyCaption() {
    if (!caption) return;
    await copyText(caption);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      advance(1);
    }, 1400);
  }
  useEffect(() => {
    if (!tagCopied) return;
    const t = setTimeout(() => setTagCopied(false), 1400);
    return () => clearTimeout(t);
  }, [tagCopied]);

  // ---- step 4: link ----
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
      setTick(3, true);
      setOpen(null);
      onPosted(saved);
    } catch {
      setSubmitError('Could not reach us. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---- the next post, for the finished card ----
  const nextPost = posts.find((p) => p.postId !== post.postId && !isPosted(p)) ?? null;
  const nextLine = nextPost
    ? hasDate(nextPost)
      ? `Next up: your ${shortLabel(nextPost)}. It goes up ${nextPost.dateLabel}.`
      : `Next up: your ${shortLabel(nextPost)}. We'll text you its date.`
    : "That's everything for now.";

  // ---- step lines ----
  const quickCount = quick.length;
  const lines: (string | null)[] = [0, 1, 2, 3].map((i) => {
    const s = stateOf(i);
    if (s === 'done') return [feed ? 'Photos saved' : 'Video and cover saved', 'Caption copied', 'Posted', 'Link sent'][i];
    if (s === 'locked') return 'Opens once your date is set';
    if (i === 0 && feed && photos.length) return 'A carousel: post them together, in this order';
    if (s === 'current') return null;
    return [
      feed ? (photos.length ? `${photos.length} photos` : 'Photos on their way') : 'Video + cover photo',
      'One tap',
      `${quickCount} taps in the app`,
      'Paste it here',
    ][i];
  });

  const toggle = (i: number) => {
    if (locked[i]) return;
    setOpen(open === i ? null : i);
  };

  return (
    <>
      <header className="topbar">
        <button type="button" className="backlink" onClick={onBack}>
          {BACK}
          All posts
        </button>
        {logos.brand && (
          <span className="plate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logos.brand} alt={campaign.brandName ?? ''} />
          </span>
        )}
      </header>

      <h1 className="posttitle">Your {shortLabel(post)}</h1>

      {undated ? (
        <div className="datebox">
          <span className="ic">{CLOCK}</span>
          <div>
            <div className="t">Date coming soon.</div>
            <p>
              We&apos;ll text you when it&apos;s set. Don&apos;t post it yet, but you can save your{' '}
              {feed ? 'photos' : 'files'} now.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="dateline">
            <span className="ic">{CLOCK}</span>
            {days === 0 ? `Post today · ${post.dateLabel}` : `Post on ${post.dateLabel}`}
          </div>
          {post.dateConditional ? (
            <div className="datebox cond">
              <span className="ic">{CLOCK}</span>
              <p>
                Only post if {athlete.school ?? 'your team'} wins that day. Any time after the win works.
              </p>
            </div>
          ) : (
            <p className="datesub">Any time that day works.</p>
          )}
        </>
      )}

      {allDone ? (
        <div className="finished" role="status">
          <div className="t">
            <span className="tick">{CHECK}</span>
            Link received. Thanks, {firstName}.
          </div>
          <p>{nextLine}</p>
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              {liveUrl}
            </a>
          )}
        </div>
      ) : (
        <div className="progress">
          <div className="prow-l">
            <b>{current >= 0 ? `Step ${current + 1} of ${TASK_COUNT}` : `${doneCount} of ${TASK_COUNT} done`}</b>
            <span>
              {current < 0 ? 'Waiting for your date' : current === 0 && feed ? 'Save your photos' : STEP_NAMES[current]}
            </span>
          </div>
          <div className="segs" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={done[i] ? 'done' : i === current ? 'current' : ''} />
            ))}
          </div>
        </div>
      )}

      <div className="steps">
        {/* ---- 1 · save ---- */}
        <StepRow
          n={1}
          title={feed && photos.length ? `Save your ${photos.length} photos` : feed ? 'Save your photos' : 'Save your files'}
          line={lines[0]}
          state={stateOf(0)}
          open={open === 0}
          onToggle={() => toggle(0)}
        >
          {feed ? (
            photos.length ? (
              <div className="pgrid">
                {photos.map((p, i) => (
                  <figure className="pcell" key={`${p.position}-${p.url}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1}`} />
                    <span className="pnumber">{i + 1}</span>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="onway">
                <b>Your photos are on their way.</b>
                <span>
                  Waiting on {campaign.brandName ?? 'the brand'}&apos;s approval. They appear here on their own.
                </span>
              </div>
            )
          ) : (
            <div className="tiles">
              <div className="tile">
                {videoSlot ? (
                  <video className="media" src={videoSlot} controls playsInline preload="metadata" />
                ) : (
                  <div className="onway">
                    <b>On its way.</b>
                    <span>Waiting on {campaign.brandName ?? 'the brand'}&apos;s approval.</span>
                  </div>
                )}
                <div className="tt">Video</div>
                <div className="ts">This is your post</div>
              </div>
              <div className="tile">
                {coverSlot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="media" src={coverSlot} alt="" />
                ) : (
                  <div className="onway">
                    <b>On its way.</b>
                    <span>Waiting on {campaign.brandName ?? 'the brand'}&apos;s approval.</span>
                  </div>
                )}
                <div className="tt">Cover photo</div>
                <div className="ts">Goes on the Reel</div>
              </div>
            </div>
          )}
          <button
            type="button"
            className={`btn ${done[0] ? 'done' : 'primary'}`}
            disabled={!filesReady || saving}
            onClick={saveStepFiles}
          >
            {DOWNLOAD}
            {saving
              ? 'Preparing…'
              : done[0]
                ? 'Saved ✓ · Save again'
                : feed
                  ? photos.length
                    ? `Save all ${photos.length} photos`
                    : 'Save all photos'
                  : 'Save both to Photos'}
          </button>
          {saveNote && <p className="note" role="status">{saveNote}</p>}
          {!feed && showSingles && (
            <div className="singles">
              {videoSlot && (
                <a
                  className={`btn small ${savedVideo ? 'done' : 'ghost'}`}
                  href={downloadHref(videoSlot, fileName(athlete.name, 'video', videoSlot))}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  onClick={() => savedOne('video')}
                >
                  {savedVideo ? 'Video saved ✓' : 'Save video'}
                </a>
              )}
              {coverSlot && (
                <a
                  className={`btn small ${savedCover ? 'done' : 'ghost'}`}
                  href={downloadHref(coverSlot, fileName(athlete.name, 'cover', coverSlot))}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  onClick={() => savedOne('cover')}
                >
                  {savedCover ? 'Cover saved ✓' : 'Save cover'}
                </a>
              )}
            </div>
          )}
          {!feed && <p className="note">The photo is the Reel&apos;s cover, not a separate post.</p>}
        </StepRow>

        {/* ---- 2 · caption ---- */}
        <StepRow
          n={2}
          title="Copy your caption"
          line={lines[1]}
          state={stateOf(1)}
          open={open === 1}
          onToggle={() => toggle(1)}
        >
          <div className="capcard">
            {caption ? (
              <p className="captext">{caption}</p>
            ) : (
              <p className="captext pending">Your caption is on its way. It&apos;ll appear here once it&apos;s approved.</p>
            )}
          </div>
          <button
            type="button"
            className={`btn ${copied ? 'done' : 'primary'}`}
            disabled={!caption}
            onClick={copyCaption}
          >
            {COPY}
            {copied ? 'Copied ✓' : 'Copy caption'}
          </button>
          {caption && captionHasTag && <p className="note">Paste it exactly. The tag and hashtag are already in it.</p>}
          {caption && !captionHasTag && campaign.tagHandle && (
            <>
              <p className="note">Paste it exactly, then tag this account too.</p>
              <div className="tagrow">
                <div>
                  <div className="tl">Tag this account</div>
                  <div className="tv">@{campaign.tagHandle}</div>
                </div>
                <button
                  type="button"
                  className={`btn small ${tagCopied ? 'done' : 'ghost'}`}
                  onClick={async () => {
                    await copyText(`@${campaign.tagHandle}`);
                    setTagCopied(true);
                  }}
                >
                  {tagCopied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </StepRow>

        {/* ---- 3 · post it ---- */}
        <StepRow
          n={3}
          title="Post it on Instagram"
          line={lines[2]}
          state={stateOf(2)}
          open={open === 2}
          onToggle={() => toggle(2)}
        >
          {platforms.length > 1 && (
            <div className="seg" role="group" aria-label="Where you post">
              {platforms.map((p) => (
                <button key={p} type="button" aria-pressed={platform === p} onClick={() => setPlatform(p)}>
                  {PLATFORM_LABEL[p]}
                </button>
              ))}
            </div>
          )}
          <ol className="quick">
            {quick.map((html, i) => (
              <li key={i}>
                <span className="n">{i + 1}</span>
                <span dangerouslySetInnerHTML={{ __html: html }} />
              </li>
            ))}
          </ol>

          {campaign.ftcNote && (
            <div className="dontskip">
              <div className="t">Don&apos;t skip</div>
              <p>{campaign.ftcNote}</p>
            </div>
          )}

          {shots ? (
            <>
              <button
                type="button"
                className="btn ghost"
                aria-expanded={showShots}
                onClick={() => setShowShots((v) => !v)}
              >
                {showShots ? 'Hide the screenshots' : 'See it with screenshots'}
              </button>
              {showShots && (
                <div className="shots">
                  {shots.phases.map((ph, pi) => {
                    const steps = shots.steps.filter((s) => s.n >= ph.from_step && s.n <= ph.to_step);
                    return (
                      <div className="sgroup" key={pi}>
                        <div className="ghead">
                          <span className="gt">{ph.title}</span>
                          <span className="gc">
                            {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                          </span>
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
                  <p className="note">Screenshots are from the Postgame account. Your app may look slightly different.</p>
                </div>
              )}
            </>
          ) : (
            <p className="note">Screenshots coming.</p>
          )}

          <button
            type="button"
            className={`btn ${done[2] ? 'done' : 'primary'}`}
            onClick={() => (done[2] ? setTick(2, false) : advance(2))}
          >
            {CHECK}
            {done[2] ? 'Posted ✓' : 'I’ve posted it'}
          </button>
        </StepRow>

        {/* ---- 4 · link ---- */}
        <StepRow
          n={4}
          title="Send us the link"
          line={lines[3]}
          state={stateOf(3)}
          open={open === 3}
          onToggle={() => toggle(3)}
        >
          {liveUrl ? (
            <p className="note">
              We have it:{' '}
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                {liveUrl}
              </a>
            </p>
          ) : (
            <>
              <label className="flabel" htmlFor="postlink">
                Your {shortLabel(post)}&apos;s link
              </label>
              <div className="linkfield">
                <input
                  type="url"
                  id="postlink"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder={feed ? 'instagram.com/p/…' : 'instagram.com/reel/…'}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSubmitError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draftOk && !submitting) submit();
                  }}
                />
                <button type="button" className="btn ghost small" onClick={paste}>
                  {pasted ? 'Pasted' : 'Paste'}
                </button>
              </div>
              <p className="note">
                {platform === 'tiktok' ? (
                  <>
                    On TikTok, tap <b>Share</b> → <b>Copy link</b>.
                  </>
                ) : (
                  <>
                    On Instagram, tap <b>···</b> on your {shortLabel(post)} → <b>Copy link</b>.
                  </>
                )}
              </p>
              {submitError && (
                <p className="err" role="alert">
                  {submitError}
                </p>
              )}
              <button type="button" className="btn primary" disabled={!draftOk || submitting} onClick={submit}>
                {submitting ? 'Sending…' : 'Send link'}
              </button>
            </>
          )}
        </StepRow>
      </div>

      <HelpBox />
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
  // The athlete's own calendar day — only known in the browser.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localToday()), []);

  // Ticks are per post and live only in this browser. Keys unchanged.
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
  // Same rule as the API's activePostId, re-run so a link sent on this page
  // moves the home screen on to the next post.
  const activeId = (posts.find((p) => !isPosted(p)) ?? posts[posts.length - 1])?.postId ?? view.activePostId;
  const post = openId ? posts.find((p) => p.postId === openId) ?? null : null;

  // Back to the top whenever the screen changes — a phone keeps its scroll.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [openId]);

  return (
    <div className="dv">
      <main className="wrap">
        {post ? (
          <PostScreen
            view={shownView}
            post={post}
            token={token}
            today={today}
            ticks={ticksFor(post.postId)}
            setTick={(i, v) => setTick(post.postId, i, v)}
            onBack={() => setOpenId(null)}
            onPosted={(url) => setLiveUrls((prev) => ({ ...prev, [post.postId]: url }))}
          />
        ) : (
          <>
            <header className="topbar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logos.postgame ? <img className="pg" src={logos.postgame} alt="Postgame" /> : <span />}
              {logos.brand && (
                <span className="plate">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logos.brand} alt={campaign.brandName ?? ''} />
                </span>
              )}
            </header>
            <Home view={shownView} activeId={activeId} today={today} onOpen={setOpenId} />
          </>
        )}
      </main>
    </div>
  );
}
