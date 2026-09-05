'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  CLIPS,
  POSTERS,
  isLightFill,
  type ClientBrand,
} from '@/lib/data/clients-page';

gsap.registerPlugin(ScrollTrigger);

// The knockout and the legibility shadow are one filter chain. brightness-0 and
// invert are Tailwind *filter* utilities, so setting `filter` inline alongside
// them would replace the whole property and the mark would render in full
// colour. The shadow follows the letterforms, so unlike a background pool there
// is no shape to see on light footage.
const LOGO_FILTER =
  'brightness(0) invert(1) drop-shadow(0 2px 12px rgba(7,7,10,0.55)) drop-shadow(0 0 2px rgba(7,7,10,0.9))';

// Per-brand logo placement. A band can move its mark off-centre when the
// footage is busy where the mark would otherwise land — Allstate's logo sat
// straight over jacket embroidery.
const LOGO_PLACE: Record<string, { cls: string }> = {
  allstate: { cls: 'items-start justify-start p-[4.5vh]' },
};
const LOGO_PLACE_DEFAULT = { cls: 'items-center justify-center p-6' };
const placement = (slug: string) => LOGO_PLACE[slug] ?? LOGO_PLACE_DEFAULT;

const BAND_LOGO_VH_DEFAULT = 6.4;

/**
 * Whole-band hover: scales the band's logo only. The band itself never reacts —
 * no lift, no tilt, no shadow. quickTo is deliberately NOT used here: it owns
 * one persistent tween and cannot express a different duration and ease per
 * direction, and reaching into that tween silently creates no tween at all.
 */
function useLogoHover() {
  const stripRef = useRef<HTMLAnchorElement | null>(null);
  const logoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasHover = window.matchMedia('(hover: hover)').matches;
    if (prefersReducedMotion || !hasHover) return;

    const strip = stripRef.current;
    const logo = logoRef.current;
    if (!strip || !logo) return;

    gsap.set(logo, { transformOrigin: 'center center' });

    const onMouseEnter = () => {
      gsap.to(logo, { scale: 1.08, duration: 0.34, ease: 'power3.out', overwrite: 'auto' });
    };
    const onMouseLeave = () => {
      gsap.to(logo, { scale: 1, duration: 0.26, ease: 'power2.out', overwrite: 'auto' });
    };

    strip.addEventListener('mouseenter', onMouseEnter);
    strip.addEventListener('mouseleave', onMouseLeave);

    return () => {
      strip.removeEventListener('mouseenter', onMouseEnter);
      strip.removeEventListener('mouseleave', onMouseLeave);
      gsap.killTweensOf(logo);
    };
  }, []);

  return { stripRef, logoRef };
}

// ---- 3 + 4. Full-bleed bands -------------------------------------------

