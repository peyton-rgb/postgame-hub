'use client';

import { useState, useMemo, useRef } from 'react';
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

// ---- Trading Card Tilt Hook ----
function useCardTilt() {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRotate({ x: -y * 16, y: x * 16 });
  };

  const onMouseEnter = () => setIsHovered(true);
  const onMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  return { rotate, isHovered, onMouseMove, onMouseEnter, onMouseLeave };
}

// ---- Holographic Refractor Headliner Card ----
function FoilFeaturedCard({ brand, index }: { brand: Brand; index: number }) {
  const [imgError, setImgError] = useState(false);
  const { rotate, isHovered, onMouseMove, onMouseEnter, onMouseLeave } = useCardTilt();

  const cardId = `PG-${String(index + 1).padStart(3, '0')}`;
  const glareX = (rotate.y / 16 + 0.5) * 100;
  const glareY = (-rotate.x / 16 + 0.5) * 100;

  return (
    <Link href={`/clients/${brand.slug}`} className="block select-none group">
      <div
        onMouseMove={onMouseMove}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="relative bg-surface border-2 border-brand/80 p-2.5 transition-shadow duration-300 shadow-[0_0_0_1px_rgba(215,63,9,0.3)] hover:shadow-[0_12px_36px_rgba(215,63,9,0.35)]"
        style={{
          transform: isHovered
            ? `perspective(800px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(1.025, 1.025, 1.025)`
            : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.4s ease-out',
        }}
      >
        {/* Prismatic Holo-foil Sheen */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 mix-blend-screen"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(250,248,245,0.35) 0%, rgba(215,63,9,0.4) 30%, transparent 70%)`,
          }}
        />

        {/* Outer Card Stamp & Registration marks */}
        <div className="absolute top-1 left-1 text-[8px] font-mono text-brand leading-none">◤</div>
        <div className="absolute top-1 right-1 text-[8px] font-mono text-brand leading-none">◥</div>
        <div className="absolute bottom-1 left-1 text-[8px] font-mono text-brand leading-none">◣</div>
        <div className="absolute bottom-1 right-1 text-[8px] font-mono text-brand leading-none">◢</div>

        {/* Inner Card Framing */}
        <div className="border border-brand/40 bg-surface-2 p-3 relative flex flex-col justify-between h-full min-h-[340px]">
          {/* Top Header Strip: Card Serial & Roster Tier */}
          <div className="flex items-center justify-between border-b border-ink/15 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-wider text-ink bg-brand px-1.5 py-0.5 uppercase">
                {cardId}
              </span>
              <span className="font-mono text-[9px] tracking-widest text-ink/60 uppercase">
                REFRACTOR // S-1
              </span>
            </div>
            <span className="font-mono text-[9px] text-brand tracking-widest uppercase border border-brand/60 px-1.5 py-0.2">
              GEM-MT 10
            </span>
          </div>

          {/* Holographic Logo Well */}
          <div className="relative my-4 flex-1 flex items-center justify-center p-6 border border-ink/10 bg-surface overflow-hidden">
            {/* Holographic diagonal prism lines */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  -45deg,
                  rgba(215,63,9,0.4) 0px,
                  rgba(215,63,9,0.4) 2px,
                  transparent 2px,
                  transparent 8px
                )`,
              }}
            />

            {/* Crosshairs */}
            <span className="absolute top-2 left-2 text-[10px] font-mono text-ink/20 leading-none">+</span>
            <span className="absolute top-2 right-2 text-[10px] font-mono text-ink/20 leading-none">+</span>
            <span className="absolute bottom-2 left-2 text-[10px] font-mono text-ink/20 leading-none">+</span>
            <span className="absolute bottom-2 right-2 text-[10px] font-mono text-ink/20 leading-none">+</span>

            {/* Brand Logo */}
            {brand.logoUrl && !imgError ? (
              <img
                src={brand.logoUrl}
                alt={`${brand.name} logo`}
                className="relative z-10 max-h-24 max-w-[80%] object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:scale-105"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="relative z-10 font-display text-5xl tracking-widest text-brand transition-transform duration-300 group-hover:scale-105">
                {brand.initials}
              </span>
            )}

            {/* Watermark serial in well */}
            <span className="absolute bottom-2 right-3 font-mono text-[8px] text-ink/20 tracking-widest">
              OFFICIAL NIL PARTNER
            </span>
          </div>

          {/* Bottom Card Identity Plate */}
          <div className="space-y-1.5 pt-1 border-t border-ink/15">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-2xl tracking-wide text-ink truncate uppercase">
                {brand.name}
              </h3>
              {brand.badge && (
                <span className="font-mono text-[8px] bg-ink/10 text-brand border border-brand/40 px-1 py-0.5 tracking-wider uppercase flex-shrink-0">
                  {brand.badge}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-ink/50 pt-1 border-t border-ink/5">
              <span className="tracking-wider uppercase text-brand/90">
                // {brand.category}
              </span>
              <span className="text-ink/40 tracking-tight group-hover:text-ink transition-colors">
                CARD VIEW ↗
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---- Regular Collectible Base Card ----
function TradingBaseCard({ brand, index }: { brand: Brand; index: number }) {
  const [imgError, setImgError] = useState(false);
  const { rotate, isHovered, onMouseMove, onMouseEnter, onMouseLeave } = useCardTilt();

  const cardCode = `PG-${String(index + 1).padStart(3, '0')}`;
  const glareX = (rotate.y / 16 + 0.5) * 100;
  const glareY = (-rotate.x / 16 + 0.5) * 100;

  return (
    <Link href={`/clients/${brand.slug}`} className="block select-none group">
      <div
        onMouseMove={onMouseMove}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="relative bg-surface border border-ink/20 hover:border-brand p-1.5 transition-all duration-200 shadow-sm hover:shadow-[0_8px_24px_rgba(215,63,9,0.25)]"
        style={{
          transform: isHovered
            ? `perspective(600px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(1.02, 1.02, 1.02)`
            : 'perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.3s ease-out',
        }}
      >
        {/* Foil glint on hover */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 mix-blend-screen"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(250,248,245,0.25) 0%, rgba(215,63,9,0.3) 25%, transparent 60%)`,
          }}
        />

        {/* Card Frame Inset */}
        <div className="border border-ink/10 bg-surface-2 p-2 flex flex-col justify-between h-full min-h-[220px]">
          {/* Card Top Label */}
          <div className="flex items-center justify-between border-b border-ink/10 pb-1.5 mb-2">
            <span className="font-mono text-[9px] font-bold text-brand tracking-widest uppercase">
              #{cardCode}
            </span>
            <span className="font-mono text-[8px] text-ink/40 tracking-wider uppercase truncate max-w-[110px]">
              {brand.category}
            </span>
          </div>

          {/* Logo Window */}
          <div className="relative flex-1 flex items-center justify-center p-3 bg-surface border border-ink/10 overflow-hidden min-h-[100px]">
            {/* Micro grid pattern */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(rgba(250,248,245,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(250,248,245,0.2) 1px, transparent 1px)`,
                backgroundSize: '12px 12px',
              }}
            />

            {brand.logoUrl && !imgError ? (
              <img
                src={brand.logoUrl}
                alt={`${brand.name} logo`}
                className="relative z-10 max-h-14 max-w-[85%] object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="relative z-10 font-display text-3xl tracking-wider text-ink/70 group-hover:text-brand transition-colors">
                {brand.initials}
              </span>
            )}
          </div>

          {/* Card Bottom Stamp */}
          <div className="mt-2 pt-1.5 border-t border-ink/10 flex items-end justify-between gap-1">
            <div className="min-w-0 flex-1">
              <h4 className="font-display text-lg tracking-wide text-ink uppercase truncate leading-tight group-hover:text-brand transition-colors">
                {brand.name}
              </h4>
              <p className="font-mono text-[8px] text-ink/40 tracking-widest uppercase">
                POSTGAME RATED
              </p>
            </div>
            <span className="font-mono text-[9px] text-ink/30 group-hover:text-brand transition-colors flex-shrink-0">
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---- Main Page Export ----
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
    <div className="min-h-screen bg-surface text-ink antialiased">
      {/* ====== BROADCAST RUNWAY TICKER ====== */}
      <div className="border-b border-ink/20 bg-surface-2 px-4 py-2 font-mono text-[10px] tracking-widest uppercase flex flex-wrap items-center justify-between gap-3 text-ink/70">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 bg-brand animate-pulse" />
          <span className="text-ink font-bold">POSTGAME® NIL TRADING CARDS</span>
          <span className="text-ink/30">|</span>
          <span>SERIES 2024-25</span>
          <span className="text-ink/30">|</span>
          <span className="text-brand">COLLECTOR SHEET #{totalBrands}</span>
        </div>
        <div className="flex items-center gap-4 text-ink/60">
          <span>60,000+ ATHLETES SIGNED</span>
          <span>•</span>
          <span>5 YRS NIL LEADERSHIP</span>
        </div>
      </div>

      {/* ====== EDITORIAL TRADING WALL HEADER ====== */}
      <header className="border-b-4 border-brand bg-surface px-4 sm:px-8 py-10 lg:py-14">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-xs font-bold tracking-widest text-brand bg-brand/10 border border-brand/40 px-2 py-0.5 uppercase">
                  OFFICIAL PARTNERSHIP ARCHIVE
                </span>
                <span className="font-mono text-xs text-ink/40 tracking-wider">
                  DOC: PG-NIL-WALL
                </span>
              </div>
              <h1 className="font-display text-6xl sm:text-7xl lg:text-9xl tracking-tight leading-[0.88] text-ink uppercase">
                THE CLIENT <span className="text-brand">CARD WALL</span>
              </h1>
              <p className="mt-4 max-w-2xl text-ink/70 text-sm sm:text-base leading-relaxed">
                Every verified brand partner backed by collegiate talent. Hard-edged activations,
                Fortune 500 campaigns, and high-impact NIL roster deals stamped for the record.
              </p>
            </div>

            {/* Trading Pack Spec Box */}
            <div className="lg:col-span-4 border-2 border-brand bg-surface-2 p-4 font-mono">
              <div className="border-b border-ink/15 pb-2 mb-3 flex justify-between text-[11px] text-ink/60 uppercase">
                <span>SHEET SPECIFICATIONS</span>
                <span className="text-brand font-bold">UNCUT DECK</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border border-ink/10 p-2 bg-surface">
                  <div className="font-display text-3xl sm:text-4xl text-brand leading-none">
                    {totalBrands}
                  </div>
                  <div className="text-[9px] text-ink/60 uppercase mt-1">BRANDS</div>
                </div>
                <div className="border border-ink/10 p-2 bg-surface">
                  <div className="font-display text-3xl sm:text-4xl text-ink leading-none">
                    60K+
                  </div>
                  <div className="text-[9px] text-ink/60 uppercase mt-1">ATHLETES</div>
                </div>
                <div className="border border-ink/10 p-2 bg-surface">
                  <div className="font-display text-3xl sm:text-4xl text-brand leading-none">
                    100%
                  </div>
                  <div className="text-[9px] text-ink/60 uppercase mt-1">VERIFIED</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ====== FILTER DECK CONTROLS (TIGHT & BINDER-STYLED) ====== */}
      <nav aria-label="Brand category filters" className="sticky top-0 z-40 bg-surface border-b-2 border-ink/20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
            <span className="font-mono text-[10px] text-brand uppercase font-bold tracking-widest mr-2 shrink-0">
              [ PACK FILTER ]:
            </span>
            <button
              onClick={() => setActiveFilter(null)}
              className={`font-mono text-xs uppercase px-3 py-1.5 tracking-wider border transition-all shrink-0 ${
                activeFilter === null
                  ? 'bg-brand text-ink border-brand font-bold shadow-[0_0_12px_rgba(215,63,9,0.5)]'
                  : 'bg-surface-2 text-ink/60 border-ink/15 hover:border-ink/40 hover:text-ink'
              }`}
            >
              ALL CARDS ({totalBrands})
            </button>
            {brandCategories.map((cat) => {
              const count =
                featuredBrands.filter((b) => b.category === cat).length +
                partnerBrands.filter((b) => b.category === cat).length +
                logoWallBrands.filter((b) => b.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`font-mono text-xs uppercase px-3 py-1.5 tracking-wider border transition-all shrink-0 ${
                    activeFilter === cat
                      ? 'bg-brand text-ink border-brand font-bold shadow-[0_0_12px_rgba(215,63,9,0.5)]'
                      : 'bg-surface-2 text-ink/60 border-ink/15 hover:border-ink/40 hover:text-ink'
                  }`}
                >
                  {cat} <span className="text-[9px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-12">
        {/* ====== TIER 1: REFRACTOR INSERTS (FEATURED CARDS) ====== */}
        {filteredFeatured.length > 0 && (
          <section>
            <div className="flex items-end justify-between border-b-2 border-brand pb-2 mb-6">
              <div>
                <div className="font-mono text-[10px] tracking-widest text-brand uppercase font-bold">
                  // INSERT SET: PREMIUM PRISM REFRACTORS
                </div>
                <h2 className="font-display text-3xl sm:text-4xl tracking-wide uppercase text-ink">
                  HEADLINER PARTNERS
                </h2>
              </div>
              <div className="font-mono text-xs text-ink/50 uppercase tracking-widest">
                SERIES COUNT: {filteredFeatured.length} CARDS
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredFeatured.map((brand, i) => (
                <FoilFeaturedCard key={brand.slug} brand={brand} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ====== TIER 2: BASE SET TRADING CARD WALL (DENSE & PACKED) ====== */}
        {filteredRoster.length > 0 && (
          <section>
            <div className="flex items-end justify-between border-b-2 border-ink/20 pb-2 mb-6">
              <div>
                <div className="font-mono text-[10px] tracking-widest text-ink/60 uppercase font-bold">
                  // BASE ROSTER: OFFICIAL NIL PARTNER DECK
                </div>
                <h2 className="font-display text-3xl sm:text-4xl tracking-wide uppercase text-ink">
                  FULL CARD SHEET
                </h2>
              </div>
              <div className="font-mono text-xs text-brand uppercase tracking-widest">
                ROSTER: {filteredRoster.length} CARDS
              </div>
            </div>

            {/* Edge-to-edge packed trading card grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {filteredRoster.map((brand, i) => (
                <TradingBaseCard
                  key={brand.slug}
                  brand={brand}
                  index={filteredFeatured.length + i}
                />
              ))}
            </div>
          </section>
        )}

        {/* ====== EMPTY FILTER STATE ====== */}
        {filteredFeatured.length === 0 && filteredRoster.length === 0 && (
          <div className="border-2 border-dashed border-ink/20 p-16 text-center bg-surface-2">
            <div className="font-mono text-xs text-brand tracking-widest uppercase mb-2">
              [ NO CARDS FOUND IN SELECTED PACK ]
            </div>
            <p className="font-display text-3xl uppercase text-ink mb-4">
              ZERO BRANDS MATCHED THIS FILTER
            </p>
            <button
              onClick={() => setActiveFilter(null)}
              className="font-mono text-xs uppercase px-6 py-2.5 bg-brand text-ink font-bold hover:bg-brand/80 transition-colors"
            >
              RESET CARD FILTER →
            </button>
          </div>
        )}
      </main>

      {/* ====== COLLECTOR PACK TEAR-STRIP CTA ====== */}
      <section className="mt-16 border-t-4 border-brand bg-surface-2 relative overflow-hidden">
        {/* Repeating foil barcode / serial track */}
        <div className="border-b border-ink/10 py-1.5 px-4 font-mono text-[9px] text-ink/40 tracking-widest uppercase flex justify-between overflow-hidden whitespace-nowrap">
          <span>AUTHENTIC POSTGAME PRODUCT • DO NOT TEAR BEFORE SIGNING</span>
          <span>NIL CAMPAIGN INSERTION SPEC • 2024-25 EDITION</span>
          <span className="hidden sm:inline">SERIAL 8839-POSTGAME-NIL-AUTHENTIC</span>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 lg:py-20">
          <div className="border-2 border-brand bg-surface p-6 sm:p-12 relative">
            <div className="absolute top-2 right-3 font-mono text-[10px] text-brand tracking-widest uppercase">
              MINTING NEXT CAMPAIGN //
            </div>

            <div className="max-w-3xl">
              <span className="font-mono text-xs uppercase tracking-widest text-brand font-bold">
                WANT YOUR BRAND ON THE NEXT CARD SHEET?
              </span>
              <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl uppercase text-ink tracking-tight leading-[0.92] mt-2 mb-6">
                GET PRINTED ON THE <span className="text-brand">POSTGAME ROSTER</span>
              </h2>
              <p className="text-ink/70 text-sm sm:text-base leading-relaxed max-w-xl mb-8">
                Build high-performance college athlete influencer campaigns across football,
                basketball, and Olympic sports with the premier sports NIL marketing agency.
              </p>

              <a
                href="https://www.home.pstgm.com/contactus"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-brand hover:bg-[#FAF8F5] text-ink hover:text-[#07070a] font-mono text-xs font-bold uppercase tracking-widest px-8 py-4 border-2 border-brand transition-all duration-200 shadow-[4px_4px_0px_rgba(250,248,245,0.3)]"
              >
                <span>COMMISSION A CAMPAIGN</span>
                <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FOOTER: COLLECTOR PRINT RECORD ====== */}
      <footer className="border-t border-ink/15 bg-surface py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <PostgameLogo size="sm" />
            <div className="h-6 w-px bg-ink/20" />
            <div className="font-mono text-[10px] tracking-widest text-ink/50 uppercase">
              OFFICIAL NIL TRADING CARD REPERTORY
            </div>
          </div>

          <div className="text-center md:text-right font-mono text-[10px] tracking-wider text-ink/40 leading-relaxed">
            POSTGAME™ ARCHIVE // SARASOTA, FL • PHILADELPHIA, PA • TAMPA, FL
            <br />
            © {new Date().getFullYear()} POSTGAME, LLC. ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>
    </div>
  );
}
