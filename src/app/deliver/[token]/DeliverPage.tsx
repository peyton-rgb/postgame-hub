'use client';

// ============================================================
// /deliver/[token] — the athlete page: one job per screen
//
// TWO SCREENS behind one link (approved boards 7, 8, 9):
//
//   HOME   a greeting, one headline about the active post, a hero card with
//          ONE orange button, then "Coming up" and "Done" as compact rows.
//   POST   the six steps as a list where only one is open at a time. The
//          open step has exactly one orange button; pressing it does the
//          action and opens the next step (board 10): save the files, copy
//          the caption, then Instagram, the Story (screenshot), TikTok and X.
//          A post is Posted — the payment trigger — only when all four places
//          are in; the server decides that (maybeMarkPosted).
//
// Everything the page did before still works: Web Share into Photos (now for
// the Reel's two files too), the one-file-at-a-time download fallback, Save
// all photos, copy caption, copy tag (kept only where a caption lacks the
// tag), the Instagram / TikTok toggle, the screenshot walkthrough, Send link
// (URL checks, no overwrite — both server-side), the pending "on its way"
// slots, the conditional date, the posted state and the help box.
//
// Steps 1–2 are ticked in the athlete's browser only (localStorage, same keys
// as before: pg-deliver:<token>:<postId>). Steps 3–6 are done when the SERVER
// has the link or screenshot: POST /api/deliver/[token]/link and
// …/story-screenshot answer with the whole view, and the page re-renders
// from it.
//
// DATES. intended_post_date is a plain calendar date. "Today", "in N days"
// and "due today" are worked out in the athlete's browser against their own
// calendar, after the page mounts — never on the server, whose UTC clock is
// already on tomorrow during a Florida evening. A post with no date counts as
// undated even when its label holds placeholder text ("TBD").
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DeliverPost, DeliverView } from '@/lib/deliver-package';
import { checkPlatformLink, type Platform } from '@/lib/post-link';

// --- walkthrough.json (public/posting/walkthroughs/<key>/) -----------------

type Highlight = { tag?: string; x: number; y: number; w: number; h: number; label: string };
type WalkStep = { n: number; image: string; caption_html: string; caption_plain?: string; highlights?: Highlight[] };
type Walkthrough = {
  key: string;
  platform: string;
  phases: { title: string; from_step: number; to_step: number }[];
  steps: WalkStep[];
  quick_steps?: Record<string, string[]>;
};

const WALKTHROUGH_KEY = /^[a-z0-9-]{1,80}$/;
// The walkthrough was shot on the Cane's campaign; its copy names this handle.
const SHOT_HANDLE = 'raisingcanes';

const TASK_COUNT = 6;
const STEP_NAMES = [
  'Save your files',
  'Copy your caption',
  'Post it on Instagram',
  'Share it to your Story',
  'Post it on TikTok',
  'Post it on X',
];

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

// Posted = all four places are in (the server sets status 'posted' then).
// An Instagram link alone is not Posted any more.
const isPosted = (p: DeliverPost) => p.status === 'posted';
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
// Boxes only: the floating tag labels overflowed the image and got clipped
// on a phone, so their words are shown under the image instead (ShotViewer).
function Shot({ step, base, eager }: { step: WalkStep; base: string; eager: boolean }) {
  const [ready, setReady] = useState(false);
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setReady(true);
  }, []);
  return (
    <div className="shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={`${base}/${step.image}`}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setReady(true)}
      />
      {ready &&
        (step.highlights ?? []).map((h, i) => (
          <span
            key={i}
            className="hl"
            aria-hidden="true"
            style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }}
          />
        ))}
    </div>
  );
}

// A highlight label is worth showing under the caption only if it says
// something the caption doesn't: "Your video", "Pending is fine" — not
// "Tap Share" under "Check it over, then tap Share."
function extraLabels(step: WalkStep): string[] {
  const plain = (step.caption_plain ?? step.caption_html.replace(/<[^>]+>/g, '')).toLowerCase();
  return (step.highlights ?? [])
    .map((h) => h.label.trim())
    .filter((label) => {
      const core = label.toLowerCase().replace(/^tap\s+/, '').replace(/[.!]$/, '');
      return core && !plain.includes(core);
    });
}

