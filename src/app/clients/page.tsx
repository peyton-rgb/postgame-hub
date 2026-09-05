'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { PostgameLogo } from '@/components/PostgameLogo';
import {
  featuredBrands,
  partnerBrands,
  logoWallBrands,
  brandCategories,
  type Brand,
  type BrandCategory,
} from '@/lib/data/brands';

function BrandMark({
  brand,
  className = '',
}: {
  brand: Brand;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (brand.logoUrl && !imgError) {
    return (
      <img
        src={brand.logoUrl}
        alt={`${brand.name} logo`}
        className={`object-contain ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span
      className="font-mono text-[11px] font-bold tracking-widest text-ink/40"
      style={{ color: brand.primaryColor }}
    >
      [{brand.initials}]
    </span>
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

  const totalBrands =
    featuredBrands.length + partnerBrands.length + logoWallBrands.length;

  // Alphabetical groupings for the running editorial index
  const rosterGroups = useMemo(() => {
    const groups: { [key: string]: Brand[] } = {};
    filteredRoster.forEach((brand) => {
      const firstChar = brand.name.trim().charAt(0).toUpperCase();
      const key = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(brand);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [filteredRoster]);

  return (
    <div className="min-h-screen bg-surface text-ink antialiased selection:bg-brand selection:text-ink">
      {/* ====== MASTHEAD & EDITORIAL FOLIO ====== */}
      <header className="border-b border-ink/10 pt-28 pb-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          {/* Top metadata ticker */}
          <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink/40 pb-8 border-b border-ink/10">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2 h-2 bg-brand" />
              <span>POSTGAME ATHLETE ROSTER // INDEX DIRECTORY</span>
            </div>
            <div className="flex items-center gap-6">
              <span>VOL. V</span>
              <span>{totalBrands} PARTNER BRANDS</span>
              <span>EST. 2020</span>
            </div>
          </div>

          {/* Hero editorial headline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-10 pb-6 items-end">
            <div className="lg:col-span-8">
              <span className="font-mono text-xs tracking-[0.25em] text-brand uppercase block mb-3">
                COLOPHON & CLIENT INDEX
              </span>
              <h1 className="font-display text-6xl sm:text-8xl lg:text-9xl tracking-tight leading-[0.85] text-ink uppercase">
                THE BRANDS
              </h1>
            </div>

            <div className="lg:col-span-4 flex flex-col justify-between border-l border-ink/10 lg:pl-8">
              <p className="text-sm leading-relaxed text-ink/70">
                A definitive catalog of sports marketing, consumer goods,
                and digital native brands executing national NIL campaigns
                through Postgame.
              </p>

              {/* Condensed ledger numbers */}
              <div className="grid grid-cols-3 gap-4 pt-8 mt-8 border-t border-ink/10 font-mono">
                <div>
                  <div className="font-display text-3xl text-ink leading-none">
                    {totalBrands}
                  </div>
                  <div className="text-[10px] tracking-wider uppercase text-ink/40 mt-1">
                    Partners
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl text-brand leading-none">
                    60K+
                  </div>
                  <div className="text-[10px] tracking-wider uppercase text-ink/40 mt-1">
                    Athletes
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl text-ink leading-none">
                    05
                  </div>
                  <div className="text-[10px] tracking-wider uppercase text-ink/40 mt-1">
                    Years
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ====== RUNNING CATEGORY INDEX BAR ====== */}
      <nav aria-label="Index filters" className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-ink/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-3.5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar font-mono text-xs uppercase tracking-wider">
            <span className="text-ink/30 pr-3 border-r border-ink/10 shrink-0">
              FILTER //
            </span>

            <button
              onClick={() => setActiveFilter(null)}
              className={`px-3 py-1.5 transition-colors shrink-0 text-left ${
                activeFilter === null
                  ? 'bg-ink text-surface font-semibold'
                  : 'text-ink/60 hover:text-ink hover:bg-ink/5'
              }`}
            >
              ALL ({totalBrands})
            </button>

            {brandCategories.map((cat, idx) => {
              const count = [...featuredBrands, ...partnerBrands, ...logoWallBrands].filter(
                (b) => b.category === cat
              ).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`px-3 py-1.5 transition-colors shrink-0 text-left flex items-center gap-1.5 ${
                    activeFilter === cat
                      ? 'bg-ink text-surface font-semibold'
                      : 'text-ink/60 hover:text-ink hover:bg-ink/5'
                  }`}
                >
                  <span className="opacity-40 text-[10px]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span>{cat}</span>
                  <span className="opacity-40 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-16">
        {/* ====== EDITORIAL FEATURED LEDGER ====== */}
        {filteredFeatured.length > 0 && (
          <section className="mb-24">
            <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-6">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-brand">
                  SECTION 01
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/30">
                  //
                </span>
                <h2 className="font-display text-2xl tracking-wide uppercase text-ink">
                  HEADLINE CAMPAIGNS
                </h2>
              </div>
              <span className="font-mono text-xs text-ink/40">
                [{filteredFeatured.length} KEY ACCOUNTS]
              </span>
            </div>

            {/* Asymmetrical Editorial Grid for Featured */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink/10 border border-ink/10">
              {filteredFeatured.map((brand, idx) => (
                <Link
                  key={brand.slug}
                  href={`/clients/${brand.slug}`}
                  className="group relative bg-surface p-8 sm:p-10 flex flex-col justify-between min-h-[340px] hover:bg-surface-2 transition-colors overflow-hidden"
                >
                  {/* Top Bar inside card */}
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-xs text-ink/30 tracking-widest">
                      № {String(idx + 1).padStart(2, '0')}
                    </span>
                    {brand.badge ? (
                      <span className="font-mono text-[10px] tracking-wider uppercase text-brand border border-brand/40 px-2 py-0.5">
                        {brand.badge}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] tracking-wider uppercase text-ink/40">
                        {brand.category}
                      </span>
                    )}
                  </div>

                  {/* Center Brand Logo / Mark */}
                  <div className="my-8 flex items-center justify-start h-24">
                    <BrandMark
                      brand={brand}
                      className="max-h-16 max-w-[160px] filter grayscale contrast-125 opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                    />
                  </div>

                  {/* Bottom Typography */}
                  <div className="border-t border-ink/10 pt-4 flex items-end justify-between">
                    <div>
                      <div className="font-display text-3xl tracking-tight text-ink group-hover:text-brand transition-colors">
                        {brand.name}
                      </div>
                      <div className="font-mono text-[11px] tracking-wider uppercase text-ink/40 mt-0.5">
                        {brand.category}
                      </div>
                    </div>
                    <span className="font-mono text-sm text-ink/20 group-hover:text-ink transition-colors translate-x-0 group-hover:translate-x-1 duration-200">
                      →
                    </span>
                  </div>

                  {/* Brand Color Edge Tick */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: brand.primaryColor }}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ====== THE EDITORIAL RUNNING INDEX ====== */}
        {filteredRoster.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-10">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-brand">
                  SECTION 02
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/30">
                  //
                </span>
                <h2 className="font-display text-2xl tracking-wide uppercase text-ink">
                  ALPHABETICAL INDEX
                </h2>
              </div>
              <span className="font-mono text-xs text-ink/40">
                [{filteredRoster.length} ENTRIES]
              </span>
            </div>

            {/* Print magazine-style multi-letter ledger */}
            <div className="space-y-12">
              {rosterGroups.map(([letter, brands]) => (
                <div
                  key={letter}
                  className="grid grid-cols-1 lg:grid-cols-12 border-t border-ink/20 pt-4"
                >
                  {/* Big letter marker */}
                  <div className="lg:col-span-2 mb-4 lg:mb-0">
                    <span className="font-display text-6xl text-ink/20 sticky top-20 select-none">
                      {letter}
                    </span>
                  </div>

                  {/* Ledger list */}
                  <div className="lg:col-span-10 divide-y divide-ink/10">
                    {brands.map((brand) => (
                      <Link
                        key={brand.slug}
                        href={`/clients/${brand.slug}`}
                        className="group py-3.5 px-2 -mx-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ink/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Monogram / miniature emblem */}
                          <div className="w-8 h-8 shrink-0 bg-surface-2 border border-ink/10 flex items-center justify-center p-1">
                            <BrandMark
                              brand={brand}
                              className="max-h-5 max-w-full filter grayscale contrast-125 opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                            />
                          </div>

                          <div className="min-w-0">
                            <span className="font-display text-2xl tracking-wide text-ink group-hover:text-brand transition-colors mr-3">
                              {brand.name}
                            </span>
                            {brand.badge && (
                              <span className="align-middle inline-block font-mono text-[9px] uppercase tracking-wider text-brand border border-brand/30 px-1.5 py-0.2 mr-2">
                                {brand.badge}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right metadata columns */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-12 shrink-0 font-mono text-xs">
                          <span className="text-ink/40 uppercase tracking-wider text-[11px]">
                            {brand.category}
                          </span>
                          <span className="text-ink/20 group-hover:text-ink transition-colors">
                            № {brand.slug.slice(0, 4).toUpperCase()} →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ====== EMPTY STATE ====== */}
        {filteredFeatured.length === 0 && filteredRoster.length === 0 && (
          <div className="py-24 text-center border-y border-ink/10 my-12">
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-brand mb-2">
              CATALOG SEARCH // ZERO RESULTS
            </div>
            <p className="font-display text-4xl text-ink mb-6">
              NO PARTNERS FOUND UNDER THIS SECTOR
            </p>
            <button
              onClick={() => setActiveFilter(null)}
              className="font-mono text-xs uppercase tracking-wider text-ink border border-ink/30 px-6 py-3 hover:bg-ink hover:text-surface transition-colors"
            >
              RESET TO ALL RECORDS
            </button>
          </div>
        )}

        {/* ====== FOOTER CALLOUT ====== */}
        <section className="mt-32 border-t-2 border-ink pt-12 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8">
              <span className="font-mono text-xs tracking-[0.25em] text-brand uppercase block mb-3">
                COLOPHON 03 // PARTNERSHIP INQUIRIES
              </span>
              <h3 className="font-display text-4xl sm:text-6xl text-ink uppercase tracking-tight leading-none">
                READY TO COMMISSION YOUR CAMPAIGN?
              </h3>
              <p className="text-sm text-ink/70 mt-4 max-w-xl leading-relaxed">
                Connect with the Postgame representation desk. Custom NIL athlete
                rosters built specifically for brand objectives, media rights, and regional activation.
              </p>
            </div>

            <div className="lg:col-span-4 flex lg:justify-end">
              <a
                href="https://www.home.pstgm.com/contactus"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center font-mono text-xs uppercase tracking-[0.2em] font-semibold bg-brand text-ink px-8 py-4 hover:bg-brand/90 transition-colors inline-block"
              >
                INITIATE PARTNERSHIP →
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ====== COLOPHON FOOTER ====== */}
      <footer className="border-t border-ink/10 bg-surface py-12">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-8 border-b border-ink/10">
            <PostgameLogo size="sm" />
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink/40">
              SARASOTA [HQ] // PHILADELPHIA // TAMPA
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-[10px] text-ink/30 uppercase tracking-widest">
            <div>
              © {new Date().getFullYear()} POSTGAME, LLC. ALL RIGHTS RESERVED.
            </div>
            <div>
              ATHLETE INFLUENCER MARKETING // NIL COMPLIANCE SECURED
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
