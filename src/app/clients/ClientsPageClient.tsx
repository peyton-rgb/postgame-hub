'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Lenis from 'lenis';
import gsap from 'gsap';
import SiteFooter from '@/components/SiteFooter';
import CampaignCarousel from './CampaignCarousel';
import {
  TILE_LOGO_SCALE_DEFAULT,
  isLightFill,
  type ClientBrand,
  type FeaturedFilm,
} from '@/lib/data/clients-page';

/**
 * Hover on a logo. GSAP's only remaining job on this page — ScrollTrigger, the
 * shear and the velocity setter went with the full-bleed bands.
 *
 * quickTo is deliberately not used: it owns one persistent tween and cannot
 * express a different duration and ease per direction, and reaching into that
 * tween silently creates no tween at all.
 */
function useLogoHover<T extends HTMLElement>() {
  const hostRef = useRef<T | null>(null);
  const logoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    const host = hostRef.current;
    const logo = logoRef.current;
    if (!host || !logo) return;

    gsap.set(logo, { transformOrigin: 'center center' });
    const enter = () =>
      gsap.to(logo, { scale: 1.06, duration: 0.34, ease: 'power3.out', overwrite: 'auto' });
    const leave = () =>
      gsap.to(logo, { scale: 1, duration: 0.26, ease: 'power2.out', overwrite: 'auto' });

    host.addEventListener('mouseenter', enter);
    host.addEventListener('mouseleave', leave);
    return () => {
      host.removeEventListener('mouseenter', enter);
      host.removeEventListener('mouseleave', leave);
      gsap.killTweensOf(logo);
    };
  }, []);

  return { hostRef, logoRef };
}

// ---- 3. Client directory: small, quiet, all of them ---------------------

function BrandTile({ brand, eager }: { brand: ClientBrand; eager: boolean }) {
  const { hostRef, logoRef } = useLogoHover<HTMLAnchorElement>();
  const fill = brand.fill ?? '#07070A';
  const hoverLogo = isLightFill(fill)
    ? brand.logoOnLight ?? brand.logoOnDark
    : brand.logoOnDark ?? brand.logoOnLight;
  const restLogo = brand.restLogoReads ? brand.logoOnLight ?? brand.logoOnDark : null;
  const same = restLogo === hoverLogo;
  const loading = eager ? 'eager' : 'lazy';
  // Per-brand box height, so every mark carries comparable ink area. A single
  // max-height cannot do this: aspect ratios here run 0.75:1 to 8.79:1 and
  // several files are mostly transparent padding.
  const boxH = `${((brand.tileLogoScale ?? TILE_LOGO_SCALE_DEFAULT) * 100).toFixed(1)}%`;

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
            ref={(el) => {
              logoRef.current = el;
            }}
            src={restLogo}
            alt={brand.name}
            loading={loading}
            fetchPriority={eager ? 'high' : undefined}
            style={{ height: boxH }}
            className={`relative z-[3] w-auto max-w-[86%] object-contain transition-opacity duration-200 ease-out ${
              same ? '' : 'group-hover:opacity-0 group-focus-visible:opacity-0'
            }`}
          />
          {!same && hoverLogo && (
            <img
              src={hoverLogo}
              alt=""
              aria-hidden
              loading={loading}
              style={{ height: boxH }}
              className="absolute inset-0 z-[3] m-auto w-auto max-w-[86%] object-contain opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          )}
        </>
      ) : (
        <span
          ref={(el) => {
            logoRef.current = el;
          }}
          className="relative z-[3] px-2 text-center font-display text-[13px] leading-tight tracking-wide text-surface transition-colors duration-200 group-hover:text-ink"
        >
          {brand.name}
        </span>
      )}
    </>
  );

  const cls =
    'group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-ink/10 bg-[#FAF8F5] p-3 transition-colors duration-200';

  return brand.href ? (
    <Link ref={hostRef} href={brand.href} className={cls} aria-label={brand.name}>
      {inner}
    </Link>
  ) : (
    <div className={cls} title={`${brand.name} — no detail page`}>
      {inner}
    </div>
  );
}

// ---- page ---------------------------------------------------------------

export default function ClientsPageClient({
  films,
  tiles,
}: {
  films: FeaturedFilm[];
  tiles: ClientBrand[];
}) {
  // Lenis only. Nothing on this page is bound to scroll position any more, so
  // there is no ScrollTrigger, no shear and no velocity setter to drive.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    const ticker = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(ticker);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="w-full">
        {/* 1. Brand campaign carousel — the page's opening element. */}
        <CampaignCarousel films={films} />

        {/* 2. Intro + stats */}
        <section className="mx-auto w-full max-w-[1400px] px-6 pb-[3vh] pt-[6vh] sm:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">Our Partners</p>
          <h1 className="mt-4 max-w-[21ch] font-display text-[clamp(38px,5.2vw,80px)] leading-[0.92] tracking-tight text-ink">
            The brands behind the biggest campaigns
          </h1>

          <div className="mt-[5vh] grid gap-x-[6vw] gap-y-10 border-t border-ink/15 pt-8 lg:grid-cols-12">
            <p className="max-w-[68ch] text-[15px] leading-relaxed text-ink/60 lg:col-span-7">
              Postgame has connected iconic brands with over 50,000 college athletes since
              2021. adidas, Hollister, Armani, Gillette, Allstate, Crocs, McDonald&rsquo;s and
              CVS have all run campaigns through us. We build them end to end — casting the
              athletes, producing the content and running the campaign to post.
            </p>

            <dl className="grid grid-cols-3 gap-x-6 lg:col-span-5">
              {[
                { n: `${tiles.length}`, l: 'Brand partners' },
                { n: '50,000+', l: 'College athletes' },
                { n: '2021', l: 'Running NIL since' },
              ].map((s) => (
                <div key={s.l} className="min-w-0">
                  <dt className="font-display text-[clamp(24px,2.6vw,42px)] leading-none tracking-tight text-ink">
                    {s.n}
                  </dt>
                  <dd className="mt-2.5 font-mono text-[9px] uppercase leading-snug tracking-[0.2em] text-ink/40">
                    {s.l}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 3. The directory — every client, small and quiet */}
        <section className="mx-auto w-full max-w-[1400px] px-6 pb-[7vh] pt-[4vh] sm:px-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/40">
            Some of our clients
          </h2>
          <p className="mt-2 font-display text-[clamp(24px,2.6vw,38px)] leading-none tracking-tight text-ink">
            {tiles.length} brands
          </p>
          <div className="mt-[3vh] grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
            {tiles.map((brand, i) => (
              <BrandTile key={brand.slug} brand={brand} eager={i < 16} />
            ))}
          </div>
        </section>

        {/* 5. CTA */}
        <section className="mx-auto w-full max-w-[1400px] border-t border-ink/15 px-6 py-[12vh] sm:px-10">
          <h2 className="max-w-[14ch] font-display text-[clamp(32px,5vw,72px)] leading-[0.92] tracking-tight text-ink">
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

      <SiteFooter />
    </div>
  );
}
