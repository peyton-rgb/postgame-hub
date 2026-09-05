'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  featuredBrands,
  partnerBrands,
  logoWallBrands,
  brandCategories,
  type Brand,
  type BrandCategory,
} from '@/lib/data/brands';

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

function FeaturedStrip({ brand }: { brand: Brand }) {
  const clip = CLIPS[brand.slug];

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="relative block w-full h-[38vh] overflow-hidden bg-surface"
    >
      {clip && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={clip} type="video/mp4" />
        </video>
      )}

      {clip && <div className="absolute inset-0 bg-surface/50 pointer-events-none" />}

      <div className="relative z-10 w-full h-full flex items-center justify-center p-6">
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="w-[16vw] max-h-[50%] object-contain brightness-0 invert pointer-events-none select-none"
          />
        ) : (
          <span className="font-display text-[6vw] tracking-wider text-ink select-none">
            {brand.initials}
          </span>
        )}
      </div>
    </Link>
  );
}

function RosterStrip({ brand }: { brand: Brand }) {
  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="relative block w-full h-[12vh] overflow-hidden bg-surface"
    >
      <div className="w-full h-full flex items-center justify-center p-4">
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="w-[8vw] max-h-[45%] object-contain brightness-0 invert pointer-events-none select-none"
          />
        ) : (
          <span className="font-display text-2xl tracking-wider text-ink/80 select-none">
            {brand.initials}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function ClientsPage() {
  const [activeFilter, setActiveFilter] = useState<BrandCategory | null>(null);

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

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="fixed top-4 right-6 z-50 font-mono text-[11px] uppercase tracking-widest text-ink/40 pointer-events-none">
        {totalCount} Brands
      </div>

      <nav className="w-full px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-widest">
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className={activeFilter === null ? 'text-brand' : 'text-ink/40 hover:text-ink'}
        >
          All
        </button>
        {brandCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveFilter(cat)}
            className={activeFilter === cat ? 'text-brand' : 'text-ink/40 hover:text-ink'}
          >
            {cat}
          </button>
        ))}
      </nav>

      <main className="w-full flex flex-col">
        {filteredFeatured.map((brand) => (
          <FeaturedStrip key={brand.slug} brand={brand} />
        ))}

        {filteredRoster.map((brand) => (
          <RosterStrip key={brand.slug} brand={brand} />
        ))}

        {totalCount === 0 && (
          <div className="w-full h-[50vh] flex flex-col items-center justify-center text-center">
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
          </div>
        )}
      </main>
    </div>
  );
}
