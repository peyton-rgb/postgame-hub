'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Lenis from 'lenis';
import gsap from 'gsap';
import SiteFooter from '@/components/SiteFooter';
import HeroCarousel from './HeroCarousel';
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

// ---- copy ----------------------------------------------------------------
//
// Everything below is lifted verbatim from the live site, with one exception
// marked as a draft. Nothing here is a paraphrase that strengthens a claim the
// source does not make, and no result or statistic is invented.
//
// Athlete count: the live site carries THREE different figures — 60,000
// (homepage, "created content for our partners"), 75,000+ (/about, network
// reach) and 50,000+ (the old copy on this page). 60,000 is the chosen one.

const APP_LINKS = [
  { label: 'App Store', href: 'https://apps.apple.com/us/app/postgame-app/id1541500365' },
  { label: 'Google Play', href: 'https://play.google.com/store/apps/details?id=com.pstgm.postgame' },
];

/**
 * One eyebrow treatment, so every section is labelled the same way.
 *
 * An eyebrow is a label, not a heading — where the section also carries a real
 * headline, marking both as <h2> gives the section two headings and makes the
 * outline read as twice as many sections as there are. `heading` promotes the
 * eyebrow only for the sections whose label IS their only title.
 */
function SectionLabel({
  children,
  heading = false,
}: {
  children: React.ReactNode;
  heading?: boolean;
}) {
  const cls = 'font-mono text-[10px] uppercase tracking-[0.3em] text-brand';
  return heading ? <h2 className={cls}>{children}</h2> : <p className={cls}>{children}</p>;
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
          className="relative z-[3] px-2 text-center font-display text-[15px] leading-tight tracking-wide text-ink/80 transition-colors duration-200 group-hover:text-ink"
        >
          {brand.name}
        </span>
      )}
    </>
  );

  // Dark tile, hairline border, brand colour filling on hover. 16:9 because
  // most marks are wide: at 4:3 fourteen of them hit the cell width before
  // reaching a comparable ink area, at 16:9 only four do.
  const cls =
    'group relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg border border-ink/12 bg-surface-2 p-4 transition-colors duration-200 hover:border-ink/25';

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
        {/* 1. Hero + card row — one system. The card that leaves the row
            becomes the hero; clicking a card promotes it immediately. */}
        <HeroCarousel films={films} />

        {/* 2. Who Postgame is, and how they have used athletes for these
            brands. Two paragraphs, every sentence verbatim from
            home.pstgm.com — this page is a showcase of the work, not a sales
            page, so the services, platform and results sections that used to
            sit here are gone. */}
        <section className="pg-grain w-full border-t border-ink/12 bg-surface-3">
          <div className="mx-auto w-full max-w-[1400px] px-6 pb-[9vh] pt-[9vh] sm:px-10">
          <SectionLabel heading>Who we are</SectionLabel>
          {/* Two columns rather than one 70ch measure hugging the left edge
              with the right half empty. Same two paragraphs, no new copy —
              the second one moves across instead of down. */}
          <div className="mt-6 grid gap-x-[6vw] gap-y-6 border-t border-ink/15 pt-8 md:grid-cols-2">
            <p className="max-w-[58ch] text-[16px] leading-relaxed text-ink/70">
              Postgame manages strategic partnerships between brands and college athletes for
              influencer, social and experiential campaigns. As a full-service sports marketing
              agency, we connect brands with the biggest names in sports.
            </p>
            <p className="max-w-[58ch] text-[16px] leading-relaxed text-ink/70">
              Since 2021 we&rsquo;ve been at the forefront — setting the standard, breaking
              records, and proving what&rsquo;s possible in NIL. More than 60,000 college
              athletes have created content for our partners, powering every one of the largest
              NIL campaigns in college sports history.
            </p>
          </div>
          </div>
        </section>

        {/* 3. The work — the directory. */}
        <section className="pg-grain w-full border-t border-ink/12 bg-surface">
          <div className="mx-auto w-full max-w-[1400px] px-6 pb-[9vh] pt-[8vh] sm:px-10">
            <SectionLabel>The work</SectionLabel>
            <h2 className="mt-2 font-display text-[clamp(24px,2.6vw,38px)] leading-none tracking-tight text-ink">
              {tiles.length} brands
            </h2>

            {/* The grid sits on its own slightly raised panel so 88 tiles read
                as one object on the page rather than as the page itself. */}
            <div className="mt-[3vh] rounded-2xl border border-ink/12 bg-surface-3 p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {tiles.map((brand, i) => (
                  <BrandTile key={brand.slug} brand={brand} eager={i < 12} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. ATHLETE CALLOUT — deliberately secondary: one bordered block,
            small type, no headline weight. Brands are the audience above. */}
        <section className="pg-grain w-full border-t border-ink/12 bg-surface-3 pt-[6vh]">
          <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-10">
          <div className="flex flex-col gap-5 rounded-xl border border-ink/15 bg-surface/70 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink/40">
                Athletes
              </p>
              <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-ink/60">
                Download the app — an exclusive opportunity for current college athletes to earn
                money by promoting Postgame throughout the year.
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              {APP_LINKS.map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap rounded-md border border-ink/25 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70 transition-colors duration-200 hover:border-ink/50 hover:text-ink"
                >
                  {a.label}
                </a>
              ))}
            </div>
          </div>
          </div>
        </section>

        {/* 5. CTA — the page's one full-bleed close. It was a small headline
            against a screen of empty black; it now carries its own ground and
            the page's single solid use of the brand orange. */}
        <div className="pg-grain w-full bg-surface-3 pt-[10vh]">
          <section className="w-full border-t border-ink/12 bg-surface/60">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-6 py-[14vh] sm:px-10 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="max-w-[12ch] font-display text-[clamp(44px,7vw,104px)] leading-[0.88] tracking-tight text-ink">
                Put your brand in this room.
              </h2>
              <a
                href="https://www.home.pstgm.com/contactus"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block shrink-0 self-start rounded-md bg-brand px-8 py-4 font-mono text-[11px] uppercase tracking-[0.24em] text-ink transition-colors duration-200 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 lg:self-auto"
              >
                Start a campaign
              </a>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