/**
 * The walkthrough, one screenshot at a time.
 *
 * A scroll-snap strip (so a swipe works natively) driven by Back / Next.
 * The step being looked at is remembered per post in localStorage, so
 * switching platforms and back — which unmounts this — returns to it.
 * The current and next images load eagerly; the rest stay lazy.
 */
function ShotViewer({
  walk,
  base,
  personalise,
  storageKey,
  onClose,
}: {
  walk: Walkthrough;
  base: string;
  personalise: (html: string) => string;
  storageKey: string;
  onClose: () => void;
}) {
  const steps = useMemo(() => walk.steps.slice().sort((a, b) => a.n - b.n), [walk.steps]);
  const phaseOf = (n: number) => walk.phases.find((p) => n >= p.from_step && n <= p.to_step)?.title ?? '';
  const total = steps.length;
  const trackRef = useRef<HTMLDivElement>(null);

  const [idx, setIdx] = useState(() => {
    try {
      const v = Number(window.localStorage.getItem(storageKey));
      return Number.isInteger(v) && v >= 0 && v < total ? v : 0;
    } catch {
      return 0;
    }
  });

  // Jump (no animation) to the remembered step once the strip has a width.
  useEffect(() => {
    const t = trackRef.current;
    if (t) t.scrollLeft = idx * t.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(idx));
    } catch {
      /* not critical */
    }
  }, [idx, storageKey]);

  // Back / Next scroll the strip smoothly; while that runs, the scroll
  // events pass through every in-between position, so they are ignored until
  // the strip arrives. A swipe updates idx only once scrolling has settled —
  // reading it mid-flight would drag idx back and make a quick second tap
  // land on the wrong step.
  const targetRef = useRef<number | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (settleRef.current) clearTimeout(settleRef.current);
  }, []);

  const onScroll = () => {
    const t = trackRef.current;
    if (!t || !t.clientWidth) return;
    if (targetRef.current !== null) {
      if (Math.abs(t.scrollLeft - targetRef.current * t.clientWidth) > 2) return;
      targetRef.current = null; // arrived
      return;
    }
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      const i = Math.round(t.scrollLeft / t.clientWidth);
      if (i >= 0 && i < total) setIdx(i);
    }, 90);
  };

  const go = (i: number) => {
    const t = trackRef.current;
    if (i < 0 || i >= total) return;
    setIdx(i);
    if (!t) return;
    targetRef.current = i;
    t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' });
    // If a swipe interrupts the animation it never "arrives"; stop ignoring.
    setTimeout(() => {
      if (targetRef.current === i) targetRef.current = null;
    }, 900);
  };

  // The strip is only as tall as the screenshot on show — otherwise every
  // short step would sit above the tallest image's worth of empty space.
  const [trackH, setTrackH] = useState<number | null>(null);
  useEffect(() => {
    const t = trackRef.current;
    const slide = t?.children[idx] as HTMLElement | undefined;
    if (!slide) return;
    const measure = () => setTrackH(slide.offsetHeight || null);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure); // fires again once the image loads
    ro.observe(slide);
    return () => ro.disconnect();
  }, [idx]);

  const step = steps[idx];
  const extras = step ? extraLabels(step) : [];

  return (
    <div className="viewer" role="region" aria-label="Screenshots, one step at a time">
      <div className="vhead" aria-live="polite">
        Step {step?.n ?? idx + 1} of {total}
        {step && phaseOf(step.n) ? ` · ${phaseOf(step.n)}` : ''}
      </div>
      <div
        className="vtrack"
        ref={trackRef}
        onScroll={onScroll}
        style={trackH ? { height: trackH } : undefined}
      >
        {steps.map((s, i) => (
          <div className="vslide" key={s.n} aria-hidden={i !== idx}>
            <Shot step={s} base={base} eager={i === idx || i === idx + 1} />
          </div>
        ))}
      </div>
      {step && (
        <div className="vcap">
          <p dangerouslySetInnerHTML={{ __html: personalise(step.caption_html) }} />
          {extras.map((label, i) => (
            <p className="vlabel" key={i}>
              <span className="swatch" aria-hidden="true" />
              {label}
            </p>
          ))}
        </div>
      )}
      <div className="vnav">
        <button type="button" className="btn ghost" onClick={() => go(idx - 1)} disabled={idx === 0}>
          ‹ Back
        </button>
        <button type="button" className="btn ghost" onClick={() => (idx >= total - 1 ? onClose() : go(idx + 1))}>
          Next ›
        </button>
      </div>
      <p className="note">Screenshots are from the Postgame account. Your app may look slightly different.</p>
    </div>
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
                <span className="prow-s ok">All 4 are up</span>
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

// ---- one platform's link (steps 3, 5, 6) -----------------------------------

/**
 * A labelled link input with Paste and one orange button. Checks the link for
 * its platform before enabling the button (the server checks again), posts it
 * to /api/deliver/[token]/link, and hands the server's fresh view back up.
 * Once a link is in, it just shows it.
 */
function LinkField({
  token,
  postId,
  platform,
  label,
  placeholder,
  helper,
  buttonLabel,
  saved,
  onSaved,
}: {
  token: string;
  postId: string;
  platform: Platform;
  label: string;
  placeholder: string;
  helper: React.ReactNode;
  buttonLabel: string;
  saved: string | undefined;
  onSaved: (view: DeliverView) => void;
}) {
  const id = `link-${platform}`;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState(false);
  const check = checkPlatformLink(platform, draft);
  useEffect(() => {
    if (!pasted) return;
    const t = setTimeout(() => setPasted(false), 1400);
    return () => clearTimeout(t);
  }, [pasted]);

  if (saved) {
    return (
      <p className="note">
        We have it:{' '}
        <a href={saved} target="_blank" rel="noopener noreferrer">
          {saved}
        </a>
      </p>
    );
  }

  async function paste() {
    try {
      const t = await navigator.clipboard?.readText?.();
      if (t) {
        setDraft(t.trim());
        setError(null);
        setPasted(true);
        return;
      }
    } catch {
      /* permission denied: let them paste by hand */
    }
    document.getElementById(id)?.focus();
  }

  async function send() {
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliver/${encodeURIComponent(token)}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, platform, url: check.url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 409
            ? "We already have this link. Text us if it's wrong."
            : body?.error ?? 'Something went wrong. Please try again.'
        );
        return;
      }
      if (body?.posts) onSaved(body as DeliverView);
    } catch {
      setError('Could not reach us. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <label className="flabel" htmlFor={id}>
        {label}
      </label>
      <div className="linkfield">
        <input
          type="url"
          id={id}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && check.ok && !sending) send();
          }}
        />
        <button type="button" className="btn ghost small" onClick={paste}>
          {pasted ? 'Pasted' : 'Paste'}
        </button>
      </div>
      <p className="note">{helper}</p>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn primary" disabled={!check.ok || sending} onClick={send}>
        {sending ? 'Saving…' : buttonLabel}
      </button>
    </>
  );
}

