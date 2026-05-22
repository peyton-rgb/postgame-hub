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
import Link from 'next/link';
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
    logo_url: string | null;
    logo_light_url: string | null;
    logo_white_url: string | null;
    primary_color: string | null;
  } | null;
  // Cover image pulled from the recap's media (joined client-side).
  cover_url?: string | null;
}

// ---- Status Badge ----
// Driven by the `published` boolean flag, NOT the `status` text column.
// During the bulk import every recap got status='published' even when
// empty, so `published` is the trustworthy "is this actually live?" signal.

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        published
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
          : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20'
      }`}
    >
      {published ? 'Live' : 'Draft'}
    </span>
  );
}

// ---- Recap Card ----

function RecapCard({ recap }: { recap: CampaignRecap }) {
  const brandColor = recap.brand?.primary_color || '#D73F09';
  // For the dark-tinted cover, prefer a white/light logo so it stands out.
  const coverLogo =
    recap.brand?.logo_white_url ||
    recap.brand?.logo_light_url ||
    recap.brand?.logo_url ||
    recap.client_logo_url;
  // Plain logo for the small brand row in the card body.
  const brandLogo = recap.brand?.logo_url || recap.client_logo_url;
  // The cover photo: a piece of content from the recap, falling back to any
  // hero/thumbnail set on the recap itself.
  const coverUrl = recap.cover_url || recap.thumbnail_url || recap.hero_image_url;
  const initials = recap.client_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group relative bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/15 transition-all duration-300">
      {/* Full-card link to the recap editor. Stretched across the whole
          card (absolute inset-0) so clicking anywhere opens the editor. */}
      <Link
        href={`/dashboard/${recap.id}`}
        className="absolute inset-0 z-10"
        aria-label={`Edit ${recap.name}`}
      />

      {/* Thumbnail / Hero area */}
      <div className="relative aspect-[16/9] bg-[#0a0a0a] overflow-hidden">
        {coverUrl ? (
          <>
            {/* The content photo */}
            <img
              src={coverUrl}
              alt={recap.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {/* Dark glass tint over the photo */}
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] group-hover:bg-black/45 transition-colors duration-300" />
            {/* Brand logo sitting on top, centered */}
            {coverLogo ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <img
                  src={coverLogo}
                  alt={recap.client_name}
                  className="max-h-14 max-w-[55%] object-contain drop-shadow-lg"
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-black tracking-wider text-white/90 drop-shadow-lg">
                  {initials}
                </span>
              </div>
            )}
          </>
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
          <StatusBadge published={recap.published} />
        </div>

        {/* Featured badge */}
        {recap.featured && (
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D73F09]/90 text-white">
              Featured
            </span>
          </div>
        )}

        {/* "View Live" link — opens the public recap in a new tab.
            Only shown for published recaps. z-10 + stopPropagation keep
            it above the full-card editor link so its own click wins. */}
        {recap.published && (
          <Link
            href={`/recap/${recap.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-white/70 bg-black/50 backdrop-blur hover:text-[#D73F09] hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all"
            title="View live recap"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
            </svg>
            View Live
          </Link>
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

        {/* Type + date */}
        <div className="flex items-center justify-between text-[10px] text-white/20">
          <span className="capitalize">{recap.type.replace(/_/g, ' ')}</span>
          <span>{new Date(recap.created_at).toLocaleDateString()}</span>
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
  // Filter on the `published` flag (Live / Drafts / All), not the unreliable
  // `status` text column. Default to "Live" so the page isn't flooded with
  // drafts; the "Drafts" pill pulls them up, and any card opens its editor.
  const [view, setView] = useState<'live' | 'draft' | null>('live');

  useEffect(() => {
    async function fetchRecaps() {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from('campaign_recaps')
        .select(`
          *,
          brand:brands!campaigns_brand_id_fkey ( id, name, logo_url, logo_light_url, logo_white_url, primary_color )
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const list = data as CampaignRecap[];

        // Pull one cover image per recap from the recap_card_cover view
        // (one row per campaign, the first content photo) and attach it.
        const { data: covers } = await supabase
          .from('recap_card_cover')
          .select('campaign_id, cover_url');

        if (covers) {
          const coverMap = new Map<string, string>(
            covers.map((c: { campaign_id: string; cover_url: string }) => [
              c.campaign_id,
              c.cover_url,
            ])
          );
          list.forEach((r) => {
            r.cover_url = coverMap.get(r.id) ?? null;
          });
        }

        setRecaps(list);
      }
      setLoading(false);
    }
    fetchRecaps();
  }, []);

  const liveCount = useMemo(() => recaps.filter((r) => r.published).length, [recaps]);

  // Filtered results
  const filtered = useMemo(() => {
    return recaps.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.client_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesView =
        view === null ||
        (view === 'live' && r.published) ||
        (view === 'draft' && !r.published);
      return matchesSearch && matchesView;
    });
  }, [recaps, searchTerm, view]);

  return (
    <DashboardContent>
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-[0.2em] text-[#D73F09] uppercase mb-1">
            Campaign Library
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Campaign Recaps</h1>
          <p className="text-sm text-white/40">
            {view === 'live'
              ? `${liveCount} live recaps · ${recaps.length} total`
              : view === 'draft'
              ? `${filtered.length} drafts · ${recaps.length} total`
              : `${recaps.length} campaigns across all brands`}
          </p>
        </div>

        {/* Create a new campaign. Opens the existing creation flow
            (modal lives on the legacy dashboard list). */}
        <Link
          href="/dashboard?tab=recaps&new=1"
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D73F09] hover:bg-[#c0370a] text-white text-sm font-semibold transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Campaign
        </Link>
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
          {([
            { key: 'live' as const, label: 'Live' },
            { key: 'draft' as const, label: 'Drafts' },
            { key: null, label: 'All' },
          ]).map(({ key, label }) => (
            <button
              key={label}
              onClick={() => setView(key)}
              className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
                view === key
                  ? 'bg-[#D73F09]/15 border-[#D73F09]/30 text-[#D73F09]'
                  : 'bg-transparent border-white/10 text-white/40 hover:border-white/20'
              }`}
            >
              {label}
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
            {searchTerm || view
              ? 'No matching recaps found'
              : 'No campaign recaps yet'}
          </div>
          <p className="text-sm text-white/15">
            {searchTerm || view
              ? 'Try adjusting your search or filters'
              : 'Campaign recaps will appear here as campaigns are completed'}
          </p>
        </div>
      )}
    </DashboardContent>
  );
}
