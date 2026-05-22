// ============================================================
// Public Clients Page — /clients
//
// Showcases every brand Postgame has partnered with, organized
// into 2 visual tiers so the biggest names hit hardest:
//
//   1. Featured    — cinematic motion cards with brand logos,
//      animated gradient backgrounds, and hover effects
//   2. Full Roster — compact PartnerCard rows for every other
//      brand, merged from partnerBrands + logoWallBrands and
//      sorted alphabetically
//
// A filter bar lets visitors browse by industry category.
// No auth required — this is a public marketing page.
//
// Design: Dark premium theme matching the Postgame brand.
// Color: Beaver Orange #D73F09 for accents.
// ============================================================

'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  featuredBrands,
  partnerBrands,
  logoWallBrands,
  brandCategories,
  type Brand,
  type BrandCategory,
} from '@/lib/data/brands';

// ---- Filter Pill ----
// A clickable pill button used in the category filter bar.
// "active" means it's the currently selected filter.

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
      className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all duration-200 ${
        active
          ? 'bg-[#D73F09] border-[#D73F09] text-white'
          : 'bg-transparent border-white/20 text-white/50 hover:border-white/40 hover:text-white/80'
      }`}
    >
      {label}
    </button>
  );
}

// ---- Brand Logo ----
// Renders a brand logo image with a fallback to initials if
// the image doesn't load or no URL is provided.

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
    sm: 'text-[8px]',
    md: 'text-xs',
    lg: 'text-lg',
    xl: 'text-2xl',
  };

  if (brand.logoUrl && !imgError) {
    return (
      <img
        src={brand.logoUrl}
        alt={`${brand.name} logo`}
        className={`${sizeClasses[size]} object-contain ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback: show initials in a styled circle
  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center ${className}`}
      style={{ backgroundColor: `${brand.primaryColor}30` }}
    >
      <span
        className={`${textSizes[size]} font-bold`}
        style={{ color: brand.primaryColor }}
      >
        {brand.initials}
      </span>
    </div>
  );
}

// ---- Featured Brand Card (Motion Card) ----
// Large cinematic card with animated gradient background that
// shifts on hover, brand logo centered, badge overlay,
// and a shimmering light sweep effect on mouseenter.

function FeaturedCard({ brand }: { brand: Brand }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Track mouse position relative to card for the radial glow effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const inner = (
    <div
      ref={cardRef}
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.02]"
      style={{ aspectRatio: '16 / 10' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Base gradient background using brand color */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: `linear-gradient(135deg, ${brand.primaryColor}22 0%, #0a0a0a 40%, ${brand.primaryColor}15 70%, #0a0a0a 100%)`,
        }}
      />

      {/* Animated mesh gradient overlay — shifts with mouse position */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse 60% 60% at ${mousePos.x}% ${mousePos.y}%, ${brand.primaryColor}30, transparent 70%)`,
        }}
      />

      {/* Subtle grid pattern for depth */}
      <div
        className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Shimmering light sweep on hover */}
      <div
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
        }}
      />

      {/* Border glow effect */}
      <div
        className="absolute inset-0 rounded-2xl border transition-all duration-500"
        style={{
          borderColor: isHovered ? `${brand.primaryColor}60` : 'rgba(255,255,255,0.08)',
        }}
      />

      {/* Content layer */}
      <div className="relative h-full flex flex-col items-center justify-center p-6 z-10">
        {/* Brand logo — large and centered */}
        {brand.logoUrl && !imgError ? (
          <img
            src={brand.logoUrl}
            alt={`${brand.name} logo`}
            className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-2xl transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]"
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className="text-5xl sm:text-6xl font-black tracking-[0.15em] transition-all duration-500 group-hover:scale-110"
            style={{ color: `${brand.primaryColor}60` }}
          >
            {brand.initials}
          </span>
        )}

        {/* Brand name + category below logo */}
        <div className="mt-4 text-center transition-all duration-500 group-hover:translate-y-0 translate-y-1 opacity-70 group-hover:opacity-100">
          <div className="text-sm font-bold text-white tracking-wide">
            {brand.name}
          </div>
          <div className="text-[10px] text-white/40 tracking-[0.15em] uppercase mt-1">
            {brand.category}
          </div>
        </div>
      </div>

      {/* Badge (top-left corner) */}
      {brand.badge && (
        <span className="absolute top-3 left-3 z-20 bg-[#D73F09]/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wide backdrop-blur-sm">
          {brand.badge}
        </span>
      )}

      {/* Animated corner accent lines */}
      <div
        className="absolute top-0 right-0 w-16 h-16 opacity-0 group-hover:opacity-100 transition-all duration-500"
        style={{
          background: `linear-gradient(225deg, ${brand.primaryColor}40 0%, transparent 60%)`,
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-16 h-16 opacity-0 group-hover:opacity-100 transition-all duration-500"
        style={{
          background: `linear-gradient(45deg, ${brand.primaryColor}40 0%, transparent 60%)`,
        }}
      />

      {/* Arrow icon (bottom-right, appears on hover) */}
      <span className="absolute bottom-3 right-3 z-20 text-white/0 group-hover:text-white/60 transition-all duration-300 text-sm">
        →
      </span>
    </div>
  );

  return (
    <Link href={`/clients/${brand.slug}`}>
      {inner}
    </Link>
  );
}

// ---- Partner Card ----
// Compact card with real brand logo, brand-colored accent,
// name, category, and hover effect.

function PartnerCard({ brand }: { brand: Brand }) {
  const [imgError, setImgError] = useState(false);

  const inner = (
    <div className="group relative flex items-center gap-4 bg-[#111] border border-white/10 rounded-xl px-5 py-4 hover:border-white/20 transition-all duration-300 cursor-pointer overflow-hidden">
      {/* Brand color accent bar on left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ backgroundColor: brand.primaryColor }}
      />

      {/* Subtle brand color glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at 0% 50%, ${brand.primaryColor}08, transparent 60%)`,
        }}
      />

      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-all duration-300 relative z-10 overflow-hidden p-1.5">
        {brand.logoUrl && !imgError ? (
          <img
            src={brand.logoUrl}
            alt={`${brand.name} logo`}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className="text-[11px] font-bold"
            style={{ color: brand.primaryColor }}
          >
            {brand.initials}
          </span>
        )}
      </div>

      {/* Name + category */}
      <div className="flex-1 min-w-0 relative z-10">
        <div className="text-[13px] font-semibold text-white truncate">
          {brand.name}
        </div>
        <div className="text-[10px] text-white/30 tracking-wide">
          {brand.category}
        </div>
      </div>

      {/* Badge */}
      {brand.badge && (
        <span className="text-[9px] font-bold text-[#D73F09] tracking-wider uppercase relative z-10 flex-shrink-0">
          {brand.badge}
        </span>
      )}

      {/* Arrow */}
      <span className="text-white/15 group-hover:text-white/50 transition-colors text-sm flex-shrink-0 relative z-10">
        →
      </span>
    </div>
  );

  return (
    <Link href={`/clients/${brand.slug}`}>
      {inner}
    </Link>
  );
}

