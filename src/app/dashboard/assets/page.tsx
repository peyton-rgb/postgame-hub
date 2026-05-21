// ============================================================
// Final Assets Dashboard — /dashboard/assets
//
// The last mile. Every approved, exported piece of content
// lands here as a final asset — video, photo, or graphic.
// From here, the Postgame team can:
//   - Browse and filter all final deliverables
//   - View full previews and metadata
//   - Create delivery packages for athletes
//   - Copy delivery links and track posting status
//   - Archive completed assets
//
// Layout: tab bar + card grid + slide-in detail panel
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

interface FinalAsset {
  id: string;
  created_at: string;
  updated_at: string;
  campaign_id: string | null;
  review_session_id: string | null;
  concept_id: string | null;
  creator_brief_id: string | null;
  title: string;
  asset_type: 'video' | 'photo' | 'graphic';
  file_url: string;
  thumbnail_url: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  athlete_name: string | null;
  brand_name: string | null;
  tags: string[];
  notes: string | null;
  status: 'ready' | 'delivered' | 'posted' | 'archived';
  delivered_at: string | null;
  delivered_to: string | null;
  created_by: string | null;
}

interface PostingPackage {
  id: string;
  delivery_token: string;
  status: string;
  sent_at: string | null;
  confirmed_at: string | null;
  posted_at: string | null;
  live_url: string | null;
  athlete_name: string;
}

// --- Constants ---

type StatusTab = 'all' | 'ready' | 'delivered' | 'posted' | 'archived';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'posted', label: 'Posted' },
  { key: 'archived', label: 'Archived' },
];

const ASSET_TYPE_COLORS: Record<string, string> = {
  video: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  photo: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
  graphic: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
};

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-green-600/20 text-green-300 border-green-600/30',
  delivered: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  posted: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
  archived: 'bg-gray-600/20 text-gray-300 border-gray-600/30',
};

// --- Helpers ---

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- Asset Type Icons (SVG inline) ---

function VideoIcon() {
  return (
    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
    </svg>
  );
}

function GraphicIcon() {
  return (
    <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
    </svg>
  );
}

function AssetTypeIcon({ type }: { type: string }) {
  if (type === 'video') return <VideoIcon />;
  if (type === 'photo') return <PhotoIcon />;
  return <GraphicIcon />;
}

// ============================================================
// Main Component
// ============================================================

