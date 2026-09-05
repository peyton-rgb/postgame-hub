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
    <span className="font-display text-4xl sm:text-6xl tracking-widest text-[#FAF8F5]">
      {brand.initials}
    </span>
  );
}

function FeaturedTunnelSlide({
  brand,
  index,
}: {
  brand: Brand;
  index: number;
}) {
  const indexStr = String(index + 1).padStart(2, '0');

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="group relative min-h-screen w-full flex flex-col justify-between p-6 sm:p-12 lg:p-16 border-b border-[#FAF8F5]/15 bg-[#07070a] overflow-hidden transition-colors duration-700 hover:bg-[#07070a]/90"
    >
      {/* Background cinematic bleed: pitch black to Beaver Orange flare */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#07070a] to-[#D73F09]/20 opacity-40 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000 ease-out pointer-events-none" />

      {/* Massive screen-filling ghost typography (tunnel wall) */}
      <div
        aria-hidden="true"
        className="absolute -bottom-6 -right-8 pointer-events-none select-none font-display text-[26vw] leading-none tracking-tighter uppercase text-[#FAF8F5]/[0.03] group-hover:text-[#D73F09]/15 transition-colors duration-700 whitespace-nowrap"
      >
        {brand.name}
      </div>

      {/* Top HUD: Broadcast index & category coordinate */}
      <div className="relative z-10 flex items-start justify-between border-b border-[#FAF8F5]/10 pb-6">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs tracking-widest text-[#D73F09] uppercase">
            STAGE // {indexStr}
          </span>
          <span className="hidden sm:inline font-mono text-xs tracking-widest text-[#FAF8F5]/40 uppercase">
            HEADLINER DOSSIER
          </span>
        </div>

        <div className="flex items-center gap-3">
          {brand.badge && (
            <span className="font-mono text-[10px] tracking-widest uppercase bg-[#D73F09] text-[#FAF8F5] px-2.5 py-1">
              {brand.badge}
            </span>
          )}
          <span className="font-mono text-xs tracking-widest uppercase text-[#FAF8F5]/60">
            {brand.category}
          </span>
        </div>
      </div>

      {/* Centerpiece: Brand scale & identity projection */}
      <div className="relative z-10 my-auto py-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="max-w-4xl">
          <div className="w-24 h-24 sm:w-36 sm:h-36 mb-8 border border-[#FAF8F5]/15 bg-[#07070a] p-4 flex items-center justify-center group-hover:border-[#D73F09] transition-colors duration-500">
            <BrandMark brand={brand} className="max-w-full max-h-full" />
          </div>
          <h2 className="font-display text-7xl sm:text-9xl lg:text-[11rem] leading-[0.85] tracking-tight uppercase text-[#FAF8F5]">
            {brand.name}
          </h2>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-3">
          <span className="font-mono text-xs tracking-widest text-[#FAF8F5]/40 uppercase">
            NIL CAMPAIGN PARTNER
          </span>
          <div className="inline-flex items-center gap-3 font-mono text-sm tracking-widest uppercase text-[#D73F09] group-hover:text-[#FAF8F5] transition-colors duration-300">
            <span>EXPLORE DOSSIER</span>
            <span className="transform group-hover:translate-x-2 transition-transform duration-300">
              →
            </span>
          </div>
        </div>
      </div>

      {/* Bottom broadcast keyline */}
      <div className="relative z-10 flex items-center justify-between border-t border-[#FAF8F5]/10 pt-4 font-mono text-[11px] text-[#FAF8F5]/30 uppercase tracking-widest">
        <span>POSTGAME // VERIFIED ATHLETE NETWORK</span>
        <span className="group-hover:text-[#FAF8F5] transition-colors duration-300">
          SEC.0{index + 1}
        </span>
      </div>
    </Link>
  );
}

function RosterRow({
  brand,
  index,
}: {
  brand: Brand;
  index: number;
}) {
  const [imgError, setImgError] = useState(false);
  const indexStr = String(index + 1).padStart(3, '0');

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 border-b border-[#FAF8F5]/10 bg-[#07070a] hover:bg-[#D73F09]/10 transition-colors duration-300"
    >
      <div className="flex items-center gap-5 min-w-0">
        <span className="font-mono text-xs tracking-widest text-[#FAF8F5]/30 group-hover:text-[#D73F09] transition-colors duration-300 w-10 flex-shrink-0">
          {indexStr}
        </span>

        <div className="w-10 h-10 border border-[#FAF8F5]/10 bg-[#07070a] flex items-center justify-center p-1.5 flex-shrink-0 group-hover:border-[#D73F09] transition-colors duration-300">
          {brand.logoUrl && !imgError ? (
            <img
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              className="max-w-full max-h-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="font-mono text-xs font-bold text-[#FAF8F5]">
              {brand.initials}
            </span>
          )}
        </div>

        <div className="truncate">
          <div className="font-display text-3xl sm:text-4xl uppercase tracking-tight text-[#FAF8F5] group-hover:text-[#FAF8F5] transition-colors duration-300 truncate">
            {brand.name}
          </div>
        </div>
      </div>

      <div className="mt-3 sm:mt-0 flex items-center justify-between sm:justify-end gap-6 flex-shrink-0">
        {brand.badge && (
          <span className="font-mono text-[9px] tracking-widest uppercase bg-[#D73F09] text-[#FAF8F5] px-2 py-0.5">
            {brand.badge}
          </span>
        )}
        <span className="font-mono text-xs tracking-widest uppercase text-[#FAF8F5]/40 group-hover:text-[#FAF8F5]/70 transition-colors duration-300">
          {brand.category}
        </span>
        <span className="font-mono text-sm text-[#FAF8F5]/30 group-hover:text-[#D73F09] group-hover:translate-x-1 transition-all duration-300">
          →
        </span>
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
    <main className="min-h-screen bg-[#07070a] text-[#FAF8F5]">
      {/* ====== TUNNEL PORTAL HERO ====== */}
      <section className="relative min-h-screen flex flex-col justify-between p-6 sm:p-12 lg:p-16 border-b border-[#FAF8F5]/15 overflow-hidden">
        {/* Deep stadium tunnel backlighting */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#07070a] via-[#07070a] to-[#D73F09]/25 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-96 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,#D73F09_0%,transparent_75%)] opacity-30 pointer-events-none" />

        {/* Top broadcast feed bar */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FAF8F5]/10 pb-6">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2.5 h-2.5 bg-[#D73F09] animate-pulse" />
            <span className="font-mono text-xs tracking-widest uppercase text-[#FAF8F5]">
              POSTGAME // TUNNEL TRANSMISSION
            </span>
          </div>
          <div className="font-mono text-xs tracking-widest uppercase text-[#FAF8F5]/40 flex items-center gap-6">
            <span>ACTIVE CAMPAIGNS: 60,000+ ATHLETES</span>
            <span>EST. 2020</span>
          </div>
        </div>

        {/* Center monolithic title */}
        <div className="relative z-10 py-16 lg:py-24">
          <div className="font-mono text-xs sm:text-sm tracking-[0.3em] uppercase text-[#D73F09] mb-4">
            COMMERCIAL PARTNER INDEX
          </div>
          <h1 className="font-display text-[19vw] sm:text-[18vw] leading-[0.8] tracking-tighter uppercase text-[#FAF8F5] select-none">
            CLIENTS
          </h1>
          <p className="mt-8 max-w-xl text-base sm:text-lg text-[#FAF8F5]/70 leading-relaxed font-normal">
            From iconic Fortune 50 giants to disruptive breakout DTC brands. Over{' '}
            <span className="text-[#FAF8F5] font-semibold">{totalBrands}+</span> brand
            partnerships powered through our nationwide NIL athlete roster.
          </p>
        </div>

        {/* Hero stat chyron */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[#FAF8F5]/10 pt-6">
          <div className="border-l border-[#FAF8F5]/15 pl-4">
            <div className="font-display text-4xl sm:text-5xl text-[#FAF8F5] leading-none">
              {totalBrands}+
            </div>
            <div className="font-mono text-[10px] tracking-widest text-[#FAF8F5]/40 uppercase mt-1">
              PARTNER BRANDS
            </div>
          </div>
          <div className="border-l border-[#FAF8F5]/15 pl-4">
            <div className="font-display text-4xl sm:text-5xl text-[#D73F09] leading-none">
              60K+
            </div>
            <div className="font-mono text-[10px] tracking-widest text-[#FAF8F5]/40 uppercase mt-1">
              ATHLETE NETWORK
            </div>
          </div>
          <div className="border-l border-[#FAF8F5]/15 pl-4">
            <div className="font-display text-4xl sm:text-5xl text-[#FAF8F5] leading-none">
              5 YRS
            </div>
            <div className="font-mono text-[10px] tracking-widest text-[#FAF8F5]/40 uppercase mt-1">
              NIL DOMINANCE
            </div>
          </div>
          <div className="border-l border-[#FAF8F5]/15 pl-4">
            <div className="font-display text-4xl sm:text-5xl text-[#D73F09] leading-none">
              #1
            </div>
            <div className="font-mono text-[10px] tracking-widest text-[#FAF8F5]/40 uppercase mt-1">
              COLLEGIATE SCALE
            </div>
          </div>
        </div>
      </section>

      {/* ====== STICKY TUNNEL FILTER MATRIX ====== */}
      <div className="sticky top-0 z-40 bg-[#07070a]/95 backdrop-blur-md border-b border-[#FAF8F5]/15">
        <div className="max-w-full px-6 sm:px-12 py-4 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setActiveFilter(null)}
              className={`font-mono text-xs tracking-widest uppercase px-4 py-2 border transition-all duration-200 ${
                activeFilter === null
                  ? 'bg-[#D73F09] border-[#D73F09] text-[#FAF8F5]'
                  : 'bg-transparent border-[#FAF8F5]/20 text-[#FAF8F5]/60 hover:border-[#D73F09] hover:text-[#FAF8F5]'
              }`}
            >
              ALL CATEGORIES [{totalBrands}]
            </button>
            {brandCategories.map((cat) => {
              const count = [
                ...featuredBrands,
                ...partnerBrands,
                ...logoWallBrands,
              ].filter((b) => b.category === cat).length;

              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`font-mono text-xs tracking-widest uppercase px-4 py-2 border whitespace-nowrap transition-all duration-200 ${
                    activeFilter === cat
                      ? 'bg-[#D73F09] border-[#D73F09] text-[#FAF8F5]'
                      : 'bg-transparent border-[#FAF8F5]/20 text-[#FAF8F5]/60 hover:border-[#D73F09] hover:text-[#FAF8F5]'
                  }`}
                >
                  {cat} [{count}]
                </button>
              );
            })}
          </div>

          <div className="hidden lg:block font-mono text-[10px] tracking-widest uppercase text-[#FAF8F5]/40 flex-shrink-0">
            SCROLL TO DESCEND
          </div>
        </div>
      </div>

      {/* ====== HEADLINER TUNNEL SLIDES ====== */}
      {filteredFeatured.length > 0 && (
        <section>
          <div className="px-6 sm:px-12 py-6 bg-[#07070a] border-b border-[#FAF8F5]/10 flex items-center justify-between">
            <div className="font-mono text-xs tracking-widest uppercase text-[#D73F09]">
              // FEATURED HEADLINERS
            </div>
            <div className="font-mono text-xs tracking-widest uppercase text-[#FAF8F5]/40">
              {filteredFeatured.length} KEY CLIENTS
            </div>
          </div>

          {filteredFeatured.map((brand, i) => (
            <FeaturedTunnelSlide key={brand.slug} brand={brand} index={i} />
          ))}
        </section>
      )}

      {/* ====== FULL ROSTER BROADCAST MATRIX ====== */}
      {filteredRoster.length > 0 && (
        <section className="border-b border-[#FAF8F5]/15">
          <div className="px-6 sm:px-12 py-8 bg-[#07070a] border-b border-[#FAF8F5]/10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="font-mono text-xs tracking-widest uppercase text-[#D73F09] mb-1">
                // FULL COMMERCIAL ROSTER
              </div>
              <h2 className="font-display text-5xl sm:text-6xl uppercase tracking-tight text-[#FAF8F5]">
                BRAND ARCHIVE
              </h2>
            </div>
            <div className="font-mono text-xs tracking-widest uppercase text-[#FAF8F5]/40">
              SHOWING {filteredRoster.length} VERIFIED PARTNERS
            </div>
          </div>

          <div className="divide-y divide-[#FAF8F5]/10">
            {filteredRoster.map((brand, i) => (
              <RosterRow key={brand.slug} brand={brand} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ====== EMPTY STATE ====== */}
      {filteredFeatured.length === 0 && filteredRoster.length === 0 && (
        <section className="min-h-[50vh] flex flex-col items-center justify-center p-12 text-center">
          <div className="font-mono text-xs tracking-widest uppercase text-[#D73F09] mb-3">
            [ZERO ENTRIES FOUND]
          </div>
          <div className="font-display text-4xl sm:text-6xl uppercase text-[#FAF8F5] mb-6">
            NO BRANDS IN THIS SECTOR
          </div>
          <button
            onClick={() => setActiveFilter(null)}
            className="font-mono text-xs tracking-widest uppercase px-6 py-3 border border-[#D73F09] text-[#FAF8F5] bg-[#D73F09] hover:bg-transparent hover:text-[#FAF8F5] transition-colors duration-200"
          >
            RESET ROSTER FILTER →
          </button>
        </section>
      )}

      {/* ====== TUNNEL EXIT // CALL TO ACTION ====== */}
      <section className="relative min-h-[80vh] flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-[#D73F09] text-[#FAF8F5] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,#07070a_0%,transparent_100%)] opacity-30 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between border-b border-[#FAF8F5]/20 pb-6 font-mono text-xs tracking-widest uppercase">
          <span>EXIT TUNNEL // NEXT CAMPAIGN</span>
          <span>POSTGAME COMMERCIAL DESK</span>
        </div>

        <div className="relative z-10 my-auto py-16 max-w-5xl">
          <div className="font-mono text-xs sm:text-sm tracking-[0.3em] uppercase text-[#07070a] font-bold mb-4">
            COMMERCIAL ATHLETE PLACEMENT
          </div>
          <h2 className="font-display text-7xl sm:text-9xl lg:text-[10rem] leading-[0.85] tracking-tight uppercase text-[#FAF8F5] mb-8">
            ENTER THE ROSTER.
          </h2>
          <p className="max-w-xl text-base sm:text-lg text-[#FAF8F5]/90 leading-relaxed mb-10">
            Postgame commands the largest roster of collegiate athlete talent in
            the world. Deploy your brand at national scale.
          </p>
          <a
            href="https://www.home.pstgm.com/contactus"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#07070a] text-[#FAF8F5] font-mono text-xs tracking-[0.2em] uppercase px-8 py-5 border border-[#07070a] hover:bg-[#FAF8F5] hover:text-[#07070a] transition-all duration-300"
          >
            INITIATE CAMPAIGN →
          </a>
        </div>

        <div className="relative z-10 border-t border-[#FAF8F5]/20 pt-4 font-mono text-[11px] uppercase tracking-widest flex items-center justify-between">
          <span>POSTGAME AGENCY GROUP</span>
          <span>FLORIDA // PENNSYLVANIA</span>
        </div>
      </section>

      {/* ====== BROADCAST SIGN-OFF FOOTER ====== */}
      <footer className="bg-[#07070a] p-8 sm:p-16 border-t border-[#FAF8F5]/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <PostgameLogo size="sm" />
          <div className="font-mono text-xs tracking-widest uppercase text-[#FAF8F5]/40">
            NIL INFLUENCER MARKETING AT SCALE
          </div>
        </div>

        <div className="border-t border-[#FAF8F5]/10 pt-8 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-widest text-[#FAF8F5]/30">
          <div>
            HEADQUARTERED IN SARASOTA, FL // OFFICES IN PHILADELPHIA &amp; TAMPA
          </div>
          <div>
            © {new Date().getFullYear()} POSTGAME, LLC. ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>
    </main>
  );
}
