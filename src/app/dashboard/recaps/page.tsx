// ============================================================
// Campaign Recaps Page — /dashboard/recaps
//
// Lists all campaign recaps from Supabase, organized as a
// filterable grid with brand logos, status badges, and
// thumbnail previews.
//
// Pulls from: campaign_recaps table (joined with brands)
// ============================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardContent from '@/components/DashboardContent';
import { createBrowserSupabase } from '@/lib/supabase';

// ---- Types ----

interface CampaignRecap {
  id: string;
  name: string;
  slug: string;
  client_name: string;
  client_logo_url: string | null;
  status: string;
  type: string;
  published: boolean;
  featured: boolean;
  description: string | null;
  hero_image_url: string | null;
  thumbnail_url: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  brand: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
}

// ---- Status Badge ----

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    draft: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    archived: 'bg-white/10 text-white/40 border-white/10',
    in_review: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  };

  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        colors[status] || colors.draft
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ---- Recap Card ----

function RecapCard({ recap }: { recap: CampaignRecap }) {
  const brandColor = recap.brand?.primary_color || '#D73F09';
  const brandLogo = recap.brand?.logo_url || recap.client_logo_url;
  const initials = recap.client_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/15 transition-all duration-300">
      {/* Thumbnail / Hero area */}
      <div className="relative aspect-[16/9] bg-[#0a0a0a] overflow-hidden">
        {recap.thumbnail_url || recap.hero_image_url ? (
          <img
            src={recap.thumbnail_url || recap.hero_image_url || ''}
            alt={recap.name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${brandColor}15 0%, #0a0a0a 60%, ${brandColor}10 100%)`,
            }}
          >
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={recap.client_name}
                className="w-16 h-16 object-contain opacity-30"
              />
            ) : (
              <span
                className="text-3xl font-black tracking-wider opacity-20"
                style={{ color: brandColor }}
              >
                {initials}
              </span>
            )}
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-3 right-3">
          <StatusBadge status={recap.status} />
        </div>

        {/* Featured badge */}
        {recap.featured && (
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D73F09]/90 text-white">
              Featured
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Brand row */}
        <div className="flex items-center gap-2 mb-2">
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={recap.client_name}
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
            {recap.client_name}
          </span>
        </div>

        {/* Campaign name */}
        <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-[#D73F09] transition-colors">
          {recap.name}
        </h3>

        {/* Description preview */}
        {recap.description && (
          <p className="text-[11px] text-white/30 line-clamp-2 mb-3">
            {recap.description}
          </p>
        )}

        {/* Tags */}
        {recap.tags && recap.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recap.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Type + Date row */}
        <div className="flex items-center justify-between text-[10px] text-white/20 mt-2">
          <span className="capitalize">{recap.type.replace(/_/g, ' ')}</span>
          <span>{new Date(recap.created_at).toLocaleDateString()}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.06]">
          <Link
            href={`/dashboard/recaps/${recap.id}`}
            className="flex-1 text-center text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            Edit
          </Link>
          {recap.published && recap.brand?.slug && (
            <Link
              href={`/clients/${recap.brand.slug}/${recap.slug}`}
              className="flex-1 text-center text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#D73F09]/10 text-[#D73F09] hover:bg-[#D73F09]/20 transition-all"
            >
              View Live
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function RecapsPage() {
  const [recaps, setRecaps] = useState<CampaignRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecaps() {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from('campaign_recaps')
        .select(`
          *,
          brand:brands!campaigns_brand_id_fkey ( id, name, slug, logo_url, primary_color )
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRecaps(data as CampaignRecap[]);
      }
      setLoading(false);
    }
    fetchRecaps();
  }, []);

  // Get unique statuses for filter pills
  const statuses = useMemo(() => {
    const s = new Set(recaps.map((r) => r.status));
    return Array.from(s).sort();
  }, [recaps]);

  // Filtered results
  const filtered = useMemo(() => {
    return recaps.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.client_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [recaps, searchTerm, statusFilter]);

  return (
    <DashboardContent>
      {/* Page header */}
      <div className="mb-8">
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#D73F09] uppercase mb-1">
          Campaign Library
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Campaign Recaps</h1>
        <p className="text-sm text-white/40">
          {recaps.length} campaigns across all brands
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search campaigns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#D73F09]/50 transition-colors"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter(null)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
              !statusFilter
                ? 'bg-[#D73F09]/15 border-[#D73F09]/30 text-[#D73F09]'
                : 'bg-transparent border-white/10 text-white/40 hover:border-white/20'
            }`}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-all capitalize ${
                statusFilter === s
                  ? 'bg-[#D73F09]/15 border-[#D73F09]/30 text-[#D73F09]'
                  : 'bg-transparent border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse"
            >
              <div className="aspect-[16/9] bg-white/5" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((recap) => (
            <RecapCard key={recap.id} recap={recap} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-white/20 text-lg font-semibold mb-2">
            {searchTerm || statusFilter
              ? 'No matching recaps found'
              : 'No campaign recaps yet'}
          </div>
          <p className="text-sm text-white/15">
            {searchTerm || statusFilter
              ? 'Try adjusting your search or filters'
              : 'Campaign recaps will appear here as campaigns are completed'}
          </p>
        </div>
      )}
    </DashboardContent>
  );
}
