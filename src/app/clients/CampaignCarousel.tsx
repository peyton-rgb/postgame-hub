'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FeaturedFilm } from '@/lib/data/clients-page';

/**
 * Brand campaign carousel — the page's opening element.
 *
 * A horizontal row of 3:4 portrait cards that bleeds off both viewport edges,
 * so partial cards show at each side and the row reads as scrollable rather
 * than as a contained slider. It is a real scroll container: dragging, wheel
 * and touch all work, and the auto-advance is just a scripted scroll on top of
 * that rather than a separate transform track.
 *
 * The caption sits BELOW the card, outside the image — brand in Bebas, the
 * campaign line in mono, both from the same brand_campaigns data the film
 * cards use.
 */
export default function CampaignCarousel({ films }: { films: FeaturedFilm[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const paused = useRef(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const scrollToIndex = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.children[i] as HTMLElement | undefined;
    if (!card) return;
    // Aim to centre, then clamp into the scrollable range. Clamping is what
    // keeps the row full at both ends instead of scrolling past the content.
    const ideal = card.offsetLeft - (el.clientWidth - card.clientWidth) / 2;
    const max = el.scrollWidth - el.clientWidth;
    const left = Math.max(0, Math.min(ideal, max));
    el.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
  }, [reduced]);

  // Auto-advance. Disabled entirely under reduced motion — not slowed, off.
  useEffect(() => {
    if (reduced || films.length < 2) return;
    const id = window.setInterval(() => {
      if (paused.current) return;
      setActive((prev) => {
        const el = scrollerRef.current;
        const atEnd =
          el != null && el.scrollLeft >= el.scrollWidth - el.clientWidth - 4;
        const next = atEnd ? 0 : (prev + 1) % films.length;
        scrollToIndex(next);
        return next;
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [reduced, films.length, scrollToIndex]);

  // Keep `active` honest when the reader scrolls or drags by hand.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const centre = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        [...el.children].forEach((c, i) => {
          const card = c as HTMLElement;
          const cc = card.offsetLeft + card.clientWidth / 2;
          const dist = Math.abs(cc - centre);
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });
        setActive(best);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const hold = () => {
    paused.current = true;
  };
  const release = () => {
    paused.current = false;
  };

  return (
    <section
      aria-label="Brand campaigns"
      className="w-full pt-[64px]"
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocusCapture={hold}
      onBlurCapture={release}
    >
      <div
        ref={scrollerRef}
        // The row bleeds off both edges. Padding is a normal page gutter, not
        // half a viewport: centring the first card would leave ~680px of dead
        // space on the left and the row would read as a contained slider.
        className="flex snap-x gap-4 overflow-x-auto scroll-smooth px-6 pb-2 sm:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {films.map((film, i) => {
          const isActive = i === active;
          const card = (
            <>
              <div
                className={`relative overflow-hidden rounded-2xl bg-surface-2 transition-transform duration-500 ease-out ${
                  isActive ? 'scale-100' : 'scale-[0.94]'
                }`}
              >
                <div className="relative aspect-[3/4] w-full">
                  <img
                    src={film.still}
                    alt=""
                    aria-hidden
                    // Six cards are visible on a wide screen, so the first five
                    // load eagerly — lazy ones inside the initial viewport show
                    // as empty cards on first paint.
                    loading={i < 5 ? 'eager' : 'lazy'}
                    fetchPriority={i < 2 ? 'high' : undefined}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {/* Soft scrim under the top-left mark only, so the logo always
                      reads without dimming the whole photograph. */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
                    style={{
                      background:
                        'linear-gradient(to bottom, rgba(7,7,10,0.62) 0%, rgba(7,7,10,0.28) 45%, rgba(7,7,10,0) 100%)',
                    }}
                  />
                  {/* logoBand, not logoOnDark: it is the pick that requires real
                      transparency. brightness(0) invert on a plate produces a
                      solid white rectangle, which is exactly what appeared here. */}
                  {film.logoBand && (
                    <img
                      src={film.logoBand}
                      alt=""
                      aria-hidden
                      className="absolute left-4 top-4 h-6 w-auto max-w-[45%] object-contain"
                      style={{ filter: 'brightness(0) invert(1)' }}
                    />
                  )}
                </div>
              </div>

              {/* Caption sits below the card, outside the image. */}
              <div className="px-1 pt-4">
                <p className="font-display text-[20px] leading-none tracking-wide text-ink">
                  {film.name}
                </p>
                <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-ink/45">
                  <span className="line-clamp-1 block">
                    {film.campaignCount > 0
                    ? `${film.campaignCount} campaign${film.campaignCount === 1 ? '' : 's'}`
                      : 'Campaign work'}
                    {film.campaignName ? ` · ${film.campaignName}` : ''}
                  </span>
                </p>
              </div>
            </>
          );

          const cls =
            'w-[min(74vw,304px)] shrink-0 snap-center outline-none focus-visible:ring-2 focus-visible:ring-brand/70 rounded-2xl';

          return film.href ? (
            <Link key={film.slug} href={film.href} className={cls} aria-label={film.name}>
              {card}
            </Link>
          ) : (
            <div key={film.slug} className={cls}>
              {card}
            </div>
          );
        })}
      </div>

      {/* Position, as type rather than dots. */}
      <div className="mx-auto flex w-full max-w-[1400px] justify-between px-6 pt-5 sm:px-10">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink/35">
          Campaign work
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink/35">
          {String(active + 1).padStart(2, '0')} / {String(films.length).padStart(2, '0')}
        </span>
      </div>
    </section>
  );
}
