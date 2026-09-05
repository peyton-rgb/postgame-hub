'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { PostgameLogo } from '@/components/PostgameLogo';
import Image from 'next/image';
import {
  featuredBrands,
  partnerBrands,
  logoWallBrands,
  brandCategories,
  type Brand,
  type BrandCategory,
} from '@/lib/data/brands';

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all duration-150 border ${
        active
          ? 'bg-brand border-brand text-[#FAF8F5]'
          : 'bg-surface-2/80 border-ink/15 text-ink/60 hover:text-ink hover:border-brand/60'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 ${
            active ? 'bg-[#FAF8F5]' : 'bg-brand/40 group-hover:bg-brand'
          }`}
        />
        {label}
      </span>
      {active && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#FAF8F5]" />
      )}
    </button>
  );
}

function BrandLogo({
  brand,
  size = 'md',
  className = '',
}: {
  brand: Brand;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const textSizes = {
    sm: 'text-[9px]',
    md: 'text-xs',
    lg: 'text-xl',
    xl: 'text-3xl',
  };

  if (brand.logoUrl && !imgError) {
    return (
      <img
        src={brand.logoUrl}
        alt={`${brand.name} logo`}
        className={`${sizeClasses[size]} object-contain brightness-95 contrast-125 filter ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center border border-brand/40 bg-surface-3 ${className}`}
    >
      <span
        className={`${textSizes[size]} font-mono font-bold tracking-tighter text-brand`}
      >
        {brand.initials}
      </span>
    </div>
  );
}

function FeaturedCard({ brand, index }: { brand: Brand; index: number }) {
  const [imgError, setImgError] = useState(false);
  const cardIndex = String(index + 1).padStart(2, '0');

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="group relative block bg-surface border border-ink/15 hover:border-brand transition-colors duration-200 overflow-hidden"
    >
      {/* Broadcast frame corner marks */}
      <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-brand z-20" />
      <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-brand z-20" />
      <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-brand z-20" />
      <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-brand z-20" />

      {/* Chyron top strip */}
      <div className="flex items-center justify-between border-b border-ink/10 bg-surface-2 px-4 py-2 font-mono text-[10px] tracking-widest text-ink/60">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-brand animate-pulse" />
          <span className="text-brand font-bold">FEAT_{cardIndex}</span>
          <span className="text-ink/30">//</span>
          <span className="truncate">{brand.category.toUpperCase()}</span>
        </div>
        {brand.badge ? (
          <span className="bg-brand text-[#FAF8F5] px-1.5 py-0.5 font-bold uppercase tracking-wider text-[9px]">
            {brand.badge}
          </span>
        ) : (
          <span className="text-ink/30 font-mono text-[9px]">PRO ROSTER</span>
        )}
      </div>

      {/* Main billboard display */}
      <div className="relative p-6 sm:p-8 flex flex-col justify-between min-h-[220px] sm:min-h-[260px] bg-gradient-to-b from-surface-2/40 via-surface to-surface-3/30">
        {/* Giant ghost background typography */}
        <div
          aria-hidden="true"
          className="absolute right-2 bottom-0 select-none pointer-events-none font-display text-7xl sm:text-9xl text-ink/[0.04] leading-none uppercase tracking-tighter overflow-hidden max-w-[85%] text-right whitespace-nowrap group-hover:text-brand/[0.08] transition-colors"
        >
          {brand.name}
        </div>

        {/* Center brand logo presentation */}
        <div className="relative z-10 flex items-center justify-center my-auto py-4">
          {brand.logoUrl && !imgError ? (
            <img
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              className="max-h-16 sm:max-h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105 filter drop-shadow-[0_4px_12px_rgba(7,7,10,0.8)]"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="font-display text-5xl sm:text-7xl text-ink tracking-widest border-2 border-ink/20 px-6 py-2 group-hover:border-brand transition-colors">
              {brand.initials}
            </div>
          )}
        </div>

        {/* Lower third anchor bar */}
        <div className="relative z-10 pt-4 mt-auto border-t border-ink/10 flex items-end justify-between">
          <div>
            <div className="font-display text-2xl sm:text-3xl uppercase tracking-tight text-ink group-hover:text-brand transition-colors">
              {brand.name}
            </div>
            <div className="font-mono text-[11px] text-ink/40 tracking-wider">
              NIL CAMPAIGN PARTNER
            </div>
          </div>
          <div className="font-mono text-xs text-brand group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
            VIEW <span className="text-sm">→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PartnerCard({ brand, index }: { brand: Brand; index: number }) {
  const [imgError, setImgError] = useState(false);
  const rowNum = String(index + 1).padStart(3, '0');

  return (
    <Link
      href={`/clients/${brand.slug}`}
      className="group relative flex items-center justify-between border-b border-ink/10 bg-surface hover:bg-surface-2 px-4 py-3.5 transition-colors duration-150"
    >
      {/* Left-edge broadcast sting accent */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-150" />

      <div className="flex items-center gap-3.5 min-w-0 pr-3">
        {/* Index counter */}
        <span className="font-mono text-[10px] text-ink/30 shrink-0 w-7 group-hover:text-brand">
          {rowNum}
        </span>

        {/* Logo block */}
        <div className="w-9 h-9 shrink-0 bg-surface-3 border border-ink/10 flex items-center justify-center p-1 group-hover:border-ink/30 transition-colors">
          {brand.logoUrl && !imgError ? (
            <img
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              className="w-full h-full object-contain filter"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="font-mono text-[10px] font-bold text-ink/60">
              {brand.initials}
            </span>
          )}
        </div>

        {/* Name & category */}
        <div className="min-w-0">
          <div className="font-display text-lg uppercase tracking-wide text-ink truncate leading-tight group-hover:text-brand transition-colors">
            {brand.name}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-ink/40 truncate">
            {brand.category}
          </div>
        </div>
      </div>

      {/* Right meta */}
      <div className="flex items-center gap-3 shrink-0">
        {brand.badge && (
          <span className="hidden sm:inline-block font-mono text-[9px] text-brand border border-brand/40 px-1.5 py-0.5 tracking-widest uppercase">
            {brand.badge}
          </span>
        )}
        <span className="font-mono text-xs text-ink/30 group-hover:text-brand group-hover:translate-x-0.5 transition-all">
          →
        </span>
      </div>
    </Link>
  );
}

function SectionHeader({
  label,
  title,
  count,
}: {
  label: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="border-b-2 border-brand pb-3 mb-6 flex items-end justify-between">
      <div className="flex items-baseline gap-4 flex-wrap">
        <div className="font-mono text-[11px] font-bold tracking-[0.25em] text-brand uppercase bg-brand/10 border border-brand/30 px-2 py-0.5">
          {label}
        </div>
        <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-tight text-ink">
          {title}
        </h2>
      </div>
      {count !== undefined && (
        <div className="font-mono text-xs text-ink/40 tracking-wider">
          REC <span className="text-ink font-bold">[{count}]</span>
        </div>
      )}
    </div>
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
    <div className="min-h-screen bg-surface text-ink selection:bg-brand selection:text-[#FAF8F5]">
      {/* Broadcast ON-AIR Ticker Header */}
      <section className="pt-24 pb-0 border-b border-ink/15 relative overflow-hidden">
        {/* Studio grid backdrop */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#FAF8F5 1px, transparent 1px), linear-gradient(90deg, #FAF8F5 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top Chyron Tag */}
          <div className="flex items-center justify-between font-mono text-[11px] text-ink/50 border-b border-ink/10 pb-3 uppercase tracking-widest">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-brand font-bold">
                <span className="w-2 h-2 bg-brand rounded-none" />
                NETWORK DIRECTORY
              </span>
              <span className="text-ink/20">|</span>
              <span className="hidden sm:inline">OFFICIAL NIL PARTNER LOG</span>
            </div>
            <div className="text-right">
              VOL. 2025 <span className="text-brand">//</span> ALL DIVISIONS
            </div>
          </div>

          {/* Heavy Broadcast Title Area */}
          <div className="pt-8 pb-10 sm:py-12">
            <div className="inline-block bg-brand text-[#FAF8F5] px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest mb-4">
              COMMERCIAL ROSTER
            </div>
            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl tracking-tight uppercase text-ink leading-[0.9]">
              BRANDS IN THE <span className="text-brand">GAME</span>
            </h1>
            <p className="mt-4 max-w-2xl font-mono text-xs sm:text-sm text-ink/60 uppercase tracking-wide leading-relaxed">
              Postgame manages high-stakes NIL campaigns for Fortune 500 staples,
              athletic apparel heavyweights, and venture-backed disruptors.
            </p>
          </div>

          {/* Teleprompter / Statbug Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-t-2 border-b-2 border-brand bg-surface-2 font-mono">
            <div className="p-4 sm:p-5 border-r border-ink/10 flex flex-col justify-between">
              <div className="text-[10px] text-ink/40 tracking-widest uppercase">
                TOTAL BRANDS
              </div>
              <div className="font-display text-4xl sm:text-5xl text-ink tracking-tight mt-1">
                {totalBrands}<span className="text-brand">+</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 border-r border-ink/10 flex flex-col justify-between">
              <div className="text-[10px] text-ink/40 tracking-widest uppercase">
                ACTIVE ATHLETES
              </div>
              <div className="font-display text-4xl sm:text-5xl text-ink tracking-tight mt-1">
                60K<span className="text-brand">+</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 border-r border-ink/10 flex flex-col justify-between">
              <div className="text-[10px] text-ink/40 tracking-widest uppercase">
                NIL ERA TENURE
              </div>
              <div className="font-display text-4xl sm:text-5xl text-ink tracking-tight mt-1">
                05 <span className="text-xs text-brand font-mono">YRS</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between bg-brand text-[#FAF8F5]">
              <div className="text-[10px] text-[#FAF8F5]/70 tracking-widest uppercase font-bold">
                CAMPAIGN CLEARANCE
              </div>
              <div className="font-display text-4xl sm:text-5xl tracking-tight mt-1">
                100%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Broadcast Selector Strip (Sticky Filter) */}
      <div className="sticky top-[57px] z-40 bg-surface/95 backdrop-blur border-b border-ink/15 shadow-[0_4px_20px_rgba(7,7,10,0.8)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[10px] text-brand font-bold uppercase tracking-widest hidden md:inline pr-2 border-r border-ink/20">
              CATEGORY:
            </span>
            <FilterPill
              label="ALL"
              active={activeFilter === null}
              onClick={() => setActiveFilter(null)}
            />
            {brandCategories.map((cat) => (
              <FilterPill
                key={cat}
                label={cat}
                active={activeFilter === cat}
                onClick={() => setActiveFilter(cat)}
              />
            ))}
          </div>

          <div className="font-mono text-[11px] text-ink/40 uppercase shrink-0 hidden lg:block">
            FILTERED: {filteredFeatured.length + filteredRoster.length} ACTIVE
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-16">
        {/* Tier 1: Featured Brands / Lower-Third Marquee */}
        {filteredFeatured.length > 0 && (
          <section>
            <SectionHeader
              label="PRIMETIME ROTATION"
              title="HEADLINER CLIENTS"
              count={filteredFeatured.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFeatured.map((brand, idx) => (
                <FeaturedCard key={brand.slug} brand={brand} index={idx} />
              ))}
            </div>
          </section>
        )}

        {/* Tier 2: Partner Roster / Teletext Cable List */}
        {filteredRoster.length > 0 && (
          <section>
            <SectionHeader
              label="NETWORK ROSTER"
              title="PARTNER WIRE // A–Z"
              count={filteredRoster.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-ink/10">
              {filteredRoster.map((brand, idx) => (
                <div
                  key={brand.slug}
                  className="border-r border-ink/10"
                >
                  <PartnerCard brand={brand} index={idx} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state when filters yield zero hits */}
        {filteredFeatured.length === 0 && filteredRoster.length === 0 && (
          <div className="py-24 border border-dashed border-ink/20 bg-surface-2 text-center p-8">
            <div className="font-mono text-xs text-brand uppercase tracking-widest mb-2">
              [ NO SIGNAL FOUND ]
            </div>
            <div className="font-display text-3xl uppercase tracking-tight text-ink mb-4">
              NO CLIENTS MATCH SELECTED SECTOR
            </div>
            <button
              onClick={() => setActiveFilter(null)}
              className="font-mono text-xs uppercase px-5 py-2.5 bg-brand text-[#FAF8F5] tracking-widest font-bold hover:bg-brand/90"
            >
              RESET CHANNEL FILTER →
            </button>
          </div>
        )}
      </div>

      {/* Broadcast Promotion Frame / CTA */}
      <section className="border-t-4 border-brand bg-surface-2 relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6">
        {/* Diagonal broadcast stripes watermark */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #FAF8F5 0, #FAF8F5 2px, transparent 0, transparent 16px)',
          }}
        />

        <div className="max-w-5xl mx-auto border-2 border-brand/40 bg-surface p-8 sm:p-12 relative">
          <div className="absolute top-0 right-0 bg-brand text-[#FAF8F5] font-mono text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
            INQUIRY DESK // ACTIVE
          </div>

          <div className="max-w-3xl">
            <div className="font-mono text-xs font-bold text-brand uppercase tracking-widest mb-3">
              POSTGAME PARTNERSHIP PIPELINE
            </div>
            <h2 className="font-display text-4xl sm:text-6xl md:text-7xl uppercase text-ink tracking-tight leading-[0.95] mb-4">
              PUT YOUR BRAND ON THE FIELD.
            </h2>
            <p className="font-mono text-xs sm:text-sm text-ink/60 uppercase tracking-wide max-w-xl mb-8 leading-relaxed">
              Launch targeted campaigns across our network of 60,000+ collegiate
              athletes. Direct contracts. High compliance. Verified ROI.
            </p>
            <a
              href="https://www.home.pstgm.com/contactus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-brand text-[#FAF8F5] px-8 py-4 font-mono font-bold text-xs uppercase tracking-widest hover:bg-brand/90 transition-colors"
            >
              INITIATE CAMPAIGN <span>→</span>
            </a>
          </div>
        </div>
      </section>

      {/* Broadcast Network Sign-off Footer */}
      <footer className="border-t border-ink/15 bg-surface py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <PostgameLogo size="sm" />
              <span className="font-mono text-[10px] text-ink/40 tracking-widest uppercase">
                // NIL NETWORK BROADCAST SYSTEM
              </span>
            </div>
            <p className="font-mono text-[10px] text-ink/40 uppercase tracking-wider max-w-lg leading-normal">
              Postgame™ manages national sports marketing & NIL activations.
              HQ: Sarasota, FL · Operational Bureaus: Philadelphia, PA & Tampa, FL.
            </p>
          </div>

          <div className="font-mono text-[10px] text-ink/30 uppercase tracking-widest text-left md:text-right">
            <div>TRANSMISSION VERIFIED</div>
            <div className="text-ink/50 mt-0.5">
              © {new Date().getFullYear()} POSTGAME LLC. ALL RIGHTS RESERVED.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
