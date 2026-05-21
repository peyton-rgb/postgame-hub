// ============================================================
// Case Studies Page — /dashboard/case-studies
//
// Internal dashboard view of all case studies. Each case study
// showcases a brand partnership with an overview, challenge,
// solution, results, and key metrics.
//
// Pulls from: case_studies table in Supabase
// ============================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardContent from '@/components/DashboardContent';
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
  video_url: string | null;
  featured: boolean;
  published: boolean;
  published_date: string | null;
  status: string;
  tags: string[] | null;
  metrics: Record<string, any>;
  highlights: string[];
  sort_order: number;
  created_at: string;
  brand: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
}

// ---- Status Badge ----

function StatusBadge({ status, published }: { status: string; published: boolean }) {
  if (published) {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
        Published
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-yellow-500/15 text-yellow-400 border-yellow-500/20 capitalize">
      {status.replace(/_/g, ' ')}
    </span>
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
    <div className="group bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/15 transition-all duration-300">
      {/* Hero area */}
      <div className="relative aspect-[2/1] bg-[#0a0a0a] overflow-hidden">
        {study.image_url ? (
          <img
            src={study.image_url}
            alt={study.title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${brandColor}20 0%, #0a0a0a 50%, ${brandColor}10 100%)`,
            }}
          >
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={study.brand_name}
                className="w-20 h-20 object-contain opacity-25"
              />
            ) : (
              <span
                className="text-4xl font-black tracking-wider opacity-15"
                style={{ color: brandColor }}
              >
                {initials}
              </span>
            )}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 right-3 flex gap-2">
          <StatusBadge status={study.status} published={study.published} />
        </div>
        {study.featured && (
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D73F09]/90 text-white">
              Featured
            </span>
          </div>
        )}

        {/* Hero stat overlay */}
        {study.hero_stat && (
          <div className="absolute bottom-3 left-4">
            <div className="text-2xl font-black text-white drop-shadow-lg">
              {study.hero_stat}
            </div>
            <div className="text-[10px] text-white/60 font-medium uppercase tracking-wider">
              {study.hero_stat_label}
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Brand + category row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={study.brand_name}
                className="w-5 h-5 object-contain rounded"
              />
            ) : (
              <div
                className="w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: `${brandColor}20` }}
              >
                <span
                  className="text-[8px] font-bold"
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
        <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-[#D73F09] transition-colors">
          {study.title}
        </h3>

        {/* Overview preview */}
        {study.overview && (
          <p className="text-[11px] text-white/30 line-clamp-2 mb-3">
            {study.overview}
          </p>
        )}

        {/* Highlights */}
        {study.highlights && study.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {study.highlights.slice(0, 3).map((h, i) => (
              <span
                key={i}
                className="text-[9px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded"
              >
                {h}
              </span>
            ))}
            {study.highlights.length > 3 && (
              <span className="text-[9px] text-white/15">
                +{study.highlights.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {study.tags && study.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {study.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] text-[#D73F09]/40 bg-[#D73F09]/5 px-1.5 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-white/20 pt-2 border-t border-white/[0.04]">
          <span>
            {study.published_date
              ? new Date(study.published_date).toLocaleDateString()
              : 'Not published'}
          </span>
          {study.video_url && (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Video
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function CaseStudiesPage() {
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStudies() {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from('case_studies')
        .select(`
          *,
          brand:brands!case_studies_brand_id_fkey ( id, name, logo_url, primary_color )
        `)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setStudies(data as CaseStudy[]);
      }
      setLoading(false);
    }
    fetchStudies();
  }, []);

  // Unique categories
  const categories = useMemo(() => {
    const c = new Set(studies.map((s) => s.category).filter(Boolean) as string[]);
    return Array.from(c).sort();
  }, [studies]);

  // Filtered results
  const filtered = useMemo(() => {
    return studies.filter((s) => {
      const matchesSearch =
        !searchTerm ||
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.brand_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [studies, searchTerm, categoryFilter]);

  // Stats
  const publishedCount = studies.filter((s) => s.published).length;
  const featuredCount = studies.filter((s) => s.featured).length;

  return (
    <DashboardContent>
      {/* Page header */}
      <div className="mb-8">
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#D73F09] uppercase mb-1">
          Portfolio
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Case Studies</h1>
        <p className="text-sm text-white/40">
          {studies.length} case studies — {publishedCount} published, {featuredCount} featured
        </p>
      </div>

      {/* Search + category filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search case studies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#D73F09]/50 transition-colors"
        />
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
              !categoryFilter
                ? 'bg-[#D73F09]/15 border-[#D73F09]/30 text-[#D73F09]'
                : 'bg-transparent border-white/10 text-white/40 hover:border-white/20'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
                categoryFilter === cat
                  ? 'bg-[#D73F09]/15 border-[#D73F09]/30 text-[#D73F09]'
                  : 'bg-transparent border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse"
            >
              <div className="aspect-[2/1] bg-white/5" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="h-4 bg-white/5 rounded w-2/3" />
                <div className="h-3 bg-white/5 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((study) => (
            <CaseStudyCard key={study.id} study={study} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-white/20 text-lg font-semibold mb-2">
            {searchTerm || categoryFilter
              ? 'No matching case studies'
              : 'No case studies yet'}
          </div>
          <p className="text-sm text-white/15">
            {searchTerm || categoryFilter
              ? 'Try adjusting your search or filters'
              : 'Case studies will appear here as they are created'}
          </p>
        </div>
      )}
    </DashboardContent>
  );
}
