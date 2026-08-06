// ============================================================
// Inspo Library — /dashboard/inspo
//
// The Creative Brain's visual memory. Browse, search, and
// filter every tagged asset in Postgame's library. Assets
// flow here after being uploaded and tagged in Station 1
// (the Intake page). From here, assets get pulled into
// concept generation and creator briefs by the AI agents.
//
// Features:
//   - Masonry-style grid of thumbnails
//   - Free-text search + tag/vibe/sport/content type filters
//   - Detail panel showing all 13 tag categories + metadata
//   - "Re-tag" button to re-run Claude Vision on an item
//   - Hero toggle to mark standout assets
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { InspoItem, ContentType, TaggingStatus } from '@/lib/types/intake';

// --- Display helpers ---

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  produced: 'Produced',
  athlete_ugc: 'Athlete UGC',
  bts: 'BTS',
  raw_footage: 'Raw Footage',
  photography: 'Photography',
  talking_head: 'Talking Head',
  inspo_external: 'External Inspo',
};

const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  produced: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  athlete_ugc: 'bg-green-600/20 text-green-300 border-green-600/30',
  bts: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30',
  raw_footage: 'bg-[#D73F09]/20 text-[#e8663d] border-[#D73F09]/30',
  photography: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
  talking_head: 'bg-pink-600/20 text-pink-300 border-pink-600/30',
  inspo_external: 'bg-gray-600/20 text-gray-300 border-gray-600/30',
};

// Triage status → pill styling. Green = approved (money green, already used in
// the Hub), Postgame orange = pending (the attention accent — "needs review"),
// neutral frosted = rejected (deliberately NOT a red; the design system defines
// no red and forbids introducing one without sign-off).
const TRIAGE_PILL: Record<string, { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'bg-green-600/20 text-green-300 border-green-600/30' },
  pending: { label: 'Pending', className: 'bg-[#D73F09]/20 text-[#e8663d] border-[#D73F09]/30' },
  rejected: { label: 'Rejected', className: 'bg-white/10 text-gray-400 border-white/10' },
};

function triagePill(status: string | null): { label: string; className: string } {
  return (
    (status && TRIAGE_PILL[status]) || {
      label: status || 'Untriaged',
      className: 'bg-white/10 text-gray-400 border-white/10',
    }
  );
}

// Tag category labels for the detail panel
const TAG_CATEGORIES = {
  pro_tags: {
    label: 'Production Tags',
    fields: {
      camera_movement: 'Camera Movement',
      lighting: 'Lighting',
      lens_shot_type: 'Shot Type',
      grade_post_style: 'Color/Grade',
    },
  },
  social_tags: {
    label: 'Social Tags',
    fields: {
      trend_format: 'Trend Format',
      platform_feel: 'Platform Feel',
      audience_energy: 'Audience Energy',
    },
  },
  context_tags: {
    label: 'Context Tags',
    fields: {
      sport: 'Sport',
      setting: 'Setting',
      product_category: 'Product',
      athlete_identity: 'Athlete Identity',
      content_purpose: 'Content Purpose',
    },
  },
};

