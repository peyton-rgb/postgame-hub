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
      type="button"
      className={`font-mono text-xs uppercase tracking-[0.18em] px-4 py-2 rounded-full border transition-all duration-300 ${
        active
          ? 'bg-brand border-brand text-ink shadow-[0_0_20px_rgba(215,63,9,0.35)]'
          : 'bg-glass-1 border-ink/10 text-ink/60 hover:text-ink hover:border-ink/30 hover:bg-glass-2'
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
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center border border-ink/10 bg-glass-2 ${className}`}
    >
      <span
        className={`${textSizes[size]} font-mono font-bold text-ink/80`}
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
      className="group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-0.5 bg-glass-1 border border-ink/10 hover:border-ink/25 backdrop-blur-xl"
      style={{ aspectRatio: '16 / 10' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top hairline catch light */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/20 to-transparent z-10 pointer-events-none" />

      {/* Radial brand glow tracking cursor */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle 280px at ${mousePos.x}% ${mousePos.y}%, rgba(215,63,9,0.12), transparent 70%)`,
        }}
      />

      {/* Subtle brand border glow when hovered */}
      <div
        className={`absolute inset-0 rounded-3xl border transition-colors duration-300 pointer-events-none ${
          isHovered ? 'border-brand/30' : 'border-transparent'
        }`}
      />

      {/* Content layer */}
      <div className="relative h-full flex flex-col items-center justify-center p-6 sm:p-8 z-10">
        {/* Brand logo — large and centered */}
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          {brand.logoUrl && !imgError ? (
            <img
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              className="max-h-20 sm:max-h-24 w-auto max-w-[70%] object-contain drop-shadow-lg transition-transform duration-300 ease-out group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="font-display text-5xl sm:text-6xl tracking-wider text-ink/70 transition-transform duration-300 ease-out group-hover:scale-105">
              {brand.initials}
            </span>
          )}
        </div>

        {/* Brand name + category below logo */}
        <div className="mt-3 text-center transition-all duration-300">
          <div className="text-sm sm:text-base font-semibold text-ink tracking-wide">
            {brand.name}
          </div>
          <div className="font-mono text-[10px] text-ink/40 tracking-[0.18em] uppercase mt-1">
            {brand.category}
          </div>
        </div>
      </div>

      {/* Badge (top-left corner) */}
      {brand.badge && (
        <span className="absolute top-4 left-4 z-20 bg-brand text-ink font-mono text-[10px] font-bold px-2.5 py-1 rounded-md tracking-[0.18em] uppercase backdrop-blur-md shadow-sm">
          {brand.badge}
        </span>
      )}

      {/* Arrow indicator (top-right corner) */}
      <span className="absolute top-4 right-4 z-20 font-mono text-xs text-ink/20 group-hover:text-brand transition-colors duration-300">
        ↗
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
    <div className="group relative flex items-center gap-4 bg-glass-1 hover:bg-glass-2 border border-ink/10 hover:border-ink/20 rounded-2xl px-5 py-4 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-md">
      {/* Brand accent indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-brand opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity duration-300" />

      {/* Subtle brand glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand/[0.05] to-transparent opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Logo container */}
      <div className="w-11 h-11 rounded-xl bg-glass-2 border border-ink/10 flex items-center justify-center flex-shrink-0 group-hover:border-ink/20 transition-all duration-300 relative z-10 overflow-hidden p-2">
        {brand.logoUrl && !imgError ? (
          <img
            src={brand.logoUrl}
            alt={`${brand.name} logo`}
            className="w-full h-full object-contain filter brightness-95 contrast-105 group-hover:brightness-100 transition-all"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="font-mono text-xs font-bold text-ink/70">
            {brand.initials}
          </span>
        )}
      </div>

      {/* Name + category */}
      <div className="flex-1 min-w-0 relative z-10">
        <div className="text-sm font-medium text-ink truncate group-hover:text-ink transition-colors">
          {brand.name}
        </div>
        <div className="font-mono text-[10px] text-ink/40 tracking-[0.18em] uppercase mt-0.5 truncate">
          {brand.category}
        </div>
      </div>

      {/* Badge */}
      {brand.badge && (
        <span className="font-mono text-[9px] font-bold text-brand tracking-[0.18em] uppercase relative z-10 flex-shrink-0 bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
          {brand.badge}
        </span>
      )}

      {/* Arrow */}
      <span className="text-ink/20 group-hover:text-brand group-hover:translate-x-0.5 transition-all duration-300 text-xs flex-shrink-0 relative z-10">
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
    <div className="mb-6 flex items-end justify-between border-b border-ink/5 pb-4">
      <div>
        <div className="font-mono text-[10px] sm:text-xs font-medium tracking-[0.18em] text-brand uppercase mb-1">
          {label}
        </div>
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-ink uppercase">
          {title}
        </h2>
      </div>
      {count !== undefined && (
        <div className="font-mono text-[11px] text-ink/40 tracking-[0.18em] uppercase">
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
    <div className="min-h-screen bg-surface text-ink">
      {/* Top nav rendered globally by SiteNav in layout.tsx. */}

      {/* ====== HERO SECTION ====== */}
      <section className="relative pt-32 pb-20 px-6 text-center overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/[0.05] rounded-full blur-[140px]" />
          <div className="absolute top-16 left-[20%] w-48 h-48 bg-brand/[0.03] rounded-full blur-[100px]" />
          <div className="absolute bottom-10 right-[25%] w-56 h-56 bg-brand/[0.03] rounded-full blur-[110px]" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          {/* Eyebrow label with hairlines */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8 bg-brand/40" />
            <div className="font-mono text-[10px] sm:text-xs font-medium tracking-[0.18em] text-brand uppercase">
              Our Partners
            </div>
            <div className="h-px w-8 bg-brand/40" />
          </div>

          {/* Main headline */}
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl uppercase tracking-tight text-ink leading-[0.95] mb-6">
            The Brands Behind
            <br />
            <span className="text-ink/60">
              the Biggest Campaigns
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-sm sm:text-base text-ink/60 max-w-xl mx-auto mb-12 leading-relaxed">
            From Fortune 500 icons to breakout DTC brands — we&apos;ve powered{' '}
            {totalBrands}+ partnerships that move culture.
          </p>

          {/* Stats row — glass panel */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 rounded-2xl border border-ink/10 bg-glass-1 backdrop-blur-xl p-5 sm:p-8 max-w-xl mx-auto">
            <div className="text-center">
              <div className="font-display tabular-nums text-3xl sm:text-5xl text-ink">
                {totalBrands}+
              </div>
              <div className="font-mono text-[10px] sm:text-xs text-ink/40 uppercase tracking-[0.18em] mt-1.5">
                Brands
              </div>
            </div>
            <div className="text-center border-x border-ink/10">
              <div className="font-display tabular-nums text-3xl sm:text-5xl text-brand">
                60K+
              </div>
              <div className="font-mono text-[10px] sm:text-xs text-ink/40 uppercase tracking-[0.18em] mt-1.5">
                Athletes
              </div>
            </div>
            <div className="text-center">
              <div className="font-display tabular-nums text-3xl sm:text-5xl text-ink">
                5
              </div>
              <div className="font-mono text-[10px] sm:text-xs text-ink/40 uppercase tracking-[0.18em] mt-1.5">
                Years of NIL
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FILTER BAR ====== */}
      <div className="sticky top-[57px] z-40 bg-surface/85 backdrop-blur-xl border-y border-ink/10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex gap-2 flex-wrap items-center">
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
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-8">
          <SectionHeader
            label="Featured Partners"
            title="Headliner Brands"
            count={filteredFeatured.length}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {filteredFeatured.map((brand) => (
              <FeaturedCard key={brand.slug} brand={brand} />
            ))}
          </div>
        </section>
      )}

      {/* ====== FULL ROSTER ====== */}
      {filteredRoster.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pt-10 pb-12">
          <SectionHeader
            label="Brand Partners"
            title="Full Roster"
            count={filteredRoster.length}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredRoster.map((brand) => (
              <PartnerCard key={brand.slug} brand={brand} />
            ))}
          </div>
        </section>
      )}

      {/* ====== EMPTY STATE ====== */}
      {filteredFeatured.length === 0 && filteredRoster.length === 0 && (
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="rounded-3xl border border-ink/10 bg-glass-1 p-12 max-w-md mx-auto backdrop-blur-xl">
            <div className="text-ink/40 text-base mb-4">
              No brands found in this category
            </div>
            <button
              onClick={() => setActiveFilter(null)}
              className="font-mono text-xs text-brand uppercase tracking-[0.18em] hover:text-brand/80 transition-colors"
            >
              Show all brands →
            </button>
          </div>
        </div>
      )}

      {/* ====== CTA SECTION ====== */}
      <section className="relative py-20 sm:py-28 px-6">
        <div className="max-w-4xl mx-auto relative">
          {/* Subtle brand glow behind panel */}
          <div className="absolute inset-0 bg-brand/[0.08] blur-3xl rounded-3xl pointer-events-none" />

          {/* Floating Glass Card */}
          <div className="relative rounded-3xl border border-ink/10 bg-glass-1 backdrop-blur-xl p-8 sm:p-14 text-center overflow-hidden">
            {/* Top edge catch light */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/20 to-transparent" />

            <div className="font-mono text-[10px] sm:text-xs font-medium tracking-[0.18em] text-brand uppercase mb-3">
              Partner With Us
            </div>
            <h2 className="font-display text-3xl sm:text-5xl uppercase tracking-tight text-ink mb-4">
              Ready to join this roster?
            </h2>
            <p className="text-sm sm:text-base text-ink/60 max-w-md mx-auto mb-8 leading-relaxed">
              Let&apos;s build your next athlete influencer campaign together.
            </p>
            <a
              href="https://www.home.pstgm.com/contactus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brand text-ink font-mono text-xs uppercase tracking-[0.18em] px-8 py-3.5 rounded-xl hover:bg-brand/90 transition-all duration-300 shadow-[0_0_25px_rgba(215,63,9,0.35)] hover:shadow-[0_0_35px_rgba(215,63,9,0.5)]"
            >
              <span>Get Started</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="bg-surface py-12 px-6 text-center border-t border-ink/10">
        <div className="flex justify-center mb-4">
          <PostgameLogo size="sm" />
        </div>
        <p className="text-xs text-ink/40 max-w-md mx-auto leading-relaxed">
          Postgame™ manages the largest sports marketing and influencer
          campaigns in college sports. Headquartered in Sarasota, FL with
          offices in Philadelphia and Tampa.
        </p>
        <div className="font-mono text-[10px] tracking-[0.18em] text-ink/30 uppercase mt-6">
          © {new Date().getFullYear()} Postgame, LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