// ---- Section Header ----
// Reusable section label + title combo used for each tier.

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
    <div className="mb-6 flex items-end justify-between">
      <div>
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#D73F09] uppercase mb-1">
          {label}
        </div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      {count !== undefined && (
        <div className="text-[11px] text-white/20 font-semibold tracking-wider">
          {count} brands
        </div>
      )}
    </div>
  );
}

// ---- Main Page Component ----

export default function ClientsPage() {
  // Which category filter is active — null means "All"
  const [activeFilter, setActiveFilter] = useState<BrandCategory | null>(null);

  // Filter function — returns true if a brand matches the active filter
  const matchesFilter = (brand: Brand) =>
    activeFilter === null || brand.category === activeFilter;

  // Pre-filter each tier so we don't recalculate on every render
  // useMemo is a React tool that caches the result until activeFilter changes
  const filteredFeatured = useMemo(
    () => featuredBrands.filter(matchesFilter),
    [activeFilter]
  );
  // Full roster = partnerBrands + logoWallBrands, filtered, then alphabetized.
  // Brand names that start with a digit (e.g. "1-800 Contacts") get pushed to
  // the bottom of the list so the A–Z letter brands aren't visually interrupted.
  const filteredRoster = useMemo(
    () =>
      [...partnerBrands, ...logoWallBrands]
        .filter(matchesFilter)
        .sort((a, b) => {
          const aNum = /^\d/.test(a.name.trim());
          const bNum = /^\d/.test(b.name.trim());
          if (aNum !== bNum) return aNum ? 1 : -1; // number-named brands go last
          return a.name.localeCompare(b.name);
        }),
    [activeFilter]
  );

  // Total brand count for the hero stat
  const totalBrands =
    featuredBrands.length + partnerBrands.length + logoWallBrands.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top nav rendered globally by SiteNav in layout.tsx. */}

      {/* ====== HERO SECTION ====== */}
      <section className="relative pt-28 pb-16 px-6 text-center overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Central glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#D73F09]/[0.03] rounded-full blur-[120px]" />
          {/* Floating accent orbs */}
          <div className="absolute top-20 left-[15%] w-32 h-32 bg-[#D73F09]/[0.04] rounded-full blur-[80px] animate-pulse" />
          <div className="absolute bottom-10 right-[20%] w-40 h-40 bg-[#D73F09]/[0.03] rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative max-w-2xl mx-auto">
          {/* Eyebrow label with decorative lines */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px w-8 bg-[#D73F09]/40" />
            <div className="text-[10px] font-bold tracking-[0.3em] text-[#D73F09] uppercase">
              Our Partners
            </div>
            <div className="h-px w-8 bg-[#D73F09]/40" />
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl font-black leading-[1.1] mb-4">
            The Brands Behind
            <br />
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              the Biggest Campaigns
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-sm text-white/40 max-w-md mx-auto mb-12 leading-relaxed">
            From Fortune 500 icons to breakout DTC brands — we&apos;ve powered{' '}
            {totalBrands}+ partnerships that move culture.
          </p>

          {/* Stats row — animated counters */}
          <div className="flex justify-center gap-12 sm:gap-16">
            <div className="text-center group">
              <div className="text-3xl sm:text-4xl font-black text-[#D73F09] group-hover:scale-110 transition-transform duration-300">
                {totalBrands}+
              </div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.15em] mt-1">
                Brands
              </div>
            </div>
            <div className="text-center group">
              <div className="text-3xl sm:text-4xl font-black text-[#D73F09] group-hover:scale-110 transition-transform duration-300">
                60K+
              </div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.15em] mt-1">
                Athletes
              </div>
            </div>
            <div className="text-center group">
              <div className="text-3xl sm:text-4xl font-black text-[#D73F09] group-hover:scale-110 transition-transform duration-300">
                5
              </div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.15em] mt-1">
                Years of NIL
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FILTER BAR ====== */}
      <div className="sticky top-[57px] z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-y border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex gap-2 flex-wrap">
          <FilterPill
            label="All"
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
      </div>

      {/* ====== FEATURED TIER ====== */}
      {filteredFeatured.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pt-12 pb-6">
          <SectionHeader
            label="Featured Partners"
            title="Headliner Brands"
            count={filteredFeatured.length}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filteredFeatured.map((brand) => (
              <FeaturedCard key={brand.slug} brand={brand} />
            ))}
          </div>
        </section>
      )}

      {/* ====== FULL ROSTER ====== */}
      {filteredRoster.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pt-10 pb-10">
          <SectionHeader
            label="Brand Partners"
            title="Full Roster"
            count={filteredRoster.length}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRoster.map((brand) => (
              <PartnerCard key={brand.slug} brand={brand} />
            ))}
          </div>
        </section>
      )}

      {/* ====== EMPTY STATE ====== */}
      {filteredFeatured.length === 0 && filteredRoster.length === 0 && (
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="text-white/20 text-lg font-semibold mb-2">
            No brands in this category yet
          </div>
          <button
            onClick={() => setActiveFilter(null)}
            className="text-[#D73F09] text-sm font-semibold hover:underline"
          >
            Show all brands →
          </button>
        </div>
      )}

      {/* ====== CTA SECTION ====== */}
      <section className="relative overflow-hidden py-20 px-6 text-center">
        {/* Gradient background instead of flat color */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#D73F09] via-[#C53508] to-[#A52D07]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            Ready to join this roster?
          </h2>
          <p className="text-sm text-white/80 mb-8 max-w-md mx-auto">
            Let&apos;s build your next athlete influencer campaign together.
          </p>
          <a
            href="https://www.home.pstgm.com/contactus"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-[#D73F09] font-bold text-sm px-8 py-3.5 rounded-lg hover:bg-white/90 hover:scale-105 transition-all duration-300"
          >
            Get Started →
          </a>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="bg-black py-10 px-6 text-center border-t border-white/5">
        <div className="text-sm font-medium tracking-[0.15em] mb-3">
          P<span className="text-[#D73F09]">+</span>STGAME
        </div>
        <div className="text-[11px] text-white/25 max-w-md mx-auto leading-relaxed">
          Postgame™ manages the largest sports marketing and influencer
          campaigns in college sports. Headquartered in Sarasota, FL with
          offices in Philadelphia and Tampa.
        </div>
        <div className="text-[10px] text-white/15 mt-4">
          © {new Date().getFullYear()} Postgame, LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
