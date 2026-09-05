'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  featuredBrands,
  partnerBrands,
  logoWallBrands,
  brandCategories,
  type Brand,
  type BrandCategory,
} from '@/lib/data/brands';

gsap.registerPlugin(ScrollTrigger);

const CLIPS: Record<string, string> = {
  adidas:
    'https://video.wixstatic.com/video/ba5ed8_ebf91867c7b84bc0b5198a8c85c50c0f/1080p/mp4/file.mp4',
  cvs:
    'https://video.wixstatic.com/video/ba5ed8_bc5962641cd34a73bcf0e16398f387ad/1080p/mp4/file.mp4',
  allstate:
    'https://video.wixstatic.com/video/ba5ed8_c6023f2d60c6486da454627cad71dd8a/1080p/mp4/file.mp4',
  crocs:
    'https://video.wixstatic.com/video/ba5ed8_0b4b2841c82c40d8a4332a62cafe0f88/1080p/mp4/file.mp4',
  '7-eleven':
    'https://video.wixstatic.com/video/ba5ed8_8a2570e013304468aff3de0821397150/1080p/mp4/file.mp4',
  'raising-canes':
    'https://video.wixstatic.com/video/ba5ed8_50e5c84c697443299a000521408f8645/1080p/mp4/file.mp4',
  wendys:
    'https://video.wixstatic.com/video/ba5ed8_9e8bacb6acaa4e469d66c4fca67f290b/1080p/mp4/file.mp4',
};

const POSTERS: Record<string, string> = {
  adidas:
    'https://static.wixstatic.com/media/ba5ed8_ebf91867c7b84bc0b5198a8c85c50c0ff000.jpg',
  cvs:
    'https://static.wixstatic.com/media/ba5ed8_bc5962641cd34a73bcf0e16398f387adf000.jpg',
  allstate:
    'https://static.wixstatic.com/media/ba5ed8_c6023f2d60c6486da454627cad71dd8af000.jpg',
  crocs:
    'https://static.wixstatic.com/media/ba5ed8_0b4b2841c82c40d8a4332a62cafe0f88f000.jpg',
  '7-eleven':
    'https://static.wixstatic.com/media/ba5ed8_8a2570e013304468aff3de0821397150f000.jpg',
  'raising-canes':
    'https://static.wixstatic.com/media/ba5ed8_50e5c84c697443299a000521408f8645f000.jpg',
  wendys:
    'https://static.wixstatic.com/media/ba5ed8_9e8bacb6acaa4e469d66c4fca67f290bf000.jpg',
};

function useLogoHover() {
  const stripRef = useRef<HTMLAnchorElement | null>(null);
  const logoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const hasHover = window.matchMedia('(hover: hover)').matches;

    if (prefersReducedMotion || !hasHover) return;

    const strip = stripRef.current;
    const logo = logoRef.current;
    if (!strip || !logo) return;

    gsap.set(logo, { transformOrigin: 'center center' });

    // A hover fires a couple of times a second, so a plain tween is right here —
    // quickTo owns one persistent tween and cannot express a different duration
    // and ease per direction. overwrite:'auto' stops enter/leave stacking.
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

function FeaturedStrip({ brand, index }: { brand: Brand; index: number }) {
  const clip = CLIPS[brand.slug];
  const poster = POSTERS[brand.slug];
  const { stripRef, logoRef } = useLogoHover();

  return (
    <Link
      ref={stripRef}
      href={`/clients/${brand.slug}`}
      data-strip-index={index}
      className="featured-strip relative block w-full h-[38vh] overflow-hidden bg-surface"
    >
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

      {index === 0 && (
        <div className="absolute top-6 left-6 z-20 font-mono text-[10px] uppercase tracking-[0.28em] text-ink/40 pointer-events-none">
          Postgame // Client Roster
        </div>
      )}

      <div className="relative z-10 w-full h-full flex items-center justify-center p-6 pointer-events-none">
        {brand.logoUrl ? (
          <img
            ref={(el) => {
              logoRef.current = el;
            }}
            src={brand.logoUrl}
            alt={brand.name}
            className="h-[7vh] w-auto max-w-[26vw] object-contain brightness-0 invert pointer-events-none select-none will-change-transform"
          />
        ) : (
          <span
            ref={(el) => {
              logoRef.current = el;
            }}
            className="font-display text-[6vh] tracking-wider text-ink select-none will-change-transform"
          >
            {brand.initials}
          </span>
        )}
      </div>
    </Link>
  );
}

function RosterStrip({ brand }: { brand: Brand }) {
  const { stripRef, logoRef } = useLogoHover();

  return (
    <Link
      ref={stripRef}
      href={`/clients/${brand.slug}`}
      className="relative block w-full h-[12vh] overflow-hidden bg-surface"
    >
      <div className="w-full h-full flex items-center justify-center p-4 pointer-events-none">
        {brand.logoUrl ? (
          <img
            ref={(el) => {
              logoRef.current = el;
            }}
            src={brand.logoUrl}
            alt={brand.name}
            className="h-[4vh] w-auto max-w-[20vw] object-contain brightness-0 invert pointer-events-none select-none will-change-transform"
          />
        ) : (
          <span
            ref={(el) => {
              logoRef.current = el;
            }}
            className="font-display text-xl tracking-wider text-ink/70 select-none will-change-transform"
          >
            {brand.initials}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function ClientsPage() {
  const [activeFilter, setActiveFilter] = useState<BrandCategory | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const matchesFilter = (brand: Brand) =>
    activeFilter === null || brand.category === activeFilter;

  const filteredFeatured = useMemo(
    () => featuredBrands.filter(matchesFilter),
    [activeFilter]
  );

  const filteredRoster = useMemo(
    () =>
      [...partnerBrands, ...logoWallBrands]
        .filter(matchesFilter)
        .sort((a, b) => {
          const aNum = /^\d/.test(a.name.trim());
          const bNum = /^\d/.test(b.name.trim());
          if (aNum !== bNum) return aNum ? 1 : -1;
          return a.name.localeCompare(b.name);
        }),
    [activeFilter]
  );

  const totalCount = filteredFeatured.length + filteredRoster.length;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) return;

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
      const targetScale = 1 + (clampedV / 36) * 0.06;
      setMediaStretch(targetScale);
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
          scrollTrigger: {
            trigger: strip,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.6,
          },
        }
      );

      if (tween.scrollTrigger) {
        triggers.push(tween.scrollTrigger);
      }
    });

    return () => {
      gsap.ticker.remove(ticker);
      lenis.destroy();
      triggers.forEach((t) => t.kill());
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [filteredFeatured]);

  return (
    <div ref={rootRef} className="min-h-screen bg-surface text-ink">
      <main className="w-full flex flex-col">
        {filteredFeatured.map((brand, index) => (
          <FeaturedStrip key={brand.slug} brand={brand} index={index} />
        ))}

        {filteredRoster.map((brand) => (
          <RosterStrip key={brand.slug} brand={brand} />
        ))}

        {totalCount === 0 && (
          <div className="w-full h-[50vh] flex flex-col items-center justify-center text-center bg-surface">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/40 mb-3">
              No brands in this category
            </span>
            <button
              type="button"
              onClick={() => setActiveFilter(null)}
              className="font-mono text-xs uppercase tracking-widest text-brand hover:underline"
            >
              Reset Filter
            </button>
            <div className="sr-only">
              {brandCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
