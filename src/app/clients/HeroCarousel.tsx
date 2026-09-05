'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import type { FeaturedFilm } from '@/lib/data/clients-page';

/**
 * The page's opening system: a full-bleed hero and a row of portrait cards that
 * are ONE mechanism, not two stacked components.
 *
 * `order` is the row queue — all nineteen brands, rotating leftward. When a
 * card has travelled one full step it has left the row, and if that brand has
 * a film it takes the hero. The twelve stills-only brands ride the same queue
 * and render an identical card, but they cannot take the hero: a frozen photo
 * where every other hero plays reads as a video that failed to load. They link
 * to their detail page instead.
 *
 * The hero is therefore SEPARATE state rather than order[0]. That is the whole
 * design: one queue, two outcomes on exit.
 */

/** Row drift. One card leaves roughly every 8s at the current step. */
const PX_PER_SECOND = 26;
/** Arrow transitions. */
const STEP_DURATION = 0.62;
/**
 * How far the edge fade reaches, in px. At 96 the outermost card was still
 * ~40% opaque where the container clipped it, so it read as sliced rather than
 * entering. This is wider than one card, so a card is fully gone before the
 * cut.
 */
const EDGE_FADE = 210;

// ---- hero layer ---------------------------------------------------------

/**
 * One hero layer. Two are stacked and crossfaded, so a hero change never shows
 * a black frame or a hard cut between two films.
 */
