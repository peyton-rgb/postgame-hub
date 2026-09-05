'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
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

  // Continuous drift rather than a step every five seconds. A scripted
  // scrollTo per card reads as a jump however it is eased; advancing a couple
  // of pixels per frame reads as motion. Driven off gsap.ticker, which Lenis
  // already runs, so there is one rAF loop on the page rather than two
  // competing for the same frame.
  useEffect(() => {
    if (reduced || films.length < 2) return;
    const el = scrollerRef.current;
    if (!el) return;

    const PX_PER_SECOND = 22;
    let carry = 0;

    const drift = (_t: number, deltaMs: number) => {
      if (paused.current) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      carry += (PX_PER_SECOND * deltaMs) / 1000;
      const step = Math.floor(carry);
      if (step < 1) return;
      carry -= step;
      // Wrap at the end rather than bouncing: the row reads as a loop.
      el.scrollLeft = el.scrollLeft >= max - 1 ? 0 : el.scrollLeft + step;
    };

    gsap.ticker.add(drift);
    return () => {
      gsap.ticker.remove(drift);
    };
  }, [reduced, films.length]);

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
  // A drag should stop the drift for a beat after release, not fight it.
  const holdBriefly = () => {
    paused.current = true;
    window.setTimeout(() => {
      paused.current = false;
    }, 1600);
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
        // Lenis hijacks wheel events globally; without this it swallows the
        // horizontal gesture and the row feels stuck. data-lenis-prevent hands
        // this container back to native scrolling, which is also what makes
        // drag and momentum feel right.
        data-lenis-prevent
        onPointerDown={hold}
        onPointerUp={holdBriefly}
        onTouchStart={hold}
        onTouchEnd={holdBriefly}
        // The row bleeds off both edges. Padding is a normal page gutter, not
        // half a viewport: centring the first card would leave ~680px of dead
        // space on the left and the row would read as a contained slider.
        className="flex gap-4 overflow-x-auto px-6 pb-2 sm:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {films.map((film, i) => {
          const isActive = i === active;
          const card = (
            <>
              {/* Glass: a surface layer over the photo, a hairline catching the
                  top edge, a soft shadow beneath, and blur only at the very
                  edge where the card meets the page. Depth, not a bevel. */}
              <div
                className={`relative overflow-hidden rounded-2xl bg-surface-2 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/10 backdrop-blur-sm transition-all duration-500 ease-out ${
                  isActive
                    ? 'scale-100 ring-white/16 shadow-[0_26px_56px_-18px_rgba(0,0,0,0.9)]'
                    : 'scale-[0.955]'
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
                  {/* Hairline light catching the top edge of the glass. */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[4] h-px"
                    style={{
                      background:
                        'linear-gradient(to right, rgba(250,248,245,0) 0%, rgba(250,248,245,0.30) 22%, rgba(250,248,245,0.30) 78%, rgba(250,248,245,0) 100%)',
                    }}
                  />
                  {/* Scrim, strengthened for full-colour marks: colour holds far
                      less well over moving footage than a white knockout. */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(ellipse 66% 52% at 50% 50%, rgba(7,7,10,0.70) 0%, rgba(7,7,10,0.46) 55%, rgba(7,7,10,0.16) 100%)',
                    }}
                  />
                  {/* Knock out only when the file is dark-ink artwork. Crocs'
                      badge mark silhouetted into a plain white disc. */}
                  {film.photoLogo && (
                    <img
                      src={film.photoLogo}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 m-auto h-auto max-h-[26%] w-auto max-w-[68%] object-contain"
                      // Rendered in its own colours. The shadow is edge
                      // separation, not decoration — colour artwork needs it
                      // against a moving frame far more than a knockout did.
                      style={{
                        filter:
                          'drop-shadow(0 1px 2px rgba(7,7,10,0.85)) drop-shadow(0 3px 16px rgba(7,7,10,0.6))',
                      }}
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
            'w-[min(68vw,268px)] shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand/70 rounded-2xl';

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