export default function FinalAssetsPage() {
  const supabase = createBrowserSupabase();

  // --- State ---
  const [assets, setAssets] = useState<FinalAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [selectedAsset, setSelectedAsset] = useState<FinalAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);

  // Delivery state
  const [delivering, setDelivering] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<{ delivery_url: string; delivery_token: string } | null>(null);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryFormData, setDeliveryFormData] = useState({
    caption_short: '',
    caption_medium: '',
    caption_long: '',
    hashtags: '',
    mentions: '',
    platform_notes: '',
    ftc_note: '',
    posting_window_start: '',
    posting_window_end: '',
    am_notes: '',
  });

  // Related posting package for selected asset
  const [relatedPackage, setRelatedPackage] = useState<PostingPackage | null>(null);

  // Copied link indicator
  const [copiedLink, setCopiedLink] = useState(false);

  // --- Fetch assets ---
  const fetchAssets = useCallback(async (currentOffset = 0) => {
    setLoading(true);

    const params = new URLSearchParams();
    if (activeTab !== 'all') params.set('status', activeTab);
    if (searchQuery) params.set('q', searchQuery);
    params.set('limit', String(LIMIT));
    params.set('offset', String(currentOffset));

    try {
      const res = await fetch(`/api/assets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    }

    setLoading(false);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    setOffset(0);
    fetchAssets(0);
  }, [fetchAssets]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {}, 400);
  };

  // Pagination
  const handleNextPage = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchAssets(newOffset);
  };

  const handlePrevPage = () => {
    const newOffset = Math.max(0, offset - LIMIT);
    setOffset(newOffset);
    fetchAssets(newOffset);
  };

  // --- Fetch related posting package for selected asset ---
  useEffect(() => {
    if (!selectedAsset) {
      setRelatedPackage(null);
      return;
    }

    const fetchPackage = async () => {
      const { data } = await supabase
        .from('posting_packages')
        .select('*')
        .eq('campaign_id', selectedAsset.campaign_id)
        .eq('athlete_name', selectedAsset.athlete_name || '')
        .order('created_at', { ascending: false })
        .limit(1);

      setRelatedPackage(data && data.length > 0 ? data[0] : null);
    };

    if (selectedAsset.status !== 'ready') {
      fetchPackage();
    } else {
      setRelatedPackage(null);
    }
  }, [selectedAsset, supabase]);

  // --- Deliver asset ---
  const handleDeliver = async () => {
    if (!selectedAsset) return;
    setDelivering(true);

    try {
      const body: Record<string, unknown> = {};
      if (deliveryFormData.caption_short) body.caption_short = deliveryFormData.caption_short;
      if (deliveryFormData.caption_medium) body.caption_medium = deliveryFormData.caption_medium;
      if (deliveryFormData.caption_long) body.caption_long = deliveryFormData.caption_long;
      if (deliveryFormData.hashtags) body.hashtags = deliveryFormData.hashtags.split(',').map((h: string) => h.trim()).filter(Boolean);
      if (deliveryFormData.mentions) body.mentions = deliveryFormData.mentions.split(',').map((m: string) => m.trim()).filter(Boolean);
      if (deliveryFormData.platform_notes) body.platform_notes = deliveryFormData.platform_notes;
      if (deliveryFormData.ftc_note) body.ftc_note = deliveryFormData.ftc_note;
      if (deliveryFormData.posting_window_start) body.posting_window_start = deliveryFormData.posting_window_start;
      if (deliveryFormData.posting_window_end) body.posting_window_end = deliveryFormData.posting_window_end;
      if (deliveryFormData.am_notes) body.am_notes = deliveryFormData.am_notes;

      const res = await fetch(`/api/assets/${selectedAsset.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setDeliveryResult({ delivery_url: data.delivery_url, delivery_token: data.delivery_token });
        setSelectedAsset((prev) => prev ? { ...prev, status: 'delivered', delivered_at: new Date().toISOString() } : null);
        setShowDeliveryForm(false);
        fetchAssets(offset);
      }
    } catch (err) {
      console.error('Failed to deliver asset:', err);
    }

    setDelivering(false);
  };

  // --- Archive asset ---
  const handleArchive = async () => {
    if (!selectedAsset) return;

    try {
      const res = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (res.ok) {
        setSelectedAsset((prev) => prev ? { ...prev, status: 'archived' } : null);
        fetchAssets(offset);
      }
    } catch (err) {
      console.error('Failed to archive asset:', err);
    }
  };

  // --- Copy delivery link ---
  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/deliver/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // --- Add asset form ---
  const [addForm, setAddForm] = useState({
    title: '',
    asset_type: 'video' as 'video' | 'photo' | 'graphic',
    file_url: '',
    thumbnail_url: '',
    athlete_name: '',
    brand_name: '',
    notes: '',
    tags: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  const handleAddAsset = async () => {
    if (!addForm.title || !addForm.file_url) return;
    setAddLoading(true);

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          tags: addForm.tags ? addForm.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setAddForm({ title: '', asset_type: 'video', file_url: '', thumbnail_url: '', athlete_name: '', brand_name: '', notes: '', tags: '' });
        fetchAssets(0);
      }
    } catch (err) {
      console.error('Failed to add asset:', err);
    }

    setAddLoading(false);
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Final Assets</h1>
            <p className="text-sm text-gray-400 mt-1">
              Approved content ready for athlete delivery
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            + Add Asset
          </button>
        </div>
      </div>

      {/* Tab Bar + Search */}
      <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-64 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
        />
      </div>

      {/* Content area — grid + detail panel */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* Card Grid */}
        <div className={`flex-1 overflow-y-auto p-6 transition-all ${selectedAsset ? 'mr-[480px]' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading assets...</div>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              <p className="text-gray-400 font-medium">No final assets yet</p>
              <p className="text-gray-600 text-sm mt-1">
                Approved content from the review process appears here
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => {
                      setSelectedAsset(asset);
                      setDeliveryResult(null);
                      setShowDeliveryForm(false);
                    }}
                    className={`text-left rounded-xl border transition-all hover:border-white/20 overflow-hidden ${
                      selectedAsset?.id === asset.id
                        ? 'border-white/30 bg-white/10'
                        : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-white/5 flex items-center justify-center overflow-hidden">
                      {asset.thumbnail_url ? (
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <AssetTypeIcon type={asset.asset_type} />
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-3 space-y-2">
                      <p className="font-medium text-sm truncate">{asset.title}</p>

                      {(asset.athlete_name || asset.brand_name) && (
                        <p className="text-xs text-gray-400 truncate">
                          {[asset.athlete_name, asset.brand_name].filter(Boolean).join(' / ')}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${ASSET_TYPE_COLORS[asset.asset_type]}`}>
                          {asset.asset_type}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[asset.status]}`}>
                          {asset.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        {asset.file_size_bytes && (
                          <span>{formatFileSize(asset.file_size_bytes)}</span>
                        )}
                        {asset.asset_type === 'video' && asset.duration_seconds && (
                          <span>{formatDuration(asset.duration_seconds)}</span>
                        )}
                        <span>{formatDate(asset.created_at)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {total > LIMIT && (
                <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
                  <button
                    onClick={handlePrevPage}
                    disabled={offset === 0}
                    className="px-3 py-1.5 rounded-lg border border-white/10 disabled:opacity-30 hover:bg-white/5"
                  >
                    Previous
                  </button>
                  <span>
                    {offset + 1}--{Math.min(offset + LIMIT, total)} of {total}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={offset + LIMIT >= total}
                    className="px-3 py-1.5 rounded-lg border border-white/10 disabled:opacity-30 hover:bg-white/5"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Panel — slides in from right */}
        {selectedAsset && (
          <div className="fixed right-0 top-0 h-full w-[480px] bg-[#111] border-l border-white/10 overflow-y-auto z-40">
            {/* Close button */}
            <div className="sticky top-0 bg-[#111] border-b border-white/10 px-5 py-3 flex items-center justify-between z-10">
              <h3 className="font-semibold truncate pr-4">{selectedAsset.title}</h3>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Preview */}
              <div className="rounded-xl overflow-hidden bg-black">
                {selectedAsset.asset_type === 'video' ? (
                  <video
                    src={selectedAsset.file_url}
                    controls
                    className="w-full"
                    poster={selectedAsset.thumbnail_url || undefined}
                  />
                ) : (
                  <img
                    src={selectedAsset.file_url}
                    alt={selectedAsset.title}
                    className="w-full"
                  />
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${ASSET_TYPE_COLORS[selectedAsset.asset_type]}`}>
                  {selectedAsset.asset_type}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[selectedAsset.status]}`}>
                  {selectedAsset.status}
                </span>
              </div>

              {/* Metadata */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedAsset.athlete_name && (
                    <div>
                      <p className="text-gray-500 text-xs">Athlete</p>
                      <p>{selectedAsset.athlete_name}</p>
                    </div>
                  )}
                  {selectedAsset.brand_name && (
                    <div>
                      <p className="text-gray-500 text-xs">Brand</p>
                      <p>{selectedAsset.brand_name}</p>
                    </div>
                  )}
                  {selectedAsset.file_size_bytes && (
                    <div>
                      <p className="text-gray-500 text-xs">File Size</p>
                      <p>{formatFileSize(selectedAsset.file_size_bytes)}</p>
                    </div>
                  )}
                  {selectedAsset.duration_seconds && (
                    <div>
                      <p className="text-gray-500 text-xs">Duration</p>
                      <p>{formatDuration(selectedAsset.duration_seconds)}</p>
                    </div>
                  )}
                  {selectedAsset.width && selectedAsset.height && (
                    <div>
                      <p className="text-gray-500 text-xs">Dimensions</p>
                      <p>{selectedAsset.width} x {selectedAsset.height}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500 text-xs">Created</p>
                    <p>{formatDateTime(selectedAsset.created_at)}</p>
                  </div>
                  {selectedAsset.delivered_at && (
                    <div>
                      <p className="text-gray-500 text-xs">Delivered</p>
                      <p>{formatDateTime(selectedAsset.delivered_at)}</p>
                    </div>
                  )}
                  {selectedAsset.created_by && (
                    <div>
                      <p className="text-gray-500 text-xs">Created By</p>
                      <p className="truncate">{selectedAsset.created_by}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAsset.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedAsset.notes && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</h4>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedAsset.notes}</p>
                </div>
              )}

              {/* Delivery Status Tracking */}
              {relatedPackage && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Delivery Tracking</h4>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        relatedPackage.status === 'posted' ? 'bg-purple-400' :
                        relatedPackage.status === 'confirmed' ? 'bg-green-400' :
                        'bg-blue-400'
                      }`} />
                      <span className="text-sm font-medium capitalize">{relatedPackage.status}</span>
                    </div>

                    {relatedPackage.sent_at && (
                      <div className="text-xs text-gray-400">
                        Sent: {formatDateTime(relatedPackage.sent_at)}
                      </div>
                    )}
                    {relatedPackage.confirmed_at && (
                      <div className="text-xs text-green-400">
                        Confirmed: {formatDateTime(relatedPackage.confirmed_at)}
                      </div>
                    )}
                    {relatedPackage.posted_at && (
                      <div className="text-xs text-purple-400">
                        Posted: {formatDateTime(relatedPackage.posted_at)}
                      </div>
                    )}
                    {relatedPackage.live_url && (
                      <a
                        href={relatedPackage.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline break-all"
                      >
                        {relatedPackage.live_url}
                      </a>
                    )}

                    {/* Copy delivery link */}
                    <button
                      onClick={() => handleCopyLink(relatedPackage.delivery_token)}
                      className="w-full mt-2 px-3 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                    >
                      {copiedLink ? 'Copied!' : 'Copy Delivery Link'}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {/* Create Delivery Package (only for ready assets) */}
                {selectedAsset.status === 'ready' && !showDeliveryForm && !deliveryResult && (
                  <button
                    onClick={() => setShowDeliveryForm(true)}
                    className="w-full px-4 py-2.5 rounded-lg bg-white text-black font-medium text-sm hover:bg-gray-200 transition-colors"
                  >
                    Create Delivery Package
                  </button>
                )}

                {/* Delivery Form */}
                {showDeliveryForm && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                    <h4 className="font-medium text-sm">Delivery Package Details</h4>
                    <p className="text-xs text-gray-400">Optional — fill in what you have. You can always update later.</p>

                    <div className="space-y-2">
                      <label className="block text-xs text-gray-400">Short Caption</label>
                      <textarea
                        rows={2}
                        value={deliveryFormData.caption_short}
                        onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, caption_short: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none focus:outline-none focus:border-white/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs text-gray-400">Medium Caption</label>
                      <textarea
                        rows={3}
                        value={deliveryFormData.caption_medium}
                        onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, caption_medium: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none focus:outline-none focus:border-white/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs text-gray-400">Long Caption</label>
                      <textarea
                        rows={4}
                        value={deliveryFormData.caption_long}
                        onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, caption_long: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none focus:outline-none focus:border-white/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="block text-xs text-gray-400">Hashtags (comma-separated)</label>
                        <input
                          type="text"
                          value={deliveryFormData.hashtags}
                          onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, hashtags: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                          placeholder="#brand, #athlete"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs text-gray-400">Mentions (comma-separated)</label>
                        <input
                          type="text"
                          value={deliveryFormData.mentions}
                          onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, mentions: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                          placeholder="@brand, @postgame"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs text-gray-400">Platform Notes</label>
                      <input
                        type="text"
                        value={deliveryFormData.platform_notes}
                        onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, platform_notes: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                        placeholder="Post to Instagram Reels and TikTok"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs text-gray-400">FTC Disclosure Note</label>
                      <input
                        type="text"
                        value={deliveryFormData.ftc_note}
                        onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, ftc_note: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                        placeholder="Must include #ad or #sponsored"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="block text-xs text-gray-400">Post Window Start</label>
                        <input
                          type="datetime-local"
                          value={deliveryFormData.posting_window_start}
                          onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, posting_window_start: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs text-gray-400">Post Window End</label>
                        <input
                          type="datetime-local"
                          value={deliveryFormData.posting_window_end}
                          onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, posting_window_end: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs text-gray-400">AM Notes (internal, shown to athlete)</label>
                      <textarea
                        rows={2}
                        value={deliveryFormData.am_notes}
                        onChange={(e) => setDeliveryFormData((prev) => ({ ...prev, am_notes: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none focus:outline-none focus:border-white/20"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleDeliver}
                        disabled={delivering}
                        className="flex-1 px-4 py-2 rounded-lg bg-white text-black font-medium text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {delivering ? 'Creating...' : 'Create & Send'}
                      </button>
                      <button
                        onClick={() => setShowDeliveryForm(false)}
                        className="px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delivery Result */}
                {deliveryResult && (
                  <div className="rounded-xl border border-green-600/30 bg-green-600/10 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium text-sm text-green-300">Delivery Package Created</span>
                    </div>
                    <button
                      onClick={() => handleCopyLink(deliveryResult.delivery_token)}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 text-sm text-white hover:bg-white/15 transition-colors"
                    >
                      {copiedLink ? 'Copied!' : 'Copy Athlete Delivery Link'}
                    </button>
                  </div>
                )}

                {/* Archive button */}
                {selectedAsset.status !== 'archived' && (
                  <button
                    onClick={handleArchive}
                    className="w-full px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Final Asset</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                  placeholder="Nike x Athlete Name — IG Reel"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Asset Type *</label>
                <select
                  value={addForm.asset_type}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, asset_type: e.target.value as 'video' | 'photo' | 'graphic' }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                >
                  <option value="video">Video</option>
                  <option value="photo">Photo</option>
                  <option value="graphic">Graphic</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">File URL *</label>
                <input
                  type="text"
                  value={addForm.file_url}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, file_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                  placeholder="https://storage.example.com/video.mp4"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Thumbnail URL</label>
                <input
                  type="text"
                  value={addForm.thumbnail_url}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, thumbnail_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                  placeholder="https://storage.example.com/thumb.jpg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Athlete Name</label>
                  <input
                    type="text"
                    value={addForm.athlete_name}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, athlete_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={addForm.brand_name}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, brand_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={addForm.tags}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, tags: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20"
                  placeholder="reel, bts, nike"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={addForm.notes}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none focus:outline-none focus:border-white/20"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddAsset}
                disabled={addLoading || !addForm.title || !addForm.file_url}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white text-black font-medium text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {addLoading ? 'Adding...' : 'Add Asset'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
