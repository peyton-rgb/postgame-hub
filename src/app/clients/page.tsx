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
    <div className="min-h-screen bg-[#07070a] text-[#FAF8F5] font-mono selection:bg-brand selection:text-[#07070a]">
      {/* ====== BROADCAST TOP TICKER / STATUS BAR ====== */}
      <div className="w-full border-b border-[#FAF8F5]/10 bg-[#07070a]/90 text-[10px] tracking-widest uppercase">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 bg-brand animate-ping" />
            <span className="text-brand font-bold">SYS.STAT // LIVE NIL ROSTER</span>
            <span className="hidden sm:inline text-[#FAF8F5]/30">|</span>
            <span className="hidden sm:inline text-[#FAF8F5]/50">FEED ID: PG-MKT-V5</span>
          </div>
          <div className="flex items-center gap-4 text-[#FAF8F5]/60">
            <span className="hidden md:inline">FREQ: 104.9 NIL</span>
            <span className="text-[#FAF8F5]/30">|</span>
            <span>VERIFIED PARTNERS: [{totalBrands}]</span>
          </div>
        </div>
      </div>

      {/* ====== SCOREBOARD JUMBOTRON HERO ====== */}
      <section className="relative border-b border-[#FAF8F5]/10 bg-[#07070a]">
        <div className="max-w-7xl mx-auto px-4 pt-12 pb-14">
          {/* Header Row: Agency Identity + Terminal Clock Code */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#FAF8F5]/10">
            <div>
              <div className="text-xs text-brand font-bold tracking-[0.3em] uppercase mb-2">
                POSTGAME ATHLETICS // BRAND PORTFOLIO BOARD
              </div>
              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight leading-none uppercase text-[#FAF8F5]">
                VERIFIED <span className="text-brand">PARTNER</span> ROSTER
              </h1>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#FAF8F5]/40 tracking-widest">
              <span className="border border-[#FAF8F5]/20 px-2 py-1">DIVISION I</span>
              <span className="border border-brand/40 text-brand px-2 py-1">POSTGAME™ OPS</span>
            </div>
          </div>

          {/* Stadium Scoreboard Telemetry Bank */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#FAF8F5]/10 my-8 border border-[#FAF8F5]/10">
            {/* Cell 1: Total Brands */}
            <div className="bg-[#07070a] p-5 sm:p-6 flex flex-col justify-between">
              <div className="text-[10px] text-[#FAF8F5]/40 tracking-[0.2em] uppercase flex items-center justify-between">
                <span>ACTIVE BRANDS</span>
                <span className="text-brand font-mono">01</span>
              </div>
              <div className="font-display text-4xl sm:text-6xl text-[#FAF8F5] mt-3 tabular-nums">
                {totalBrands}<span className="text-brand">+</span>
              </div>
              <div className="text-[10px] text-[#FAF8F5]/40 mt-1 uppercase tracking-wider">
                COMMERCIAL PORTFOLIO
              </div>
            </div>

            {/* Cell 2: Athletes */}
            <div className="bg-[#07070a] p-5 sm:p-6 flex flex-col justify-between">
              <div className="text-[10px] text-[#FAF8F5]/40 tracking-[0.2em] uppercase flex items-center justify-between">
                <span>ATHLETE NETWORK</span>
                <span className="text-brand font-mono">02</span>
              </div>
              <div className="font-display text-4xl sm:text-6xl text-[#FAF8F5] mt-3 tabular-nums">
                60K<span className="text-brand">+</span>
              </div>
              <div className="text-[10px] text-[#FAF8F5]/40 mt-1 uppercase tracking-wider">
                SIGNED ROSTER TALENT
              </div>
            </div>

            {/* Cell 3: NIL Era */}
            <div className="bg-[#07070a] p-5 sm:p-6 flex flex-col justify-between">
              <div className="text-[10px] text-[#FAF8F5]/40 tracking-[0.2em] uppercase flex items-center justify-between">
                <span>CLOCK ELAPSED</span>
                <span className="text-brand font-mono">03</span>
              </div>
              <div className="font-display text-4xl sm:text-6xl text-brand mt-3 tabular-nums">
                05<span className="text-[#FAF8F5] text-2xl font-mono ml-1">YRS</span>
              </div>
              <div className="text-[10px] text-[#FAF8F5]/40 mt-1 uppercase tracking-wider">
                SINCE DAY ONE OF NIL
              </div>
            </div>

            {/* Cell 4: Match Status */}
            <div className="bg-[#07070a] p-5 sm:p-6 flex flex-col justify-between">
              <div className="text-[10px] text-[#FAF8F5]/40 tracking-[0.2em] uppercase flex items-center justify-between">
                <span>CAMPAIGN MATCHING</span>
                <span className="text-brand font-mono">04</span>
              </div>
              <div className="font-display text-4xl sm:text-5xl text-[#FAF8F5] mt-3 tracking-wide">
                ACTIVE
              </div>
              <div className="text-[10px] text-brand mt-1 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" /> INGESTING BRIEFS
              </div>
            </div>
          </div>

          {/* Subtext description */}
          <div className="text-xs text-[#FAF8F5]/60 max-w-2xl uppercase tracking-wider leading-relaxed">
            POSTGAME OPERATES THE INDUSTRY BENCHMARK FOR COLLEGE ATHLETICS MARKETING.
            FROM FORTUNE 500 BEHEMOTHS TO HYPER-GROWTH DTC CONSUMER BRANDS,
            EVERY LOGO ON THIS BOARD REPRESENTS CAMPAIGNS EXECUTED ACROSS DIVISION I.
          </div>
        </div>
      </section>

      {/* ====== FILTER CHANNEL MATRIX ====== */}
      <section className="sticky top-0 z-40 bg-[#07070a] border-b border-[#FAF8F5]/20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 mb-2 text-[10px] text-[#FAF8F5]/40 tracking-[0.2em] uppercase">
            <span>FILTER SELECTOR // SECTOR INGEST</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveFilter(null)}
              className={`text-[11px] font-mono uppercase px-3 py-1.5 border transition-colors ${
                activeFilter === null
                  ? 'bg-brand text-[#07070a] border-brand font-bold'
                  : 'bg-transparent text-[#FAF8F5]/60 border-[#FAF8F5]/20 hover:text-[#FAF8F5] hover:border-brand'
              }`}
            >
              [ 00 // ALL SECTORS ]
            </button>

            {brandCategories.map((cat, idx) => {
              const num = String(idx + 1).padStart(2, '0');
              const active = activeFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`text-[11px] font-mono uppercase px-3 py-1.5 border transition-colors ${
                    active
                      ? 'bg-brand text-[#07070a] border-brand font-bold'
                      : 'bg-transparent text-[#FAF8F5]/60 border-[#FAF8F5]/20 hover:text-[#FAF8F5] hover:border-brand'
                  }`}
                >
                  [ {num} // {cat} ]
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====== HEADLINER / FEATURED TIER ====== */}
      {filteredFeatured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12 border-b border-[#FAF8F5]/10">
          <div className="flex items-baseline justify-between border-b border-[#FAF8F5]/10 pb-3 mb-6">
            <div>
              <span className="text-[10px] text-brand tracking-[0.3em] uppercase block">
                SECTION A // TIER-01
              </span>
              <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-wider text-[#FAF8F5]">
                HEADLINER PARTNERS
              </h2>
            </div>
            <div className="text-xs text-[#FAF8F5]/40 font-mono tracking-widest">
              SLOTS FILLED: [{String(filteredFeatured.length).padStart(2, '0')}]
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFeatured.map((brand, i) => (
              <FeaturedScoreboardCard
                key={brand.slug}
                brand={brand}
                slot={String(i + 1).padStart(2, '0')}
              />
            ))}
          </div>
        </section>
      )}

      {/* ====== FULL ROSTER — SCOREBOARD SPLIT BOARD ====== */}
      {filteredRoster.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12 border-b border-[#FAF8F5]/10">
          <div className="flex items-baseline justify-between border-b border-[#FAF8F5]/10 pb-3 mb-4">
            <div>
              <span className="text-[10px] text-brand tracking-[0.3em] uppercase block">
                SECTION B // FULL BOARD
              </span>
              <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-wider text-[#FAF8F5]">
                REGISTERED BRAND LISTING
              </h2>
            </div>
            <div className="text-xs text-[#FAF8F5]/40 font-mono tracking-widest">
              INDEX COUNT: [{String(filteredRoster.length).padStart(3, '0')}]
            </div>
          </div>

          {/* Table Header Row */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-4 py-2 text-[10px] text-[#FAF8F5]/40 border-b border-[#FAF8F5]/10 uppercase tracking-widest font-mono">
            <div className="col-span-1">CODE</div>
            <div className="col-span-5">PARTNER BRAND</div>
            <div className="col-span-3">VERTICAL / SECTOR</div>
            <div className="col-span-2">CLASSIFICATION</div>
            <div className="col-span-1 text-right">ACTION</div>
          </div>

          {/* Scoreboard Row Listing */}
          <div className="divide-y divide-[#FAF8F5]/10 border-b border-[#FAF8F5]/10">
            {filteredRoster.map((brand, idx) => (
              <ScoreboardRow
                key={brand.slug}
                brand={brand}
                idx={idx + 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* ====== EMPTY STATE ====== */}
      {filteredFeatured.length === 0 && filteredRoster.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 py-24 text-center border-b border-[#FAF8F5]/10">
          <div className="font-display text-3xl sm:text-4xl text-[#FAF8F5]/40 uppercase tracking-widest mb-3">
            ZERO ENTRIES FOUND IN SECTOR BUFFER
          </div>
          <div className="text-xs text-[#FAF8F5]/40 mb-6 uppercase tracking-wider">
            FILTER: [{activeFilter}] // NO ACTIVE MATCHES LOGGED
          </div>
          <button
            onClick={() => setActiveFilter(null)}
            className="inline-block border border-brand bg-brand text-[#07070a] px-6 py-2 text-xs font-bold uppercase tracking-widest hover:bg-transparent hover:text-brand transition-colors"
          >
            RESET BOARD TO ALL
          </button>
        </div>
      )}

      {/* ====== SCOREBOARD CTA: INGESTION BRIEF ====== */}
      <section className="relative max-w-7xl mx-auto px-4 py-16">
        <div className="border border-brand/50 bg-[#07070a] p-6 sm:p-12 relative overflow-hidden">
          {/* Top bracket markers */}
          <div className="absolute top-2 left-2 text-[9px] text-brand font-mono tracking-widest">
            ┌ [TERM-CAMPAIGN-INGEST]
          </div>
          <div className="absolute top-2 right-2 text-[9px] text-brand font-mono tracking-widest">
            [SYS-09] ┐
          </div>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 pt-4">
            <div className="max-w-2xl">
              <span className="text-[10px] text-brand font-mono tracking-[0.3em] uppercase block mb-1">
                CALL FOR PARTICIPATION
              </span>
              <h3 className="font-display text-4xl sm:text-6xl uppercase tracking-tight text-[#FAF8F5] leading-none mb-4">
                LAUNCH YOUR NEXT CAMPAIGN ON THIS BOARD
              </h3>
              <p className="text-xs sm:text-sm text-[#FAF8F5]/60 uppercase tracking-wider leading-relaxed">
                Postgame provides enterprise-grade athlete deployment, creative rights clearing,
                and turn-key compliance across all divisions.
              </p>
            </div>

            <div className="w-full lg:w-auto flex-shrink-0">
              <a
                href="https://www.home.pstgm.com/contactus"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center w-full lg:w-auto bg-brand hover:bg-[#FAF8F5] text-[#07070a] font-mono font-bold text-xs uppercase px-8 py-4 border border-brand transition-all tracking-widest"
              >
                REQUEST CAMPAIGN BRIEF →
              </a>
            </div>
          </div>

          {/* Bottom bracket markers */}
          <div className="absolute bottom-2 left-2 text-[9px] text-[#FAF8F5]/30 font-mono tracking-widest">
            └ CHANNEL: VERIFIED
          </div>
          <div className="absolute bottom-2 right-2 text-[9px] text-[#FAF8F5]/30 font-mono tracking-widest">
            LATENCY: 0.04MS ┘
          </div>
        </div>
      </section>

      {/* ====== TERMINAL FOOTER ====== */}
      <footer className="border-t border-[#FAF8F5]/10 bg-[#07070a] py-8 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PostgameLogo size="sm" />
            <span className="text-[10px] text-[#FAF8F5]/40 tracking-widest uppercase">
              POSTGAME™ SPORTS MARKETING & ATHLETE AGENCY
            </span>
          </div>

          <div className="text-[10px] text-[#FAF8F5]/40 tracking-widest uppercase text-center md:text-right">
            <span>HQ: SARASOTA FL</span> // <span>PHL</span> // <span>TPA</span> // <span>© {new Date().getFullYear()} ALL RIGHTS RESERVED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// SCOREBOARD COMPONENTS
// ============================================================

function FeaturedScoreboardCard({
  brand,
  slot,
}: {
  brand: Brand;
  slot: string;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="group block border border-[#FAF8F5]/15 bg-[#07070a] hover:border-brand transition-all duration-150 p-5 relative overflow-hidden"
    >
      {/* Visual frame corners */}
      <div className="absolute top-1.5 left-2 text-[9px] text-[#FAF8F5]/30 font-mono group-hover:text-brand transition-colors">
        +
      </div>
      <div className="absolute top-1.5 right-2 text-[9px] text-[#FAF8F5]/30 font-mono group-hover:text-brand transition-colors">
        +
      </div>

      {/* Header bar inside the card */}
      <div className="flex items-center justify-between border-b border-[#FAF8F5]/10 pb-3 mb-4 text-[10px] uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <span className="text-brand font-bold font-mono">[{slot}]</span>
          <span className="text-[#FAF8F5]/60 font-mono">{brand.category}</span>
        </div>
        {brand.badge ? (
          <span className="border border-brand/60 text-brand px-1.5 py-0.5 text-[9px] font-mono">
            {brand.badge}
          </span>
        ) : (
          <span className="text-[#FAF8F5]/30 font-mono">STATUS: ACTIVE</span>
        )}
      </div>

      {/* Main Display: Large Logo & Typography */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-5 min-w-0">
          {/* Logo container with scoreboard grid vibe */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 border border-[#FAF8F5]/15 bg-[#FAF8F5]/[0.02] flex items-center justify-center flex-shrink-0 p-2 group-hover:border-brand/40 transition-colors">
            {brand.logoUrl && !imgError ? (
              <img
                src={brand.logoUrl}
                alt={`${brand.name} mark`}
                className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-200"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="font-display text-2xl text-brand">
                {brand.initials}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="font-display text-2xl sm:text-3xl text-[#FAF8F5] uppercase tracking-wide truncate group-hover:text-brand transition-colors">
              {brand.name}
            </h3>
            <div className="text-[10px] text-[#FAF8F5]/40 uppercase tracking-widest mt-1">
              FILE: /CLIENTS/{brand.slug}
            </div>
          </div>
        </div>

        {/* Readout Indicator */}
        <div className="flex-shrink-0 pl-3">
          <span className="inline-block border border-[#FAF8F5]/20 group-hover:border-brand group-hover:bg-brand group-hover:text-[#07070a] text-[#FAF8F5]/60 font-mono text-xs px-2.5 py-1.5 transition-all">
            INSPECT →
          </span>
        </div>
      </div>

      {/* Bottom Telemetry hairline */}
      <div className="mt-3 pt-3 border-t border-[#FAF8F5]/10 flex items-center justify-between text-[9px] text-[#FAF8F5]/30 uppercase tracking-widest font-mono">
        <span>PARTNER TIER: HEADLINER</span>
        <span>VERIFIED RECORD</span>
      </div>
    </Link>
  );
}

function ScoreboardRow({
  brand,
  idx,
}: {
  brand: Brand;
  idx: number;
}) {
  const [imgError, setImgError] = useState(false);
  const code = `PG-${String(idx).padStart(3, '0')}`;

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="group block py-3 px-3 sm:px-4 hover:bg-[#FAF8F5]/[0.03] transition-colors"
    >
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center text-xs font-mono">
        {/* Slot code */}
        <div className="sm:col-span-1 text-[10px] text-brand font-mono font-semibold">
          {code}
        </div>

        {/* Brand Name + Small Logo */}
        <div className="col-span-1 sm:col-span-5 flex items-center gap-3 min-w-0 justify-end sm:justify-start">
          <div className="w-6 h-6 border border-[#FAF8F5]/10 bg-[#FAF8F5]/[0.02] flex items-center justify-center flex-shrink-0 p-0.5">
            {brand.logoUrl && !imgError ? (
              <img
                src={brand.logoUrl}
                alt=""
                className="w-full h-full object-contain filter grayscale group-hover:grayscale-0 transition-all"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-[9px] font-bold text-brand">
                {brand.initials}
              </span>
            )}
          </div>
          <span className="font-bold text-sm uppercase text-[#FAF8F5] truncate group-hover:text-brand transition-colors">
            {brand.name}
          </span>
        </div>

        {/* Category */}
        <div className="hidden sm:block sm:col-span-3 text-[11px] text-[#FAF8F5]/50 uppercase tracking-wide truncate">
          {brand.category}
        </div>

        {/* Badge / Status */}
        <div className="hidden sm:block sm:col-span-2 text-[10px] uppercase tracking-wider">
          {brand.badge ? (
            <span className="border border-brand/40 text-brand px-1.5 py-0.5 font-semibold">
              {brand.badge}
            </span>
          ) : (
            <span className="text-[#FAF8F5]/30">OFFICIAL</span>
          )}
        </div>

        {/* Arrow Action */}
        <div className="hidden sm:block sm:col-span-1 text-right text-[#FAF8F5]/30 group-hover:text-brand transition-colors">
          [→]
        </div>
      </div>
    </Link>
  );
}