function HeroLayer({
  film,
  active,
  reduced,
}: {
  film: FeaturedFilm;
  active: boolean;
  reduced: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Autoplay returns a promise that rejects on power saving, a background tab
  // or an OS setting. The poster underneath already covers the failure, so the
  // rejection is swallowed rather than surfacing as a console error.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduced) return;
    if (active) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      v.pause();
    }
  }, [active, reduced]);

  return (
    <div
      className="absolute inset-0 transition-opacity duration-[900ms] ease-out"
      style={{ opacity: active ? 1 : 0 }}
      aria-hidden
    >
      <img
        src={film.poster ?? film.still}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {film.clip && !reduced && (
        <video
          ref={videoRef}
          key={film.slug}
          src={film.clip}
          poster={film.poster ?? undefined}
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

// ---- arrows -------------------------------------------------------------

function Arrow({
  dir,
  onClick,
  label,
}: {
  dir: 'prev' | 'next';
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-14 w-14 place-items-center rounded-full border border-white/45 bg-black/45 text-ink shadow-[0_4px_18px_rgba(7,7,10,0.6)] backdrop-blur-md transition-colors duration-200 hover:border-white/70 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden
      >
        <path d={dir === 'next' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
      </svg>
    </button>
  );
}

// ---- the system ---------------------------------------------------------

export default function HeroCarousel({ films }: { films: FeaturedFilm[] }) {
  const N = films.length;
  const [order, setOrder] = useState<number[]>(() => films.map((_, i) => i));
  const [reduced, setReduced] = useState(false);

  // Indices of the brands that may take the hero, in row order.
  const promotable = useMemo(
    () => films.map((f, i) => (f.canPromote ? i : -1)).filter((i) => i >= 0),
    [films]
  );
  const [heroIdx, setHeroIdx] = useState(() => promotable[0] ?? 0);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const stepRef = useRef(0);
  const paused = useRef(false);
  const animating = useRef(false);
  const releaseTimer = useRef<number | null>(null);
  const stepTween = useRef<gsap.core.Tween | null>(null);
  // Mirrors `order` so the ticker can read the exiting card without doing side
  // effects inside a state updater — React may invoke an updater twice.
  const orderRef = useRef(order);

  /** Single writer for the queue: ref first, then state. */
  const commitOrder = useCallback((next: number[]) => {
    orderRef.current = next;
    setOrder(next);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const apply = useCallback(() => {
    const el = trackRef.current;
    if (el) el.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
  }, []);

  // Measure one step from the real DOM: the card width is a clamp and the gap
  // changes at the sm breakpoint, so the Tailwind values are not the truth.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const a = el.children[0] as HTMLElement | undefined;
      const b = el.children[1] as HTMLElement | undefined;
      if (!a) return;
      stepRef.current = b ? b.offsetLeft - a.offsetLeft : a.offsetWidth;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-apply the transform after every commit that changes `order`. Doing it
  // here rather than in the ticker is what keeps rotation seamless: the DOM
  // reorder and the compensating -1 step land in the same paint.
  useLayoutEffect(apply, [order, apply]);

  // Continuous drift, off gsap.ticker so the page runs one rAF loop shared
  // with Lenis rather than two competing for the same frame.
  useEffect(() => {
    if (reduced || N < 2) return;

    const drift = (_t: number, deltaMs: number) => {
      if (paused.current || animating.current) return;
      const step = stepRef.current;
      if (!step) return;
      offsetRef.current += (PX_PER_SECOND * deltaMs) / 1000;
      if (offsetRef.current >= step) {
        offsetRef.current -= step;
        const cur = orderRef.current;
        if (cur.length >= 2) {
          const exited = cur[0];
          // Only a brand with a film takes the hero. A stills-only card just
          // rejoins the back of the queue and the hero keeps playing.
          if (films[exited]?.canPromote) setHeroIdx(exited);
          commitOrder([...cur.slice(1), exited]);
        }
        return;
      }
      apply();
    };

    gsap.ticker.add(drift);
    return () => {
      gsap.ticker.remove(drift);
    };
  }, [reduced, N, apply, films, commitOrder]);

  const holdBriefly = useCallback(() => {
    if (releaseTimer.current) window.clearTimeout(releaseTimer.current);
    paused.current = true;
    releaseTimer.current = window.setTimeout(() => {
      paused.current = false;
    }, 2600);
  }, []);

  useEffect(
    () => () => {
      if (releaseTimer.current) window.clearTimeout(releaseTimer.current);
      stepTween.current?.kill();
    },
    []
  );

  /**
   * Make `target` the hero and move it to the back of the queue, as though it
   * had just drifted out of the row. Keeping those two in step is what stops
   * the arrows from feeling like a separate control from the row.
   */
  const setHeroAndRequeue = useCallback(
    (target: number) => {
      setHeroIdx(target);
      const o = orderRef.current;
      const at = o.indexOf(target);
      if (at >= 0) commitOrder([...o.slice(at + 1), ...o.slice(0, at + 1)]);
      offsetRef.current = 0;
    },
    [commitOrder]
  );

  /** Step the hero through the film brands only. */
  const stepHero = useCallback(
    (delta: 1 | -1) => {
      if (promotable.length < 2) return;
      const at = promotable.indexOf(heroIdx);
      const next =
        promotable[(at + delta + promotable.length) % promotable.length];
      stepTween.current?.kill();
      stepTween.current = null;
      animating.current = false;
      holdBriefly();
      setHeroAndRequeue(next);
    },
    [promotable, heroIdx, holdBriefly, setHeroAndRequeue]
  );

  const goNext = useCallback(() => stepHero(1), [stepHero]);
  const goPrev = useCallback(() => stepHero(-1), [stepHero]);

  /** Clicking a film card promotes it immediately. */
  const promote = useCallback(
    (filmIdx: number) => {
      if (!films[filmIdx]?.canPromote) return;
      stepTween.current?.kill();
      stepTween.current = null;
      animating.current = false;
      holdBriefly();
      setHeroAndRequeue(filmIdx);
    },
    [films, holdBriefly, setHeroAndRequeue]
  );

  const hero = films[heroIdx];

  // Two hero layers, crossfaded. One functional update so the flip never reads
  // a stale active slot.
  const [pair, setPair] = useState({ a: heroIdx, b: heroIdx, active: 'a' as 'a' | 'b' });
  useEffect(() => {
    setPair((p) => {
      const current = p.active === 'a' ? p.a : p.b;
      if (current === heroIdx) return p;
      return p.active === 'a'
        ? { ...p, b: heroIdx, active: 'b' }
        : { ...p, a: heroIdx, active: 'a' };
    });
  }, [heroIdx]);

  if (!hero) return null;

  return (
    <section aria-label="Brand campaigns" className="relative w-full">
      {/* ---- hero ---- */}
      <div className="relative h-[78svh] min-h-[520px] w-full overflow-hidden bg-surface">
        <HeroLayer film={films[pair.a]} active={pair.active === 'a'} reduced={reduced} />
        <HeroLayer film={films[pair.b]} active={pair.active === 'b'} reduced={reduced} />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(7,7,10,0.88) 0%, rgba(7,7,10,0.68) 32%, rgba(7,7,10,0.26) 62%, rgba(7,7,10,0.12) 100%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(7,7,10,0.94) 0%, rgba(7,7,10,0.40) 24%, rgba(7,7,10,0) 52%)',
          }}
          aria-hidden
        />

        {/* The hero's mark is a marker, not a statement — the card carries the
            big one. Top-right, clear of the arrows, which sit at mid-height. */}
        {hero.photoLogo && (
          <div
            className="pointer-events-none absolute right-6 z-[6] sm:right-10"
            style={{ top: 'calc(var(--nav-h) + 28px)' }}
            aria-hidden
          >
            <img
              src={hero.photoLogo}
              alt=""
              className="h-7 w-auto max-w-[132px] object-contain opacity-80 sm:h-8"
              style={{ filter: 'drop-shadow(0 1px 6px rgba(7,7,10,0.85))' }}
            />
          </div>
        )}

        <div className="absolute inset-0 flex items-center pt-[var(--nav-h)]">
          <div className="mx-auto flex w-full max-w-[1400px] items-center gap-8 px-6 pb-[20vh] sm:px-10">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">
                Our Partners
              </p>
              <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(38px,5.4vw,86px)] leading-[0.9] tracking-tight text-ink">
                The brands behind the biggest campaigns
              </h1>
              <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink/70">
                More than 60,000 college athletes have created content for our partners
                since 2021.
                <br />
                We build campaigns end to end — casting the athletes, producing the
                content and running it to post.
              </p>
            </div>

            <div className="hidden shrink-0 flex-col gap-3 sm:flex">
              <Arrow dir="prev" onClick={goPrev} label="Previous brand" />
              <Arrow dir="next" onClick={goNext} label="Next brand" />
            </div>
          </div>
        </div>
      </div>

      {/* ---- card row, overlapping the hero ---- */}
      <div
        className="relative z-10 -mt-[132px] sm:-mt-[160px]"
        onMouseEnter={() => {
          paused.current = true;
        }}
        onMouseLeave={() => {
          paused.current = false;
        }}
        onFocusCapture={() => {
          paused.current = true;
        }}
        onBlurCapture={() => {
          paused.current = false;
        }}
      >
        <div
          className="mx-auto w-full max-w-[1400px] overflow-hidden px-6 sm:px-10"
          // The leftmost card was being sliced by the container edge, type and
          // all, which read as a broken card rather than one leaving the row.
          // Fading both edges makes the row read as a window onto a longer
          // queue. Masked rather than padded so the card still travels the
          // full width instead of stopping short of it.
          style={{
            maskImage: `linear-gradient(to right, transparent 0, #000 ${EDGE_FADE}px, #000 calc(100% - ${EDGE_FADE}px), transparent 100%)`,
            WebkitMaskImage: `linear-gradient(to right, transparent 0, #000 ${EDGE_FADE}px, #000 calc(100% - ${EDGE_FADE}px), transparent 100%)`,
          }}
        >
          <div
            ref={trackRef}
            className="flex gap-4 will-change-transform"
            style={{ transform: 'translate3d(0,0,0)' }}
          >
            {order.map((filmIdx) => (
              <CardSlot
                key={films[filmIdx].slug}
                film={films[filmIdx]}
                isHero={filmIdx === heroIdx}
                onPromote={films[filmIdx].canPromote ? () => promote(filmIdx) : null}
              />
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 pt-5 sm:px-10">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink/35">
            {hero.name}
            {hero.campaignName ? ` · ${hero.campaignName}` : ''}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink/35">
            {String(promotable.indexOf(heroIdx) + 1).padStart(2, '0')} /{' '}
            {String(promotable.length).padStart(2, '0')} films · {N} brands
          </span>
        </div>
      </div>
    </section>
  );
}

// ---- one card -----------------------------------------------------------

/**
 * A still card. Identical for every brand — the only difference is what a
 * click does: a film brand takes the hero, a stills-only brand navigates to
 * its detail page. A card with neither is inert.
 */
function CardSlot({
  film,
  isHero,
  onPromote,
}: {
  film: FeaturedFilm;
  isHero: boolean;
  onPromote: (() => void) | null;
}) {
  const inner = (
    <div className="relative aspect-[3/4] w-full">
      <img
        src={film.still}
        alt=""
        aria-hidden
        loading="eager"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[4] h-px"
        style={{
          background:
            'linear-gradient(to right, rgba(250,248,245,0) 0%, rgba(250,248,245,0.30) 22%, rgba(250,248,245,0.30) 78%, rgba(250,248,245,0) 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'rgba(7,7,10,0.32)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(7,7,10,0.96) 0%, rgba(7,7,10,0.80) 18%, rgba(7,7,10,0.42) 38%, rgba(7,7,10,0) 68%)',
        }}
        aria-hidden
      />

      {/* The mark, large and centred — the card's main event.
          One clamp for every card: same max height, same max width, no
          per-brand sizing.

          Equal height is only reachable for marks the height cap actually
          binds. A 5:1 wordmark (Crocs, STATSports) hits the width cap first
          and lands shorter — matching the square marks' height would need it
          drawn 150% of the card's width. The width cap is set generously at
          84% to close that gap as far as the geometry allows. */}
      {film.photoLogo && (
        <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center pb-[16%]">
          <img
            src={film.photoLogo}
            alt=""
            aria-hidden
            style={{
              // Colour artwork over a photo needs edge separation more than a
              // white knockout did: a tight shadow for the edge, a wide one to
              // lift the whole mark off the frame.
              filter:
                'drop-shadow(0 1px 2px rgba(7,7,10,0.9)) drop-shadow(0 4px 20px rgba(7,7,10,0.7))',
            }}
            className="max-h-[22%] max-w-[84%] object-contain"
          />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-[5] px-3.5 pb-3.5 pt-6 text-left">
        <p className="font-display text-[21px] leading-none tracking-wide text-ink">
          {film.name}
        </p>
        <p className="mt-2 line-clamp-1 font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.16em] text-ink/75">
          {film.campaignName ??
            (film.campaignCount > 0
              ? `${film.campaignCount} campaign${film.campaignCount === 1 ? '' : 's'}`
              : 'Campaign work')}
        </p>
      </div>
    </div>
  );

  const shell = `relative block w-full overflow-hidden rounded-2xl bg-surface-2 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.85)] ring-1 ring-inset backdrop-blur-sm transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 ${
    isHero ? 'ring-white/45' : 'ring-white/12 hover:ring-white/28'
  }`;
  const wrap = 'group relative w-[152px] shrink-0 sm:w-[172px] lg:w-[calc((100%-5rem)/6.2)]';

  if (onPromote) {
    return (
      <div className={wrap}>
        <button
          type="button"
          onClick={onPromote}
          aria-label={`Show ${film.name} in the hero`}
          aria-current={isHero ? 'true' : undefined}
          className={shell}
        >
          {inner}
        </button>
      </div>
    );
  }

  // Stills-only: identical card, but it goes to the brand's work instead.
  if (film.href) {
    return (
      <div className={wrap}>
        <Link href={film.href} aria-label={`${film.name} — view work`} className={shell}>
          {inner}
        </Link>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <div className={shell}>{inner}</div>
    </div>
  );
}