// ---- the Story screenshot (step 4) -----------------------------------------

/**
 * Shrink a screenshot before sending it. Vercel refuses request bodies over
 * ~4.5 MB and a phone screenshot can be bigger, so anything the browser can
 * decode is redrawn as a JPEG, longest side 2000px. If it can't be decoded
 * here (e.g. HEIC on a desktop browser) the original goes as-is and the
 * server decides.
 */
async function shrinkScreenshot(file: File): Promise<File> {
  if (file.size < 900 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
      if (!blob) return file;
      return new File([blob], (file.name || 'story').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return file;
  }
}

function StoryUpload({
  token,
  postId,
  saved,
  onSaved,
}: {
  token: string;
  postId: string;
  saved: string | undefined;
  onSaved: (view: DeliverView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (saved) {
    return (
      <div className="storysaved">
        <a href={saved} target="_blank" rel="noopener noreferrer" className="storythumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={saved} alt="Your Story screenshot" />
        </a>
        <p className="note">We have your Story screenshot.</p>
      </div>
    );
  }

  async function send() {
    if (!file) return;
    setSending(true);
    setError(null);
    try {
      const small = await shrinkScreenshot(file);
      const form = new FormData();
      form.append('postId', postId);
      form.append('file', small, small.name);
      const res = await fetch(`/api/deliver/${encodeURIComponent(token)}/story-screenshot`, {
        method: 'POST',
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 409
            ? "We already have your Story screenshot. Text us if it's wrong."
            : res.status === 400 && body?.error
              ? body.error
              : "That didn't upload. Try a smaller screenshot."
        );
        return;
      }
      if (body?.posts) onSaved(body as DeliverView);
    } catch {
      setError("That didn't upload. Try a smaller screenshot.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="flabel">Your Story screenshot</div>
      <div className={`storypick${preview ? ' has' : ''}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="The screenshot you picked" />
        ) : (
          <span className="note">No screenshot yet</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setError(null);
          setFile(f);
          setPreview((old) => {
            if (old) URL.revokeObjectURL(old);
            return f ? URL.createObjectURL(f) : null;
          });
        }}
      />
      <button type="button" className="btn ghost" onClick={() => inputRef.current?.click()}>
        {file ? 'Choose a different screenshot' : 'Choose screenshot'}
      </button>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn primary" disabled={!file || sending} onClick={send}>
        {sending ? 'Sending…' : 'Send screenshot'}
      </button>
    </>
  );
}

// ---- taps for the new platforms --------------------------------------------
// Instagram keeps today's taps word for word (walkthrough.json / fallback).
// `who` is already HTML-escaped.

function storyTaps(feed: boolean, who: string): string[] {
  return [
    feed ? 'Open the post you just put up.' : 'Open the Reel you just posted.',
    'Tap the <b>paper-plane</b> icon → <b>Add to story</b>.',
    `Add a <b>mention</b> sticker → <b>@${who}</b>.`,
    'Tap <b>Your story</b>.',
    'Open your Story and take a screenshot of it.',
  ];
}

function tiktokTaps(feed: boolean, who: string, photoCount: number): string[] {
  return feed
    ? [
        'Tap <b>+</b> → <b>Upload</b> → <b>Photos</b>.',
        `Pick all ${photoCount || 'your'} photos <b>in the order shown above</b> → <b>Next</b>.`,
        `Paste your caption. Type <b>@${who}</b> in it so the tag links.`,
        '<b>More options</b> → <b>Content disclosure</b> → switch on <b>Brand content</b>.',
        'Tap <b>Post</b>.',
      ]
    : [
        'Tap <b>+</b> → <b>Upload</b> → pick the video → <b>Next</b>.',
        'Tap <b>Select cover</b> → <b>Upload cover</b> → pick the cover photo.',
        `Paste your caption. Type <b>@${who}</b> in it so the tag links.`,
        '<b>More options</b> → <b>Content disclosure</b> → switch on <b>Brand content</b>.',
        'Tap <b>Post</b>.',
      ];
}

function xTaps(feed: boolean): string[] {
  return feed
    ? ['Tap <b>+</b> → attach photos <b>1–4</b>, in order.', 'Paste your caption.', 'Tap <b>Post</b>.']
    : ['Tap <b>+</b> → attach the video.', 'Paste your caption.', 'Tap <b>Post</b>.'];
}

function Taps({ items }: { items: string[] }) {
  return (
    <ol className="quick">
      {items.map((html, i) => (
        <li key={i}>
          <span className="n">{i + 1}</span>
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </li>
      ))}
    </ol>
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
  onServerView,
}: {
  view: DeliverView;
  post: DeliverPost;
  token: string;
  today: string | null;
  ticks: boolean[];
  setTick: (i: number, v: boolean) => void;
  onBack: () => void;
  onServerView: (view: DeliverView) => void;
}) {
  const { athlete, campaign, logos, posts } = view;
  const feed = isFeed(post);
  const photos = post.files.photos;
  const firstName = athlete.name.trim().split(/\s+/)[0];
  const undated = !hasDate(post);
  const days = today ? daysBetween(today, post.date) : null;
  const brand = campaign.brandName ?? 'the brand';

  // ---- walkthrough (Instagram only) ----
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
  const [showShots, setShowShots] = useState(false);
  useEffect(() => setShowShots(false), [post.postId]);

  const who = tagHtml ?? esc(brand);
  const igKey = feed ? 'instagram_feed' : 'instagram_reel';
  const igTaps = (walk?.quick_steps?.[igKey] ?? fallbackQuickSteps(igKey, who)).map(personalise);
  const shots = walk && walk.platform === igKey ? walk : null;

  // ---- step state ----
  // Steps 1–2: this browser's ticks. Steps 3–6: what the server has.
  const links = post.links ?? {};
  const story = post.storyScreenshot?.url;
  const fourIn = !!links.instagram && !!story && !!links.tiktok && !!links.x;
  const posted = post.status === 'posted' || fourIn;
  const done = [
    ticks[0] || posted,
    ticks[1] || posted,
    !!links.instagram,
    !!story,
    !!links.tiktok,
    !!links.x,
  ];
  const locked = [false, false, undated, undated, undated, undated];
  const current = done.findIndex((d, i) => !d && !locked[i]);
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

  /** Open the next step that still needs doing after step i (i is now done). */
  const openAfter = (i: number, doneNow: boolean[]) => {
    const nxt = doneNow.findIndex((d, j) => j > i && !d && !locked[j]);
    const any = nxt >= 0 ? nxt : doneNow.findIndex((d, j) => !d && !locked[j]);
    setOpen(any >= 0 ? any : null);
  };
  /** Steps 1–2: tick in this browser, then move on. */
  const advance = (i: number) => {
    setTick(i, true);
    openAfter(i, done.map((d, j) => (j === i ? true : d)));
  };
  /** Steps 3–6: the server answered; take its view, then move on. */
  const serverSaved = (i: number) => (next: DeliverView) => {
    onServerView(next);
    const p = next.posts.find((x) => x.postId === post.postId);
    const l = p?.links ?? {};
    const doneNow = [done[0], done[1], !!l.instagram, !!p?.storyScreenshot, !!l.tiktok, !!l.x];
    doneNow[i] = true;
    openAfter(i, doneNow);
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

  // ---- the next post, for the finished card ----
  const nextPost = posts.find((p) => p.postId !== post.postId && !isPosted(p)) ?? null;
  const nextLine = nextPost
    ? hasDate(nextPost)
      ? `Next up: your ${shortLabel(nextPost)}. It goes up ${nextPost.dateLabel}.`
      : `Next up: your ${shortLabel(nextPost)}. We'll text you its date.`
    : "That's everything for now.";

  // ---- step lines ----
  const DONE_LINES = [
    feed ? 'Photos saved' : 'Video and cover saved',
    'Caption copied',
    feed ? 'Post up · link saved' : 'Reel posted · link saved',
    'Story screenshot sent',
    'TikTok posted · link saved',
    'X post up · link saved',
  ];
  const TODO_LINES = [
    feed ? (photos.length ? `${photos.length} photos` : 'Photos on their way') : 'Video + cover photo',
    'Same caption everywhere',
    feed ? 'Carousel + link' : 'Reel + link',
    'Share + send a screenshot',
    feed ? 'Same photos + link' : 'Same video + link',
    feed ? 'Photos 1–4 + link' : 'Same video + link',
  ];
  const lines: (string | null)[] = TODO_LINES.map((todo, i) => {
    const st = stateOf(i);
    if (st === 'done') return DONE_LINES[i];
    if (st === 'locked') return 'Opens once your date is set';
    if (i === 0 && feed && photos.length) return 'A carousel: post them together, in this order';
    if (st === 'current') return null;
    return todo;
  });

  const toggle = (i: number) => {
    if (locked[i] && !done[i]) return;
    setOpen(open === i ? null : i);
  };
  const stepName = (i: number) => (i === 0 && feed ? 'Save your photos' : STEP_NAMES[i]);
  const xPhotos = photos.slice(0, 4);

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

      <div className="places4">
        <div className="pchips" aria-label="Where it goes">
          {['Instagram', 'Story', 'TikTok', 'X'].map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <p className="note">{feed ? 'One post' : 'One video'}, four places, all the same day.</p>
      </div>

      {fourIn ? (
        <div className="finished" role="status">
          <div className="t">
            <span className="tick">{CHECK}</span>
            All 4 are up. Thanks, {firstName}.
          </div>
          <p>We got your Instagram, TikTok and X links and your Story screenshot. {nextLine}</p>
        </div>
      ) : (
        <div className="progress">
          <div className="prow-l">
            <b>{current >= 0 ? `Step ${current + 1} of ${TASK_COUNT}` : `${doneCount} of ${TASK_COUNT} done`}</b>
            <span>{current < 0 ? 'Waiting for your date' : stepName(current)}</span>
          </div>
          <div className="segs six" aria-hidden="true">
            {done.map((d, i) => (
              <span key={i} className={d ? 'done' : i === current ? 'current' : ''} />
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
                <span>Waiting on {brand}&apos;s approval. They appear here on their own.</span>
              </div>
            )
          ) : (
            <div className="tiles">
              <div className="tile">
                {videoSlot ? (
                  // The cover as poster, so the tile isn't a black box while
                  // the (large) video loads.
                  <video
                    className="media"
                    src={videoSlot}
                    poster={coverSlot ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="onway">
                    <b>On its way.</b>
                    <span>Waiting on {brand}&apos;s approval.</span>
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
                    <span>Waiting on {brand}&apos;s approval.</span>
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
          {caption && (
            <p className="note">
              Use this same caption on Instagram, TikTok and X.
              {captionHasTag ? ' The tag and hashtag are already in it.' : ''}
            </p>
          )}
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

        {/* ---- 3 · Instagram ---- */}
        <StepRow
          n={3}
          title="Post it on Instagram"
          line={lines[2]}
          state={stateOf(2)}
          open={open === 2}
          onToggle={() => toggle(2)}
        >
          <Taps items={igTaps} />
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
                <ShotViewer
                  walk={shots}
                  base={walkBase}
                  personalise={personalise}
                  storageKey={`pg-deliver:${token}:${post.postId}:shot`}
                  onClose={() => setShowShots(false)}
                />
              )}
            </>
          ) : (
            <p className="note">Screenshots coming.</p>
          )}
          <LinkField
            token={token}
            postId={post.postId}
            platform="instagram"
            label={`Your ${shortLabel(post)}'s link`}
            placeholder={feed ? 'instagram.com/p/…' : 'instagram.com/reel/…'}
            helper={
              <>
                Tap <b>···</b> on your {feed ? 'post' : 'Reel'} → <b>Copy link</b>.
              </>
            }
            buttonLabel="Save link & keep going"
            saved={links.instagram}
            onSaved={serverSaved(2)}
          />
        </StepRow>

        {/* ---- 4 · Story ---- */}
        <StepRow
          n={4}
          title="Share it to your Story"
          line={lines[3]}
          state={stateOf(3)}
          open={open === 3}
          onToggle={() => toggle(3)}
        >
          <p className="note">Now put the same {feed ? 'post' : 'Reel'} on your Story.</p>
          <Taps items={storyTaps(feed, who)} />
          <p className="note">Stories disappear after a day, so a screenshot is how we show {brand} it went up.</p>
          <StoryUpload token={token} postId={post.postId} saved={story} onSaved={serverSaved(3)} />
        </StepRow>

        {/* ---- 5 · TikTok ---- */}
        <StepRow
          n={5}
          title="Post it on TikTok"
          line={lines[4]}
          state={stateOf(4)}
          open={open === 4}
          onToggle={() => toggle(4)}
        >
          <p className="note">Same {feed ? 'photos' : 'video'}, same caption, on TikTok.</p>
          <Taps items={tiktokTaps(feed, who, photos.length)} />
          <div className="dontskip">
            <div className="t">Don&apos;t skip</div>
            <p>Turn on Content disclosure → Brand content.</p>
          </div>
          <p className="note">Screenshots for TikTok are coming.</p>
          <LinkField
            token={token}
            postId={post.postId}
            platform="tiktok"
            label="Your TikTok's link"
            placeholder={feed ? 'tiktok.com/@you/photo/…' : 'tiktok.com/@you/video/…'}
            helper={
              <>
                On TikTok, tap <b>Share</b> → <b>Copy link</b>.
              </>
            }
            buttonLabel="Save link & keep going"
            saved={links.tiktok}
            onSaved={serverSaved(4)}
          />
        </StepRow>

        {/* ---- 6 · X ---- */}
        <StepRow
          n={6}
          title="Post it on X"
          line={lines[5]}
          state={stateOf(5)}
          open={open === 5}
          onToggle={() => toggle(5)}
        >
          <p className="note">Last one: post it on X.</p>
          <Taps items={xTaps(feed)} />
          {feed && xPhotos.length > 0 && (
            <>
              <div className="xrow">
                {xPhotos.map((p, i) => (
                  <figure className="pcell" key={`x-${p.position}-${p.url}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1}`} />
                    <span className="pnumber">{i + 1}</span>
                  </figure>
                ))}
              </div>
              {photos.length >= 5 && <p className="note">X allows 4 photos. Use photos 1–4.</p>}
            </>
          )}
          <LinkField
            token={token}
            postId={post.postId}
            platform="x"
            label="Your X post's link"
            placeholder="x.com/you/status/…"
            helper={
              <>
                Tap the <b>share</b> icon on your post → <b>Copy link</b>.
              </>
            }
            buttonLabel="Send your links"
            saved={links.x}
            onSaved={serverSaved(5)}
          />
        </StepRow>
      </div>

      <HelpBox />
    </>
  );
}

// ============================================================
// The page
// ============================================================

export default function DeliverPage({ token, view: initialView }: { token: string; view: DeliverView }) {
  // The server's view. Every link / screenshot save answers with a fresh one,
  // so steps 3–6 always show what the server actually has.
  const [view, setView] = useState<DeliverView>(initialView);
  const { logos, campaign } = view;
  const [openId, setOpenId] = useState<string | null>(null);
  const [allTicks, setAllTicks] = useState<Record<string, boolean[]>>({});
  // The athlete's own calendar day — only known in the browser.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localToday()), []);

  // Ticks are per post and live only in this browser. Keys unchanged; only
  // steps 1–2 read them now (3–6 come from the server).
  const keyFor = useCallback((postId: string) => `pg-deliver:${token}:${postId}`, [token]);
  useEffect(() => {
    const next: Record<string, boolean[]> = {};
    for (const p of initialView.posts) next[p.postId] = readTicks(keyFor(p.postId));
    setAllTicks(next);
  }, [initialView.posts, keyFor]);

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

  const posts = view.posts;
  // Same rule as the API's activePostId, re-run so a post completed on this
  // page moves the home screen on to the next one.
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
            view={view}
            post={post}
            token={token}
            today={today}
            ticks={ticksFor(post.postId)}
            setTick={(i, v) => setTick(post.postId, i, v)}
            onBack={() => setOpenId(null)}
            onServerView={setView}
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
            <Home view={view} activeId={activeId} today={today} onOpen={setOpenId} />
          </>
        )}
      </main>
    </div>
  );
}
