// ============================================================
// Public Case Studies Listing — /case-studies
//
// Showcases Postgame's brand partnership case studies.
// Public-facing page matching the /clients dark premium style.
// Each card links to an individual detail page at
// /case-studies/[slug].
//
// Only shows PUBLISHED case studies.
// Design: Dark premium theme, Beaver Orange #D73F09 accents.
// ============================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';
import { createBrowserSupabase } from '@/lib/supabase';

// ---- Types ----

interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  brand_name: string;
  brand_logo_url: string | null;
  category: string | null;
  hero_stat: string | null;
  hero_stat_label: string | null;
  overview: string | null;
  image_url: string | null;
  featured: boolean;
  tags: string[] | null;
  brand: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
}

// ---- Filter Pill ----

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

// ---- Case Study Card ----

function CaseStudyCard({ study }: { study: CaseStudy }) {
  const brandColor = study.brand?.primary_color || '#D73F09';
  const brandLogo = study.brand?.logo_url || study.brand_logo_url;
  const initials = study.brand_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link href={`/case-studies/${study.slug}`}>
      <div className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.02] border border-white/[0.06] hover:border-white/15">
        {/* Hero area */}
        <div className="relative aspect-[16/9] overflow-hidden">
          {study.image_url ? (
            <img
              src={study.image_url}
              alt={study.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${brandColor}22 0%, #0a0a0a 40%, ${brandColor}15 70%, #0a0a0a 100%)`,
              }}
            >
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={study.brand_name}
                  className="w-24 h-24 object-contain opacity-25 group-hover:opacity-40 transition-opacity duration-500"
                />
              ) : (
                <span
                  className="text-5xl font-black tracking-wider opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                  style={{ color: brandColor }}
                >
                  {initials}
                </span>
              )}
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />

          {/* Mesh glow on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${brandColor}20, transparent 70%)`,
            }}
          />

          {/* Featured badge */}
          {study.featured && (
            <span className="absolute top-4 left-4 bg-[#D73F09]/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wide backdrop-blur-sm">
              Featured
            </span>
          )}

          {/* Hero stat */}
          {study.hero_stat && (
            <div className="absolute bottom-4 left-5">
              <div className="text-3xl font-black text-white drop-shadow-lg">
                {study.hero_stat}
              </div>
              <div className="text-[10px] text-white/60 font-medium uppercase tracking-wider">
                {study.hero_stat_label}
              </div>
            </div>
          )}

          {/* Arrow */}
          <span className="absolute bottom-4 right-4 text-white/0 group-hover:text-white/60 transition-all duration-300 text-sm">
            →
          </span>
        </div>

        {/* Card body */}
        <div className="p-5 bg-[#111]">
          {/* Brand + category */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={study.brand_name}
                  className="w-6 h-6 object-contain rounded"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}20` }}
                >
                  <span
                    className="text-[9px] font-bold"
                    style={{ color: brandColor }}
                  >
                    {initials}
                  </span>
                </div>
              )}
              <span className="text-[11px] text-white/40 font-medium">
                {study.brand_name}
              </span>
            </div>
            {study.category && (
              <span className="text-[10px] text-white/20 bg-white/5 px-2 py-0.5 rounded">
                {study.category}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-white mb-2 group-hover:text-[#D73F09] transition-colors">
            {study.title}
          </h3>

          {/* Overview */}
          {study.overview && (
            <p className="text-[12px] text-white/35 line-clamp-2 leading-relaxed">
              {study.overview}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---- Main Page ----

export default function CaseStudiesPage() {
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStudies() {
      const supabase = createBrowserSupabase();
      const { data } = await supabase
        .from('case_studies')
        .select(`
          id, title, slug, brand_name, brand_logo_url, category,
          hero_stat, hero_stat_label, overview, image_url, featured, tags,
          brand:brands!case_studies_brand_id_fkey ( id, name, logo_url, primary_color )
        `)
        .eq('published', true)
        .order('sort_order', { ascending: true });

      if (data) setStudies(data as CaseStudy[]);
      setLoading(false);
    }
    fetchStudies();
  }, []);

  // Unique categories
  const categories = useMemo(() => {
    const c = new Set(
      studies.map((s) => s.category).filter(Boolean) as string[]
    );
    return Array.from(c).sort();
  }, [studies]);

  // Filtered
  const filtered = useMemo(() => {
    if (!activeFilter) return studies;
    return studies.filter((s) => s.category === activeFilter);
  }, [studies, activeFilter]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PublicNav variant="dark" />

      {/* ====== HERO ====== */}
      <section className="relative pt-28 pb-16 px-6 text-center overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#D73F09]/[0.03] rounded-full blur-[120px]" />
          <div className="absolute top-20 right-[20%] w-32 h-32 bg-[#D73F09]/[0.04] rounded-full blur-[80px] animate-pulse" />
          <div className="absolute bottom-10 left-[15%] w-40 h-40 bg-[#D73F09]/[0.03] rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px w-8 bg-[#D73F09]/40" />
            <div className="text-[10px] font-bold tracking-[0.3em] text-[#D73F09] uppercase">
              Our Work
            </div>
            <div className="h-px w-8 bg-[#D73F09]/40" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black leading-[1.1] mb-4">
            Case Studies
          </h1>

          <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed">
            How we&apos;ve helped brands connect with college athletes to create
            campaigns that move culture.
          </p>
        </div>
      </section>

      {/* ====== FILTER BAR ====== */}
      {categories.length > 0 && (
        <div className="sticky top-[57px] z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-y border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-6 py-3 flex gap-2 flex-wrap">
            <FilterPill
              label="All"
              active={activeFilter === null}
              onClick={() => setActiveFilter(null)}
            />
            {categories.map((cat) => (
              <FilterPill
                key={cat}
                label={cat}
                active={activeFilter === cat}
                onClick={() => setActiveFilter(cat)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ====== GRID ====== */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-16">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/9] bg-white/5" />
                <div className="p-5 bg-[#111] space-y-3">
                  <div className="h-3 bg-white/5 rounded w-1/3" />
                  <div className="h-5 bg-white/5 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {filtered.map((study) => (
              <CaseStudyCard key={study.id} study={study} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-white/20 text-lg font-semibold mb-2">
              No case studies in this category yet
            </div>
            <button
              onClick={() => setActiveFilter(null)}
              className="text-[#D73F09] text-sm font-semibold hover:underline"
            >
              Show all case studies →
            </button>
          </div>
        )}
      </section>

      {/* ====== CTA ====== */}
      <section className="relative overflow-hidden py-20 px-6 text-center">
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
            Want results like these?
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