export default function InspoLibraryPage() {
  const supabase = createBrowserSupabase();

  // --- State ---
  const [items, setItems] = useState<InspoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InspoItem | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('');
  const [sportFilter, setSportFilter] = useState('');
  const [vibeFilter, setVibeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('ready');
  // Triage queue filter: '' = all, or pending / approved / rejected.
  const [triageFilter, setTriageFilter] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // Debounce timer for search
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // --- Fetch items from the API ---
  const fetchItems = useCallback(async (currentOffset = 0) => {
    setLoading(true);

    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (contentTypeFilter) params.set('content_type', contentTypeFilter);
    if (sportFilter) params.set('sport', sportFilter);
    if (vibeFilter) params.set('vibe', vibeFilter);
    if (tagFilter) params.set('tag', tagFilter);
    if (statusFilter) params.set('tagging_status', statusFilter);
    if (triageFilter) params.set('triage_status', triageFilter);
    params.set('sort', sortBy);
    params.set('limit', String(LIMIT));
    params.set('offset', String(currentOffset));

    try {
      const res = await fetch(`/api/inspo?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch inspo items:', err);
    }

    setLoading(false);
  }, [searchQuery, contentTypeFilter, sportFilter, vibeFilter, tagFilter, sortBy, statusFilter, triageFilter]);

  // Fetch on mount and when filters change
  useEffect(() => {
    setOffset(0);
    fetchItems(0);
  }, [fetchItems]);

  // Debounced search — waits 400ms after user stops typing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      // fetchItems will be triggered by the useEffect above
    }, 400);
  };

  // --- Pagination ---
  const handleNextPage = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchItems(newOffset);
  };

  const handlePrevPage = () => {
    const newOffset = Math.max(0, offset - LIMIT);
    setOffset(newOffset);
    fetchItems(newOffset);
  };

  // --- Re-tag an item ---
  const [retagging, setRetagging] = useState<string | null>(null);

  const handleRetag = async (itemId: string) => {
    setRetagging(itemId);
    try {
      const res = await fetch('/api/intake/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspo_item_id: itemId }),
      });

      if (res.ok) {
        // Refresh to show new tags
        fetchItems(offset);
        // If this item is selected, refresh it
        if (selectedItem?.id === itemId) {
          const data = await res.json();
          if (data.tags) {
            setSelectedItem((prev) =>
              prev ? { ...prev, ...data.tags, tagging_status: 'tagged' as TaggingStatus } : null
            );
          }
        }
      }
    } catch (err) {
      console.error('Re-tag failed:', err);
    }
    setRetagging(null);
  };

  // --- Toggle hero status ---
  const handleToggleHero = async (item: InspoItem) => {
    const newHero = !item.is_hero;
    try {
      const { error } = await supabase
        .from('inspo_items')
        .update({ is_hero: newHero })
        .eq('id', item.id);

      if (!error) {
        // Update local state
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, is_hero: newHero } : i))
        );
        if (selectedItem?.id === item.id) {
          setSelectedItem((prev) => (prev ? { ...prev, is_hero: newHero } : null));
        }
      }
    } catch (err) {
      console.error('Failed to toggle hero:', err);
    }
  };

  // --- Triage: approve / reject ---
  // Mirrors handleToggleHero exactly — a direct client-side inspo_items update
  // (the "Auth users full access" RLS policy permits it), local state updated on
  // success. When a triage filter is active and the new status no longer matches
  // it, the item drops out of the list immediately (total ticks down to match).
  const [triaging, setTriaging] = useState<string | null>(null);

  const handleTriage = async (item: InspoItem, newStatus: 'approved' | 'rejected') => {
    if (item.triage_status === newStatus) return;
    setTriaging(item.id);
    try {
      const { error } = await supabase
        .from('inspo_items')
        .update({ triage_status: newStatus })
        .eq('id', item.id);

      if (error) {
        console.error('Failed to set triage status:', error.message);
      } else {
        const dropsOut = !!triageFilter && triageFilter !== newStatus;
        setItems((prev) =>
          dropsOut
            ? prev.filter((i) => i.id !== item.id)
            : prev.map((i) => (i.id === item.id ? { ...i, triage_status: newStatus } : i))
        );
        if (dropsOut) setTotal((t) => Math.max(0, t - 1));
        setSelectedItem((prev) =>
          prev && prev.id === item.id ? { ...prev, triage_status: newStatus } : prev
        );
      }
    } catch (err) {
      console.error('Failed to set triage status:', err);
    }
    setTriaging(null);
  };

  // --- Format file size ---
  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // --- Format duration ---
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- Tag pill component ---
  const TagPill = ({ label }: { label: string }) => (
    <span
      className="inline-block px-2 py-0.5 text-xs rounded-full bg-white/10 text-gray-300 border border-white/10 cursor-pointer hover:bg-white/20 transition-colors"
      onClick={() => {
        setTagFilter(label);
        setSelectedItem(null);
      }}
    >
      {label.replace(/_/g, ' ')}
    </span>
  );

  // ---- Render ----
  return (
    <div>
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inspo Library</h1>
            <p className="text-sm text-gray-400 mt-1">
              {total} asset{total !== 1 ? 's' : ''} in the Creative Brain
            </p>
          </div>
          <a
            href="/dashboard/intake"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
          >
            + Upload New
          </a>
        </div>

        {/* Search bar */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search assets — try a vibe, sport, athlete name, or description..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-3 mt-3">
          {/* Content type filter */}
          <select
            value={contentTypeFilter}
            onChange={(e) => setContentTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-white/30"
          >
            <option value="">All Types</option>
            {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Sport filter */}
          <input
            type="text"
            placeholder="Sport..."
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-white/30 w-28"
          />

          {/* Vibe filter */}
          <input
            type="text"
            placeholder="Vibe..."
            value={vibeFilter}
            onChange={(e) => setVibeFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-white/30 w-28"
          />

          {/* Tag filter */}
          <input
            type="text"
            placeholder="Tag..."
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-white/30 w-28"
          />

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-white/30"
          >
            <option value="ready">Ready (tagged + complete)</option>
            <option value="tagged">Tagged</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="reviewed">Reviewed</option>
          </select>

          {/* Triage filter — work the approval queue */}
          <select
            value={triageFilter}
            onChange={(e) => setTriageFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-white/30"
          >
            <option value="">All Triage</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-white/30"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="hero_first">Heroes First</option>
          </select>

          {/* Clear filters */}
          {(searchQuery || contentTypeFilter || sportFilter || vibeFilter || tagFilter || triageFilter || statusFilter !== 'ready' || sortBy !== 'newest') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setContentTypeFilter('');
                setSportFilter('');
                setVibeFilter('');
                setTagFilter('');
                setTriageFilter('');
                setStatusFilter('ready');
                setSortBy('newest');
              }}
              className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex">
        {/* Grid */}
        <div className={`flex-1 p-6 ${selectedItem ? 'pr-3' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-gray-400">Loading assets...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">
                {statusFilter === 'ready' || statusFilter === 'tagged' ? 'No assets yet' : 'No assets found'}
              </h3>
              <p className="text-sm text-gray-500 max-w-md">
                {statusFilter === 'ready' || statusFilter === 'tagged'
                  ? 'Upload footage on the Intake page and tag it with Claude Vision. Tagged assets appear here automatically.'
                  : 'Try adjusting your filters or search query.'}
              </p>
              {(statusFilter === 'ready' || statusFilter === 'tagged') && (
                <a
                  href="/dashboard/intake"
                  className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                >
                  Go to Intake
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Asset grid — responsive columns */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`group relative rounded-lg overflow-hidden cursor-pointer border transition-all ${
                      selectedItem?.id === item.id
                        ? 'border-white/40 ring-1 ring-white/20'
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[4/3] bg-white/5 relative">
                      {(item.thumbnail_url || item.file_url) ? (
                        item.mime_type?.startsWith('video/') ? (
                          item.thumbnail_url ? (
                            <img
                              src={item.thumbnail_url}
                              alt={item.visual_description || 'Video thumbnail'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                              <span className="text-3xl">🎬</span>
                            </div>
                          )
                        ) : (
                          <img
                            src={item.file_url || item.thumbnail_url || ''}
                            alt={item.visual_description || 'Asset'}
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          <span className="text-2xl">📁</span>
                        </div>
                      )}

                      {/* Video duration overlay */}
                      {item.duration_seconds && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded">
                          {formatDuration(item.duration_seconds)}
                        </span>
                      )}

                      {/* Hero star */}
                      {item.is_hero && (
                        <span className="absolute top-1 right-1 text-yellow-400 text-sm">★</span>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <p className="text-xs text-white line-clamp-2">
                          {item.visual_description || item.athlete_name || CONTENT_TYPE_LABELS[item.content_type]}
                        </p>
                      </div>
                    </div>

                    {/* Bottom strip */}
                    <div className="p-2 bg-white/[0.02]">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded border ${CONTENT_TYPE_COLORS[item.content_type]}`}>
                          {CONTENT_TYPE_LABELS[item.content_type]}
                        </span>
                        {item.sport && (
                          <span className="text-[10px] text-gray-500">{item.sport}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
                <span>
                  Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={offset === 0}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg disabled:opacity-30 hover:bg-white/10 transition-colors"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={offset + LIMIT >= total}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg disabled:opacity-30 hover:bg-white/10 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail panel — slides in from right */}
        {selectedItem && (
          <div className="w-[420px] border-l border-white/10 bg-white/[0.02] overflow-y-auto max-h-[calc(100vh-200px)] sticky top-0">
            <div className="p-4">
              {/* Close button */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Asset Detail</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Preview */}
              <div className="rounded-lg overflow-hidden bg-black mb-4">
                {selectedItem.mime_type?.startsWith('video/') ? (
                  selectedItem.file_url ? (
                    <video
                      src={selectedItem.file_url}
                      controls
                      className="w-full"
                      poster={selectedItem.thumbnail_url || undefined}
                    />
                  ) : selectedItem.thumbnail_url ? (
                    <img src={selectedItem.thumbnail_url} alt="" className="w-full" />
                  ) : (
                    <div className="aspect-video flex items-center justify-center text-gray-500">🎬</div>
                  )
                ) : (
                  <img
                    src={selectedItem.file_url || selectedItem.thumbnail_url || ''}
                    alt={selectedItem.visual_description || ''}
                    className="w-full"
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleRetag(selectedItem.id)}
                  disabled={retagging === selectedItem.id}
                  className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {retagging === selectedItem.id ? 'Re-tagging...' : '🔄 Re-tag'}
                </button>
                <button
                  onClick={() => handleToggleHero(selectedItem)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedItem.is_hero
                      ? 'bg-yellow-600/20 text-yellow-300 border border-yellow-600/30 hover:bg-yellow-600/30'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {selectedItem.is_hero ? '★ Hero' : '☆ Mark Hero'}
                </button>
              </div>

              {/* Triage — approve makes the asset eligible for vibe search */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Triage
                  </h4>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full border ${
                      triagePill(selectedItem.triage_status).className
                    }`}
                  >
                    {triagePill(selectedItem.triage_status).label}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTriage(selectedItem, 'approved')}
                    disabled={triaging === selectedItem.id}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                      selectedItem.triage_status === 'approved'
                        ? 'bg-green-600/20 text-green-300 border border-green-600/30 hover:bg-green-600/30'
                        : 'bg-white/10 hover:bg-white/20 text-green-300'
                    }`}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleTriage(selectedItem, 'rejected')}
                    disabled={triaging === selectedItem.id}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                      selectedItem.triage_status === 'rejected'
                        ? 'bg-white/15 text-gray-200 border border-white/20 hover:bg-white/20'
                        : 'bg-white/10 hover:bg-white/20 text-gray-400'
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>

              {/* Visual description */}
              {selectedItem.visual_description && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    AI Description
                  </h4>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {selectedItem.visual_description}
                  </p>
                </div>
              )}

              {/* Vibe words */}
              {selectedItem.search_phrases?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Vibe Words
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.search_phrases.map((phrase, i) => (
                      <TagPill key={i} label={phrase} />
                    ))}
                  </div>
                </div>
              )}

              {/* Brief fit */}
              {selectedItem.brief_fit?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Brief Fit
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.brief_fit.map((fit, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-600/10 text-green-300 border border-green-600/20"
                      >
                        {fit.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* All 13 tag categories */}
              {Object.entries(TAG_CATEGORIES).map(([groupKey, group]) => {
                const tagGroup = selectedItem[groupKey as keyof InspoItem] as Record<string, string[]> | undefined;
                if (!tagGroup || typeof tagGroup !== 'object') return null;

                // Check if any tags exist in this group
                const hasAnyTags = Object.values(tagGroup).some(
                  (arr) => Array.isArray(arr) && arr.length > 0
                );
                if (!hasAnyTags) return null;

                return (
                  <div key={groupKey} className="mb-4">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      {group.label}
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(group.fields).map(([fieldKey, fieldLabel]) => {
                        const tags = tagGroup[fieldKey];
                        if (!Array.isArray(tags) || tags.length === 0) return null;
                        return (
                          <div key={fieldKey}>
                            <span className="text-[10px] text-gray-500 block mb-1">
                              {fieldLabel}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {tags.map((tag, i) => (
                                <TagPill key={i} label={tag} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Metadata */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  File Info
                </h4>
                <div className="space-y-1 text-xs text-gray-400">
                  {selectedItem.content_type && (
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="text-gray-300">{CONTENT_TYPE_LABELS[selectedItem.content_type]}</span>
                    </div>
                  )}
                  {selectedItem.mime_type && (
                    <div className="flex justify-between">
                      <span>Format</span>
                      <span className="text-gray-300">{selectedItem.mime_type}</span>
                    </div>
                  )}
                  {selectedItem.file_size_bytes && (
                    <div className="flex justify-between">
                      <span>Size</span>
                      <span className="text-gray-300">{formatSize(selectedItem.file_size_bytes)}</span>
                    </div>
                  )}
                  {selectedItem.duration_seconds && (
                    <div className="flex justify-between">
                      <span>Duration</span>
                      <span className="text-gray-300">{formatDuration(selectedItem.duration_seconds)}</span>
                    </div>
                  )}
                  {selectedItem.athlete_name && (
                    <div className="flex justify-between">
                      <span>Athlete</span>
                      <span className="text-gray-300">{selectedItem.athlete_name}</span>
                    </div>
                  )}
                  {selectedItem.sport && (
                    <div className="flex justify-between">
                      <span>Sport</span>
                      <span className="text-gray-300">{selectedItem.sport}</span>
                    </div>
                  )}
                  {selectedItem.school && (
                    <div className="flex justify-between">
                      <span>School</span>
                      <span className="text-gray-300">{selectedItem.school}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Uploaded</span>
                    <span className="text-gray-300">
                      {new Date(selectedItem.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ID</span>
                    <span className="text-gray-300 font-mono text-[10px]">
                      {selectedItem.id.slice(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
