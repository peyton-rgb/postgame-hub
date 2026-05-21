// ============================================================
// Brands Page — /dashboard/brands
//
// Internal dashboard view of all brands Postgame works with.
// Pulls from the brands table in Supabase and shows each brand
// with its logo, campaign count, and brand kit status.
//
// This is the INTERNAL team view — the public-facing version
// lives at /clients and uses hardcoded tier data.
// ============================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardContent from '@/components/DashboardContent';
import { createBrowserSupabase } from '@/lib/supabase';

// ---- Types ----

interface Brand {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  industry: string | null;
  website: string | null;
  tagline: string | null;
  show_on_clients_page: boolean;
  archived: boolean;
  created_at: string;
  // Joined counts
  campaign_count?: number;
  // Brand kit fields
  logo_primary_url: string | null;
  brand_guidelines_url: string | null;
  font_primary: string | null;
}

// ---- Brand Card ----

function BrandCard({
  brand,
  campaignCount,
}: {
  brand: Brand;
  campaignCount: number;
}) {
  const color = brand.primary_color || '#D73F09';
  const initials = brand.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Count how many brand kit items are filled
  const kitItems = [
    brand.logo_url,
    brand.logo_primary_url,
    brand.brand_guidelines_url,
    brand.font_primary,
    brand.primary_color,
  ].filter(Boolean).length;

  return (
    <div className="group bg-[#111] border border-white/[0.06] rounded-xl p-4 hover:border-white/15 transition-all duration-300 cursor-default">
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/[0.06] group-hover:border-white/10 transition-colors"
          style={{ backgroundColor: `${color}10` }}
        >
          {brand.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brand.name}
              className="w-10 h-10 object-contain"
            />
          ) : (
            <span
              className="text-sm font-bold"
              style={{ color: `${color}80` }}
            >
              {initials}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-white truncate">
              {brand.name}
            </h3>
            {brand.show_on_clients_page && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#D73F09]/10 text-[#D73F09] flex-shrink-0">
                Public
              </span>
            )}
          </div>
          {brand.industry && (
            <div className="text-[11px] text-white/30 mb-2">{brand.industry}</div>
          )}
          {brand.tagline && (
            <div className="text-[10px] text-white/20 italic mb-2 line-clamp-1">
              {brand.tagline}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 text-[10px] text-white/25">
            <span>
              <span className="text-white/50 font-semibold">{campaignCount}</span>{' '}
              {campaignCount === 1 ? 'campaign' : 'campaigns'}
            </span>
            <span>
              <span className="text-white/50 font-semibold">{kitItems}/5</span>{' '}
              kit items
            </span>
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D73F09]/50 hover:text-[#D73F09] transition-colors"
              >
                Website
              </a>
            )}
          </div>
        </div>

        {/* Color swatch */}
        {brand.primary_color && (
          <div
            className="w-6 h-6 rounded-full border border-white/10 flex-shrink-0"
            style={{ backgroundColor: brand.primary_color }}
            title={brand.primary_color}
          />
        )}
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaignCounts, setCampaignCounts] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createBrowserSupabase();

      // Fetch brands
      const { data: brandsData } = await supabase
        .from('brands')
        .select('*')
        .order('name');

      // Fetch campaign counts per brand
      const { data: countData } = await supabase
        .from('campaign_recaps')
        .select('brand_id');

      if (brandsData) {
        setBrands(brandsData as Brand[]);
      }

      // Build counts map
      if (countData) {
        const counts: Record<string, number> = {};
        countData.forEach((row: any) => {
          if (row.brand_id) {
            counts[row.brand_id] = (counts[row.brand_id] || 0) + 1;
          }
        });
        setCampaignCounts(counts);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  // Filter brands
  const filtered = useMemo(() => {
    return brands.filter((b) => {
      if (!showArchived && b.archived) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          b.name.toLowerCase().includes(term) ||
          (b.industry || '').toLowerCase().includes(term) ||
          (b.tagline || '').toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [brands, searchTerm, showArchived]);

  // Stats
  const activeBrands = brands.filter((b) => !b.archived).length;
  const withLogos = brands.filter((b) => !b.archived && b.logo_url).length;
  const onPublicPage = brands.filter((b) => b.show_on_clients_page).length;

  return (
    <DashboardContent>
      {/* Page header */}
      <div className="mb-8">
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#D73F09] uppercase mb-1">
          Brand Management
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Brands</h1>
        <p className="text-sm text-white/40">
          All brand partners and their campaign history
        </p>
      </div>

      {/* Quick stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Active Brands', value: activeBrands },
            { label: 'With Logos', value: withLogos },
            { label: 'On Public Page', value: onPublicPage },
            {
              label: 'Total Campaigns',
              value: Object.values(campaignCounts).reduce((a, b) => a + b, 0),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#111] border border-white/[0.06] rounded-lg p-3 text-center"
            >
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search brands..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#D73F09]/50 transition-colors"
        />
        <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-white/20 bg-white/5"
          />
          Show archived
        </label>
      </div>

      {/* Results count */}
      {!loading && (
        <div className="text-[11px] text-white/20 mb-4">
          Showing {filtered.length} of {brands.length} brands
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-[#111] border border-white/[0.06] rounded-xl p-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/5 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/2" />
                  <div className="h-3 bg-white/5 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Brand grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              campaignCount={campaignCounts[brand.id] || 0}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-white/20 text-lg font-semibold mb-2">
            No matching brands
          </div>
          <p className="text-sm text-white/15">
            Try adjusting your search terms
          </p>
        </div>
      )}
    </DashboardContent>
  );
}
