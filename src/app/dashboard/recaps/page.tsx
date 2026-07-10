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
import { supabaseImageUrl } from '@/lib/supabase-image';

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

// ---- Status ----

type RecapStatus = 'published' | 'draft' | 'archived';

// Normalize whatever is in the DB to one of the three known statuses.
function normalizeStatus(status: string | null | undefined): RecapStatus {
  if (status === 'published' || status === 'archived') return status;
  return 'draft';
}

const STATUS_STYLES: Record<RecapStatus, { label: string; className: string }> = {
  published: {
    label: 'Published',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  },
  draft: {
    label: 'Draft',
    className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  },
  archived: {
    label: 'Archived',
    className: 'bg-white/10 text-white/50 border-white/15',
  },
};

// ---- Status Badge ----

function StatusBadge({ status }: { status: RecapStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.className}`}
    >
      {s.label}
    </span>
  );
}

// ---- Card Photo Picker Modal ----

interface MediaImage {
  id: string;
  file_url: string;
  thumbnail_url: string | null;
  type: string;
  is_hero: boolean;
}

function CardPhotoPicker({
  recapId,
  currentThumbnailUrl,
  isOpen,
  onClose,
  onSelect,
}: {
  recapId: string;
  currentThumbnailUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (fileUrl: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setLoading(true);
      setImages([]);
      setError(null);
      setSavingId(null);
      return;
    }
    let cancelled = false;
    async function load() {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from('media')
        .select('id, file_url, thumbnail_url, type, is_hero')
        .eq('campaign_id', recapId)
        .eq('type', 'image')
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setImages((data as MediaImage[]) || []);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, recapId]);

  async function selectImage(img: MediaImage) {
    if (savingId) return;
    setSavingId(img.id);
    const supabase = createBrowserSupabase();
    try {
      // Drive the card thumbnail + the public hero off one photo.
      await supabase
        .from('campaign_recaps')
        .update({ thumbnail_url: img.file_url })
        .eq('id', recapId);
      await supabase.from('media').update({ is_hero: false }).eq('campaign_id', recapId);
      await supabase
        .from('media')
        .update({ is_hero: true, hero_order: 0 })
        .eq('id', img.id);
      onSelect(img.file_url);
      onClose();
    } catch (e: any) {
      setError(String(e?.message || e));
      setSavingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !savingId) onClose();
      }}
    >
      <div className="w-[95vw] h-[85vh] max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-widest text-[#D73F09] uppercase">
              Card photo
            </div>
            <h2 className="text-xl font-black text-white truncate">Choose card photo</h2>
            <div className="text-xs text-gray-500 mt-0.5">
              Sets the card thumbnail and the public hero image.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <svg className="animate-spin h-8 w-8 text-[#D73F09]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 mt-20 text-sm">{error}</div>
          ) : images.length === 0 ? (
            <div className="text-center text-gray-500 mt-20 text-sm">
              No images found for this campaign.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {images.map((img) => {
                const isCurrent = img.file_url === currentThumbnailUrl;
                const isSaving = savingId === img.id;
                return (
                  <button
                    key={img.id}
                    onClick={() => selectImage(img)}
                    disabled={!!savingId}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all disabled:cursor-wait ${
                      isCurrent
                        ? 'border-[#D73F09] ring-2 ring-[#D73F09]/30'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="aspect-square bg-black">
                      <img
                        src={supabaseImageUrl(img.thumbnail_url || img.file_url, 400) || img.file_url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (!el.dataset.fellBack) {
                            el.dataset.fellBack = '1';
                            el.src = img.file_url;
                          }
                        }}
                      />
                    </div>
                    {isCurrent && (
                      <div className="absolute top-2 left-2 bg-[#D73F09] px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-wide">
                        Current
                      </div>
                    )}
                    {isSaving && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <svg className="animate-spin h-6 w-6 text-[#D73F09]" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Recap Card ----

function RecapCard({
  recap,
  onArchive,
  onUnarchive,
}: {
  recap: CampaignRecap;
  onArchive: (r: CampaignRecap) => void;
  onUnarchive: (r: CampaignRecap) => void;
}) {
  const status = normalizeStatus(recap.status);
  const brandColor = recap.brand?.primary_color || '#D73F09';
  const brandLogo = recap.brand?.logo_url || recap.client_logo_url;
  const initials = recap.client_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [thumbnailUrl, setThumbnailUrl] = useState(recap.thumbnail_url);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  return (
    <div className="group bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/15 transition-all duration-300">
      {/* Thumbnail / Hero area */}
      <div className="relative aspect-[16/9] bg-[#0a0a0a] overflow-hidden">
        {thumbnailUrl || recap.hero_image_url ? (
          <img
            src={thumbnailUrl || recap.hero_image_url || ''}
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
          <StatusBadge status={normalizeStatus(recap.status)} />
        </div>

        {/* Featured badge */}
        {recap.featured && (
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D73F09]/90 text-white">
              Featured
            </span>
          </div>
        )}

        {/* Card photo picker trigger */}
        <button
          onClick={() => setPickerOpen(true)}
          aria-label="Choose card photo"
          title="Choose card photo"
          className="absolute bottom-3 right-3 w-8 h-8 rounded-lg bg-black/60 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white hover:border-[#D73F09]/50 transition-all"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>

        {/* Archive trigger — published cards only */}
        {status === 'published' && (
          <button
            onClick={() => setConfirmArchive(true)}
            aria-label="Archive recap"
            title="Archive"
            className="absolute bottom-3 left-3 w-8 h-8 rounded-lg bg-black/60 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white hover:border-[#D73F09]/50 transition-all"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="4" rx="1" />
              <path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
          </button>
        )}

        {/* Inline archive confirm */}
        {confirmArchive && (
          <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
            <p className="text-xs text-white/80 leading-relaxed mb-3">
              Archive <span className="font-semibold text-white">{recap.name}</span>? It leaves
              the public site and this grid but stays in the brand&apos;s portal.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmArchive(false)}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmArchive(false);
                  onArchive(recap);
                }}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#D73F09] text-white hover:bg-[#D73F09]/85 transition-all"
              >
                Archive
              </button>
            </div>
          </div>
        )}
      </div>

      <CardPhotoPicker
        recapId={recap.id}
        currentThumbnailUrl={thumbnailUrl}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(fileUrl) => setThumbnailUrl(fileUrl)}
      />

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
            href={`/dashboard/${recap.id}`}
            className="flex-1 text-center text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            Edit
          </Link>
          {status === 'published' && (
            <Link
              href={`/recap/${recap.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#D73F09]/10 text-[#D73F09] hover:bg-[#D73F09]/20 transition-all"
            >
              View Live
            </Link>
          )}
          {status === 'archived' && (
            <button
              onClick={() => onUnarchive(recap)}
              className="flex-1 text-center text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#D73F09]/10 text-[#D73F09] hover:bg-[#D73F09]/20 transition-all"
            >
              Unarchive
            </button>
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
  const [statusTab, setStatusTab] = useState<RecapStatus>('published');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'brand'>('newest');

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

  // Count pills per status tab (over the full loaded list)
  const statusCounts = useMemo(() => {
    const counts: Record<RecapStatus, number> = { published: 0, draft: 0, archived: 0 };
    for (const r of recaps) counts[normalizeStatus(r.status)]++;
    return counts;
  }, [recaps]);

  // Brand dropdown options — distinct brands present in the loaded recaps,
  // keyed by brand_id, labelled by brand.name, sorted A–Z.
  const brandOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recaps) {
      if (r.brand?.id) map.set(r.brand.id, r.brand.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [recaps]);

  // Filtered results
  const filtered = useMemo(() => {
    return recaps.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.client_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = normalizeStatus(r.status) === statusTab;
      const matchesBrand = brandFilter === 'all' || r.brand?.id === brandFilter;
      return matchesSearch && matchesStatus && matchesBrand;
    });
  }, [recaps, searchTerm, statusTab, brandFilter]);

  // Sorted view of the filtered list
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case 'oldest':
        return list.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'az':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'brand':
        return list.sort((a, b) => {
          const brandCmp = (a.brand?.name || '').localeCompare(b.brand?.name || '');
          if (brandCmp !== 0) return brandCmp;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'newest':
      default:
        return list.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [filtered, sortBy]);

  // Archive tab: group the visible archived recaps under brand headers,
  // preserving the active sort order within each group, groups A–Z.
  const archiveGroups = useMemo(() => {
    if (statusTab !== 'archived') return [];
    const groups = new Map<
      string,
      { key: string; name: string; logo: string | null; color: string; recaps: CampaignRecap[] }
    >();
    for (const r of sorted) {
      const key = r.brand?.id || `client:${r.client_name}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: r.brand?.name || r.client_name,
          logo: r.brand?.logo_url || r.client_logo_url,
          color: r.brand?.primary_color || '#D73F09',
          recaps: [],
        });
      }
      groups.get(key)!.recaps.push(r);
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [statusTab, sorted]);

  // Optimistically flip a recap's status, then persist. Revert on error.
  async function setRecapStatus(recap: CampaignRecap, newStatus: RecapStatus) {
    const prevStatus = recap.status;
    setRecaps((rs) => rs.map((r) => (r.id === recap.id ? { ...r, status: newStatus } : r)));
    const supabase = createBrowserSupabase();
    const { error } = await supabase
      .from('campaign_recaps')
      .update({ status: newStatus })
      .eq('id', recap.id);
    if (error) {
      setRecaps((rs) => rs.map((r) => (r.id === recap.id ? { ...r, status: prevStatus } : r)));
      alert(
        `Failed to ${newStatus === 'archived' ? 'archive' : 'unarchive'} "${recap.name}": ${error.message}`
      );
    }
  }

  const handleArchive = (r: CampaignRecap) => setRecapStatus(r, 'archived');
  const handleUnarchive = (r: CampaignRecap) => setRecapStatus(r, 'published');

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

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 border-b border-white/[0.06]">
        {([
          { value: 'published', label: 'Published' },
          { value: 'draft', label: 'Drafts' },
          { value: 'archived', label: 'Archive' },
        ] as const).map((tab) => {
          const active = statusTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? 'text-[#D73F09]' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                  active
                    ? 'bg-[#D73F09]/15 border-[#D73F09]/30 text-[#D73F09]'
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                {statusCounts[tab.value]}
              </span>
              {active && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#D73F09] rounded-full" />
              )}
            </button>
          );
        })}
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
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-[#D73F09]/50 transition-colors [&>option]:bg-[#111] [&>option]:text-white"
        >
          <option value="all">All brands</option>
          {brandOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-[#D73F09]/50 transition-colors [&>option]:bg-[#111] [&>option]:text-white"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="az">A–Z</option>
          <option value="brand">By brand</option>
        </select>
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

      {/* Results grid — flat for Published/Drafts */}
      {!loading && sorted.length > 0 && statusTab !== 'archived' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((recap) => (
            <RecapCard
              key={recap.id}
              recap={recap}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
            />
          ))}
        </div>
      )}

      {/* Archive tab — grouped under brand headers */}
      {!loading && sorted.length > 0 && statusTab === 'archived' && (
        <div className="space-y-10">
          {archiveGroups.map((group) => (
            <section key={group.key}>
              {/* Brand header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/[0.06]">
                {group.logo ? (
                  <img
                    src={group.logo}
                    alt={group.name}
                    className="w-8 h-8 object-contain rounded"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${group.color}20` }}
                  >
                    <span className="text-[10px] font-bold" style={{ color: group.color }}>
                      {group.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <h2 className="d text-2xl text-white leading-none">{group.name}</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">
                  {group.recaps.length}
                </span>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.recaps.map((recap) => (
                  <RecapCard
                    key={recap.id}
                    recap={recap}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sorted.length === 0 && (
        <div className="text-center py-16">
          <div className="text-white/20 text-lg font-semibold mb-2">
            {searchTerm || brandFilter !== 'all'
              ? 'No matching recaps found'
              : `No ${statusTab === 'draft' ? 'drafts' : statusTab === 'archived' ? 'archived recaps' : 'published recaps'} yet`}
          </div>
          <p className="text-sm text-white/15">
            {searchTerm || brandFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : statusTab === 'archived'
              ? 'Archived recaps leave the public site but stay in the brand portal'
              : 'Campaign recaps will appear here as campaigns are completed'}
          </p>
        </div>
      )}
    </DashboardContent>
  );
}