function Band({ brand, index }: { brand: ClientBrand; index: number }) {
  const clip = CLIPS[brand.slug];
  const poster = POSTERS[brand.slug];
  const { stripRef, logoRef } = useLogoHover();
  const height = `${(brand.bandLogoVh ?? BAND_LOGO_VH_DEFAULT).toFixed(2)}vh`;

  const inner = (
    <>
      {clip && (
        <div className="strip-media-layer absolute -top-[15%] left-0 w-full h-[130%] pointer-events-none will-change-transform origin-center">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={poster}
            className="w-full h-full object-cover"
          >
            <source src={clip} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-surface/50 pointer-events-none" />
        </div>
      )}

      <div
        className={`relative z-10 w-full h-full flex ${placement(brand.slug).cls} pointer-events-none`}
      >
        {brand.logoBand || brand.logoOnLight || brand.logoOnDark ? (
          <img
            ref={(el) => {
              logoRef.current = el;
            }}
            src={(brand.logoBand || brand.logoOnLight || brand.logoOnDark) as string}
            alt={brand.name}
            style={{ height, filter: LOGO_FILTER }}
            className="w-auto max-w-[26vw] object-contain pointer-events-none select-none will-change-transform"
          />
        ) : (
          <span
            ref={(el) => {
              logoRef.current = el;
            }}
            className="font-display text-[6vh] tracking-wider text-ink select-none will-change-transform"
          >
            {brand.name}
          </span>
        )}
      </div>
    </>
  );

  const className = `featured-strip relative block w-full h-[38vh] overflow-hidden ${
    clip ? 'bg-surface' : 'bg-surface-2'
  }`;
  // Height is also set inline. h-[38vh] is an arbitrary Tailwind value, and a
  // stale .next has twice served this page without a stylesheet — at which
  // point the bands fall back to auto height and the whole premise of the
  // layout goes with them. The inline value cannot be lost that way.
  const style = { height: '38vh' } as const;

  if (!brand.href) {
    return (
      <div data-strip-index={index} className={className} style={style}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      ref={stripRef}
      href={brand.href}
      data-strip-index={index}
      className={className}
      style={style}
    >
      {inner}
    </Link>
  );
}

// ---- 5. Brand tile grid -------------------------------------------------

/**
 * White at rest, brand colour on hover, logo swapping to the variant that
 * survives on the incoming ground. Ported from the clients-page-final archive.
 *
 * Tiles are the one place on this page allowed to change background — the
 * anti-card rule still governs the full-bleed bands above. Square corners, no
 * lift, no scale, no shadow.
 */
function BrandTile({ brand, eager }: { brand: ClientBrand; eager: boolean }) {
  const fill = brand.fill ?? '#07070A';
  // On a light fill, white ink disappears — keep the dark-ink file for both states.
  const hoverLogo = isLightFill(fill)
    ? brand.logoOnLight ?? brand.logoOnDark
    : brand.logoOnDark ?? brand.logoOnLight;
  // restLogoReads is false when no variant's ink survives the tile ground; the
  // named tile is correct there, not an invisible image.
  const restLogo = brand.restLogoReads ? brand.logoOnLight ?? brand.logoOnDark : null;
  const sameBothStates = restLogo === hoverLogo;
  const loading = eager ? 'eager' : 'lazy';

  const inner = (
    <>
      <div
        className="absolute inset-0 z-[1] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ backgroundColor: fill }}
        aria-hidden
      />
      {restLogo ? (
        <>
          <img
            src={restLogo}
            alt={brand.name}
            loading={loading}
            fetchPriority={eager ? 'high' : undefined}
            className={`relative z-[3] max-w-[68%] max-h-[58%] object-contain transition-opacity duration-200 ease-out ${
              sameBothStates ? '' : 'group-hover:opacity-0 group-focus-visible:opacity-0'
            }`}
          />
          {!sameBothStates && hoverLogo && (
            <img
              src={hoverLogo}
              alt=""
              aria-hidden
              loading={loading}
              className="absolute inset-[11%_13%] m-auto z-[3] max-w-[74%] max-h-[63%] object-contain opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          )}
        </>
      ) : (
        // No logo file anywhere. A named tile in the brand's own colour reads as
        // a deliberate variant; an empty white square reads as a failure.
        <span className="relative z-[3] px-3 text-center font-display text-[clamp(14px,1.5vw,22px)] leading-none tracking-wide text-surface transition-colors duration-200 group-hover:text-ink">
          {brand.name}
        </span>
      )}
    </>
  );

  const className =
    'group relative flex aspect-[3/2] items-center justify-center overflow-hidden bg-[#FAF8F5] p-4 outline outline-1 -outline-offset-[0.5px] outline-ink/10';

  if (!brand.href) {
    return (
      <div className={className} title={`${brand.name} — no detail page`}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={brand.href} className={className} aria-label={brand.name}>
      {inner}
    </Link>
  );
}

// ---- page ---------------------------------------------------------------

export default function ClientsPageClient({
  bands,
  silentBands,
  tiles,
}: {
  bands: ClientBrand[];
  silentBands: ClientBrand[];
  tiles: ClientBrand[];
}) {
  const allBands = [...bands, ...silentBands];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    lenis.on('scroll', ScrollTrigger.update);

    const ticker = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    const setMediaStretch = gsap.quickTo('.strip-media-layer', 'scaleY', {
      duration: 0.4,
      ease: 'power3.out',
    });

    lenis.on('scroll', (e: { velocity: number }) => {
      const v = Math.abs(e.velocity);
      // Clamped velocity: bounds [0, 36] mapped strictly to scaleY [1, 1.06]
      const clampedV = gsap.utils.clamp(0, 36, v);
      setMediaStretch(1 + (clampedV / 36) * 0.06);
    });

    const strips = document.querySelectorAll<HTMLElement>('.featured-strip');
    const triggers: ScrollTrigger[] = [];

    strips.forEach((strip) => {
      const mediaLayer = strip.querySelector<HTMLElement>('.strip-media-layer');
      if (!mediaLayer) return;

      const idx = parseInt(strip.getAttribute('data-strip-index') || '0', 10);
      const direction = idx % 2 === 0 ? 1 : -1;
      const magnitude = 4.5 + ((idx * 3) % 6.5); // Strictly ordered divergence within ±11%
      const shearY = direction * magnitude;

      const tween = gsap.fromTo(
        mediaLayer,
        { yPercent: -shearY },
        {
          yPercent: shearY,
          ease: 'power2.out',
          scrollTrigger: { trigger: strip, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        }
      );

      if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
    });

    return () => {
      gsap.ticker.remove(ticker);
      lenis.destroy();
      triggers.forEach((t) => t.kill());
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [bands.length, silentBands.length]);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="w-full flex flex-col">
        {/* 1. Header title card */}
        <header className="w-full bg-surface px-6 pt-[14vh] pb-[6vh] sm:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/40">
            Postgame // Client Roster
          </p>
          <h1 className="mt-4 font-display text-[clamp(52px,11vw,168px)] leading-[0.86] tracking-tight text-ink">
            Clients
          </h1>
        </header>

        {/* ====================================================================
            2. HERO BANNER — PLACEHOLDER, NOT DESIGNED
            Deliberately empty. The brief did not specify this section and it
            has not been invented. Replace this whole block; nothing below
            depends on its height or contents.
        ==================================================================== */}
        <section
          data-placeholder="hero-banner"
          aria-label="Hero banner placeholder"
          className="w-full border-y border-ink/15 bg-surface-2 px-6 py-[7vh] sm:px-10"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">
            Hero banner — not yet specified
          </p>
        </section>

        {/* 3 + 4. Full-bleed bands: seven with footage, then three without */}
        {allBands.map((brand, index) => (
          <Band key={brand.slug} brand={brand} index={index} />
        ))}

        {/* 5. Brand tile grid — the full roster */}
        <section className="w-full bg-surface px-6 py-[10vh] sm:px-10">
          <p className="mb-[4vh] font-mono text-[10px] uppercase tracking-[0.3em] text-ink/40">
            {tiles.length} Brands
          </p>
          {/* The roster rarely divides evenly by the column count, so the last
              row is usually short. The grid ground is the page ground and each
              tile draws its own hairline, so the remainder reads as unused page
              rather than as a dark hole punched in a slab of tiles. */}
          <div className="grid grid-cols-2 gap-px bg-surface sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {tiles.map((brand, i) => (
              <BrandTile key={brand.slug} brand={brand} eager={i < 12} />
            ))}
          </div>
        </section>

        {/* 6. Closing CTA */}
        <section className="w-full border-t border-ink/15 bg-surface px-6 py-[12vh] sm:px-10">
          <h2 className="max-w-[14ch] font-display text-[clamp(34px,6vw,84px)] leading-[0.92] tracking-tight text-ink">
            Put your brand in this room.
          </h2>
          <a
            href="https://www.home.pstgm.com/contactus"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-[5vh] inline-block border-b-2 border-brand pb-1 font-mono text-[11px] uppercase tracking-[0.28em] text-ink transition-colors duration-200 hover:text-brand"
          >
            Start a campaign
          </a>
        </section>
      </main>
    </div>
  );
}
