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

function BrandLogo({
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
        className={`max-w-full max-h-full object-contain filter contrast-125 ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span className="font-display text-4xl sm:text-5xl tracking-widest text-ink/80 group-hover:text-ink transition-colors">
      {brand.initials}
    </span>
  );
}

function FeaturedPosterCard({
  brand,
  index,
}: {
  brand: Brand;
  index: number;
}) {
  const formattedIndex = String(index + 1).padStart(2, '0');

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="group relative block bg-surface border-2 border-ink/20 hover:border-brand transition-colors duration-150 overflow-hidden"
    >
      {/* Top technical header bar */}
      <div className="flex items-center justify-between border-b border-ink/20 px-4 py-2 bg-surface-2/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-brand inline-block" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink/60">
            HEADLINER // {formattedIndex}
          </span>
        </div>
        {brand.badge ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand text-surface px-2 py-0.5">
            {brand.badge}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40">
            CONFIRMED
          </span>
        )}
      </div>

      {/* Main emblem / display canvas */}
      <div className="relative h-56 sm:h-64 flex items-center justify-center p-8 bg-surface-2/30 group-hover:bg-brand/10 transition-colors duration-200">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
          <span className="font-display text-[11rem] leading-none text-ink">
            {formattedIndex}
          </span>
        </div>
        <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
          <BrandLogo brand={brand} className="w-36 h-24 sm:w-44 sm:h-28" />
        </div>
      </div>

      {/* Bottom metadata plaque */}
      <div className="border-t border-ink/20 p-5 bg-surface flex flex-col justify-between gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-tight text-ink group-hover:text-brand transition-colors">
            {brand.name}
          </h3>
          <span className="font-mono text-sm text-ink/40 group-hover:text-ink transition-colors">
            ↗
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-ink/10 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
            SECTOR: {brand.category}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-brand font-bold">
            VIEW CAMPAIGN
          </span>
        </div>
      </div>
    </Link>
  );
}

function DirectoryRow({
  brand,
  index,
}: {
  brand: Brand;
  index: number;
}) {
  const [imgError, setImgError] = useState(false);
  const formattedIndex = String(index + 1).padStart(3, '0');

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="group grid grid-cols-12 items-center gap-3 py-3 px-4 border-b border-ink/15 hover:bg-brand hover:text-surface transition-colors duration-150"
    >
      <div className="col-span-2 sm:col-span-1 font-mono text-xs text-ink/40 group-hover:text-surface/80">
        {formattedIndex}
      </div>

      <div className="col-span-2 sm:col-span-1 flex items-center justify-start">
        <div className="w-8 h-8 flex items-center justify-center bg-surface-2 border border-ink/20 group-hover:border-surface/40 group-hover:bg-surface/20 p-1">
          {brand.logoUrl && !imgError ? (
            <img
              src={brand.logoUrl}
              alt=""
              className="max-h-full max-w-full object-contain filter group-hover:invert-0"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="font-mono text-[10px] font-bold text-ink group-hover:text-surface">
              {brand.initials.slice(0, 3)}
            </span>
          )}
        </div>
      </div>

      <div className="col-span-5 sm:col-span-5 flex items-center gap-2">
        <span className="font-display text-lg sm:text-xl uppercase tracking-wide truncate text-ink group-hover:text-surface">
          {brand.name}
        </span>
        {brand.badge && (
          <span className="hidden md:inline-block font-mono text-[9px] uppercase px-1.5 py-0.2 bg-brand text-surface group-hover:bg-surface group-hover:text-brand font-bold">
            {brand.badge}
          </span>
        )}
      </div>

      <div className="col-span-3 sm:col-span-4 font-mono text-[11px] uppercase tracking-wider text-ink/60 group-hover:text-surface/90 truncate">
        {brand.category}
      </div>

      <div className="hidden sm:flex sm:col-span-1 justify-end font-mono text-xs text-ink/40 group-hover:text-surface">
        →
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

  const totalBrands =
    featuredBrands.length + partnerBrands.length + logoWallBrands.length;

  return (
    <div className="min-h-screen bg-surface text-ink selection:bg-brand selection:text-surface">
      {/* ====== TECHNICAL TOP RULE ====== */}
      <div className="border-b border-ink/20 pt-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ink/50">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 bg-brand" />
            <span>POSTGAME NIL ARCHIVE // 04-B</span>
          </div>
          <div className="hidden md:block">
            SPEC: ROSTER CLASSIFICATION // COMMERCIAL DIRECTORY
          </div>
          <div>STATUS: ACTIVE BROADCAST</div>
        </div>
      </div>

      {/* ====== HERO: SWISS EDITORIAL POSTER SPREAD ====== */}
      <section className="border-b border-ink/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Block: Monumental Bebas Type Broken Across Grid */}
            <div className="lg:col-span-8">
              <div className="font-mono text-xs font-bold uppercase tracking-widest text-brand mb-3">
                [ OFFICIAL PARTNER ROSTER ]
              </div>

              <h1 className="font-display text-6xl sm:text-8xl md:text-9xl uppercase leading-[0.82] tracking-tighter text-ink">
                THE BRANDS
                <br />
                <span className="text-brand">BEHIND THE</span>
                <br />
                BIGGEST RUNS.
              </h1>

              <div className="mt-8 pt-6 border-t-2 border-ink max-w-2xl">
                <p className="text-base sm:text-lg text-ink/80 leading-snug">
                  From global sportswear flagships to hyper-growth digital
                  disruptors: Postgame structures, executes, and clears the
                  nation&apos;s most demanding NIL campaigns.
                </p>
              </div>
            </div>

            {/* Right Block: Solid Brutalist Monolithic Keycard & Stats */}
            <div className="lg:col-span-4 flex flex-col gap-0 border-2 border-ink">
              <div className="bg-brand text-surface p-6">
                <div className="font-mono text-[11px] uppercase tracking-widest font-bold">
                  TOTAL VERIFIED PARTNERS
                </div>
                <div className="font-display text-7xl sm:text-8xl leading-none mt-2">
                  {totalBrands}
                  <span className="text-3xl">+</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider mt-2 opacity-80">
                  NATIONAL + REGIONAL CONTRACTS
                </div>
              </div>

              <div className="bg-surface-2 p-6 border-t-2 border-ink">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                      ATHLETES
                    </div>
                    <div className="font-display text-4xl sm:text-5xl text-ink leading-none mt-1">
                      60K+
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                      NIL TENURE
                    </div>
                    <div className="font-display text-4xl sm:text-5xl text-ink leading-none mt-1">
                      05 YRS
                    </div>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-ink/15 font-mono text-[10px] uppercase tracking-wider text-ink/60 flex items-center justify-between">
                  <span>CLEARANCE RATE</span>
                  <span className="font-bold text-ink">100% NCAA COMPLIANT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== STICKY SWISS FILTER DOCK ====== */}
      <div className="sticky top-[56px] z-40 bg-surface/95 backdrop-blur-sm border-b-2 border-ink">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="py-3 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink/40 mr-2 shrink-0 hidden sm:inline-block">
              FILTER //
            </span>

            <button
              onClick={() => setActiveFilter(null)}
              className={`shrink-0 px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                activeFilter === null
                  ? 'bg-brand text-surface font-bold'
                  : 'bg-surface-2 text-ink/70 hover:text-ink hover:bg-surface-3 border border-ink/20'
              }`}
            >
              ALL [ {totalBrands} ]
            </button>

            {brandCategories.map((cat) => {
              const isActive = activeFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`shrink-0 px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'bg-brand text-surface font-bold'
                      : 'bg-surface-2 text-ink/70 hover:text-ink hover:bg-surface-3 border border-ink/20'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ====== TIER 01: HEADLINERS POSTER GRID ====== */}
      {filteredFeatured.length > 0 && (
        <section className="border-b border-ink/20 py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-4 border-b-2 border-ink">
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-brand mb-1">
                  TIER 01 // PRIORITY
                </div>
                <h2 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-ink">
                  HEADLINER PARTNERS
                </h2>
              </div>
              <div className="font-mono text-xs uppercase tracking-widest text-ink/50">
                DISPLAYING {filteredFeatured.length} SIGNATURE ACCOUNTS
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
              {filteredFeatured.map((brand, idx) => (
                <FeaturedPosterCard
                  key={brand.slug}
                  brand={brand}
                  index={idx}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ====== TIER 02: COMPREHENSIVE DIRECTORY ====== */}
      {filteredRoster.length > 0 && (
        <section className="py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-4 border-b-2 border-ink">
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-brand mb-1">
                  TIER 02 // INDEX
                </div>
                <h2 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-ink">
                  FULL BRAND DIRECTORY
                </h2>
              </div>
              <div className="font-mono text-xs uppercase tracking-widest text-ink/50">
                {filteredRoster.length} RECORDS CATALOGED [A–Z]
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 py-2 px-4 border-y-2 border-ink bg-surface-2 font-mono text-[10px] uppercase tracking-widest text-ink/60">
              <div className="col-span-2 sm:col-span-1">ID</div>
              <div className="col-span-2 sm:col-span-1">MK</div>
              <div className="col-span-5 sm:col-span-5">ORGANIZATION</div>
              <div className="col-span-3 sm:col-span-4">INDUSTRY CLASSIFICATION</div>
              <div className="hidden sm:block sm:col-span-1 text-right">LINK</div>
            </div>

            {/* Directory Rows */}
            <div className="divide-y divide-ink/10 border-b border-ink/20">
              {filteredRoster.map((brand, idx) => (
                <DirectoryRow key={brand.slug} brand={brand} index={idx} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ====== EMPTY FILTER STATE ====== */}
      {filteredFeatured.length === 0 && filteredRoster.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-28 text-center">
          <div className="inline-block border-2 border-ink p-8 bg-surface-2 max-w-lg">
            <div className="font-mono text-xs uppercase tracking-widest text-brand font-bold mb-2">
              ZERO RECORDS FOUND
            </div>
            <p className="font-display text-3xl uppercase text-ink mb-4">
              NO PARTNERS IN SELECTED SECTOR
            </p>
            <button
              onClick={() => setActiveFilter(null)}
              className="bg-brand text-surface font-mono text-xs font-bold uppercase tracking-wider px-6 py-3 hover:bg-ink hover:text-surface transition-colors"
            >
              RESET ARCHIVE FILTER [ALL]
            </button>
          </div>
        </div>
      )}

      {/* ====== MONOLITHIC BRUTALIST CALL-TO-ACTION ====== */}
      <section className="bg-brand text-surface border-t-4 border-ink">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8">
              <div className="font-mono text-xs font-bold uppercase tracking-widest text-surface/80 mb-2">
                JOIN THE POSTGAME ROSTER // COMMERCIAL INTAKE
              </div>
              <h2 className="font-display text-5xl sm:text-7xl md:text-8xl uppercase tracking-tight leading-[0.88]">
                PUT YOUR BRAND ON THE FIELD.
              </h2>
              <p className="mt-6 font-mono text-sm sm:text-base text-surface/90 max-w-xl">
                Direct access to 60,000+ collegiate athletes. Scaled campaign
                operations, compliance governance, and production clearance.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4">
              <a
                href="https://www.home.pstgm.com/contactus"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-surface text-ink font-mono text-xs sm:text-sm font-bold uppercase tracking-widest py-4 px-8 border-2 border-surface hover:bg-surface-2 hover:border-ink transition-colors"
              >
                INITIATE PARTNERSHIP ↗
              </a>
              <div className="font-mono text-[10px] uppercase tracking-wider text-surface/80 text-center">
                TYPICAL CAMPAIGN LEAD TIME: 5–10 BUSINESS DAYS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== EDITORIAL COLOPHON FOOTER ====== */}
      <footer className="border-t border-ink/20 bg-surface py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex flex-col gap-3">
            <PostgameLogo size="sm" />
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink/50 max-w-md">
              SARASOTA HQ // PHILADELPHIA // TAMPA // LARGEST NIL ATHLETE
              NETWORK IN NORTH AMERICA.
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-1 font-mono text-[10px] uppercase tracking-widest text-ink/40">
            <div>INDEX RELEASE: {new Date().getFullYear()}.REV-03</div>
            <div>© {new Date().getFullYear()} POSTGAME, LLC. ALL RIGHTS RESERVED.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
