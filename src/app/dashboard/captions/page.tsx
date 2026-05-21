// ============================================================
// Caption AI Composer — /dashboard/captions
//
// The main caption workspace for Station 4 (Distribution).
// Two-panel layout:
//   Left: Compose panel — channel selector, asset info,
//         AI caption generation, editable variants, hashtags
//   Right: Preview panel — mock phone/post preview
//
// Below: table of existing content queue items with status
// badges and quick actions.
//
// Supports all channels: Instagram, TikTok, LinkedIn, YouTube,
// Twitter/X, Newsletter
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

interface ContentQueueItem {
  id: string;
  created_at: string;
  updated_at: string;
  channel: string;
  caption: string | null;
  hashtags: string[];
  asset_url: string | null;
  asset_urls: string[];
  thumbnail_url: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
  athlete_name: string | null;
  campaign_id: string | null;
  final_asset_id: string | null;
  notes: string | null;
  template_type: string | null;
  inspo_item_ids: string[];
  publish_error: string | null;
}

// --- Channel config ---

const CHANNELS = [
  { key: 'instagram', label: 'Instagram', icon: 'IG', color: 'bg-pink-600' },
  { key: 'tiktok', label: 'TikTok', icon: 'TT', color: 'bg-black border border-white/20' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'LI', color: 'bg-blue-700' },
  { key: 'youtube', label: 'YouTube', icon: 'YT', color: 'bg-red-600' },
  { key: 'twitter/x', label: 'Twitter/X', icon: 'X', color: 'bg-gray-800' },
  { key: 'newsletter', label: 'Newsletter', icon: 'NL', color: 'bg-emerald-700' },
];

// --- Status badges ---

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-gray-600/20 text-gray-300 border-gray-600/30' },
  approved: { label: 'Approved', classes: 'bg-green-600/20 text-green-300 border-green-600/30' },
  scheduled: { label: 'Scheduled', classes: 'bg-blue-600/20 text-blue-300 border-blue-600/30' },
  published: { label: 'Published', classes: 'bg-purple-600/20 text-purple-300 border-purple-600/30' },
  failed: { label: 'Failed', classes: 'bg-red-600/20 text-red-300 border-red-600/30' },
};

export default function CaptionsPage() {
  const supabase = createBrowserSupabase();

  // --- Compose state ---
  const [selectedChannel, setSelectedChannel] = useState('instagram');
  const [assetUrl, setAssetUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [athleteName, setAthleteName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [tone, setTone] = useState('');

  // Generated content
  const [captionShort, setCaptionShort] = useState('');
  const [captionMedium, setCaptionMedium] = useState('');
  const [captionLong, setCaptionLong] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');
  const [ftcNote, setFtcNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Preview state
  const [previewVariant, setPreviewVariant] = useState<'short' | 'medium' | 'long'>('medium');

  // Queue state
  const [queueItems, setQueueItems] = useState<ContentQueueItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // --- Fetch queue items ---
  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    const params = new URLSearchParams({ limit: '50', offset: '0' });
    if (queueFilter !== 'all') params.set('status', queueFilter);

    const res = await fetch(`/api/captions?${params}`);
    if (res.ok) {
      const data = await res.json();
      setQueueItems(data.items || []);
      setTotalItems(data.total || 0);
    }
    setQueueLoading(false);
  }, [queueFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // --- Generate captions ---
  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError('');

    try {
      const res = await fetch('/api/captions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_description: assetDescription,
          channel: selectedChannel,
          athlete_name: athleteName || undefined,
          brand_name: brandName || undefined,
          campaign_name: campaignName || undefined,
          tone: tone || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();
      setCaptionShort(data.captions.short || '');
      setCaptionMedium(data.captions.medium || '');
      setCaptionLong(data.captions.long || '');
      setHashtags(data.hashtags || []);
      setFtcNote(data.ftc_note || '');
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed');
    }

    setGenerating(false);
  };

  // --- Save as draft ---
  const handleSaveDraft = async () => {
    setSaving(true);

    // Combine the selected variant as the main caption
    const captionMap = { short: captionShort, medium: captionMedium, long: captionLong };
    const mainCaption = captionMap[previewVariant] || captionMedium;

    try {
      const res = await fetch('/api/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel,
          caption: mainCaption,
          hashtags,
          asset_url: assetUrl || undefined,
          thumbnail_url: thumbnailUrl || undefined,
          athlete_name: athleteName || undefined,
          notes: `Short: ${captionShort}\n\nMedium: ${captionMedium}\n\nLong: ${captionLong}\n\nFTC: ${ftcNote}`,
        }),
      });

      if (res.ok) {
        resetForm();
        fetchQueue();
      }
    } catch (err) {
      console.error('Failed to save draft:', err);
    }

    setSaving(false);
  };

  // --- Approve & Queue ---
  const handleApproveAndQueue = async () => {
    setSaving(true);

    const captionMap = { short: captionShort, medium: captionMedium, long: captionLong };
    const mainCaption = captionMap[previewVariant] || captionMedium;

    try {
      // Create the item
      const createRes = await fetch('/api/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel,
          caption: mainCaption,
          hashtags,
          asset_url: assetUrl || undefined,
          thumbnail_url: thumbnailUrl || undefined,
          athlete_name: athleteName || undefined,
          notes: `Short: ${captionShort}\n\nMedium: ${captionMedium}\n\nLong: ${captionLong}\n\nFTC: ${ftcNote}`,
        }),
      });

      if (createRes.ok) {
        const item = await createRes.json();
        // Immediately approve it
        await fetch(`/api/captions/${item.id}/approve`, { method: 'POST' });
        resetForm();
        fetchQueue();
      }
    } catch (err) {
      console.error('Failed to approve:', err);
    }

    setSaving(false);
  };

  // --- Approve an existing item ---
  const handleApproveItem = async (itemId: string) => {
    await fetch(`/api/captions/${itemId}/approve`, { method: 'POST' });
    fetchQueue();
  };

  // --- Delete an item ---
  const handleDeleteItem = async (itemId: string) => {
    await fetch(`/api/captions/${itemId}`, { method: 'DELETE' });
    fetchQueue();
  };

  // --- Reset compose form ---
  const resetForm = () => {
    setAssetUrl('');
    setThumbnailUrl('');
    setAssetDescription('');
    setAthleteName('');
    setBrandName('');
    setCampaignName('');
    setTone('');
    setCaptionShort('');
    setCaptionMedium('');
    setCaptionLong('');
    setHashtags([]);
    setNewHashtag('');
    setFtcNote('');
    setGenerateError('');
  };

  // --- Hashtag management ---
  const addHashtag = () => {
    const tag = newHashtag.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
    }
    setNewHashtag('');
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((h) => h !== tag));
  };

  // --- Preview caption text ---
  const getPreviewCaption = () => {
    const map = { short: captionShort, medium: captionMedium, long: captionLong };
    return map[previewVariant] || '';
  };

  // --- Get channel config ---
  const getChannelConfig = (key: string) => {
    return CHANNELS.find((c) => c.key === key) || CHANNELS[0];
  };

  // --- Filter tabs ---
  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'approved', label: 'Approved' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'published', label: 'Published' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Caption AI Composer</h1>
            <p className="text-gray-400 mt-1">
              Generate platform-native captions with Postgame&apos;s voice
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard/publishing"
              className="px-4 py-2 text-sm text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
            >
              Publishing Calendar
            </a>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
          {/* Left: Compose panel (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Channel selector */}
            <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
              <label className="block text-sm text-gray-400 mb-3">Channel</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.key}
                    onClick={() => setSelectedChannel(ch.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition text-sm ${
                      selectedChannel === ch.key
                        ? 'border-orange-600 bg-orange-600/10 text-orange-400'
                        : 'border-gray-700 bg-[#1a1a1a] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full ${ch.color} flex items-center justify-center text-xs font-bold text-white`}>
                      {ch.icon}
                    </span>
                    <span className="truncate w-full text-center">{ch.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Asset + context inputs */}
            <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold">Content Details</h2>

              {/* Asset URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Asset URL</label>
                <input
                  type="text"
                  value={assetUrl}
                  onChange={(e) => setAssetUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-600"
                />
              </div>

              {/* Thumbnail URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Thumbnail URL (optional)</label>
                <input
                  type="text"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-600"
                />
              </div>

              {/* Asset description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Describe the content</label>
                <textarea
                  value={assetDescription}
                  onChange={(e) => setAssetDescription(e.target.value)}
                  placeholder="e.g., Behind-the-scenes video of a basketball player lacing up Nike shoes before a game, locker room setting, cinematic lighting..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-600 resize-none"
                  rows={3}
                />
              </div>

              {/* Row: Athlete + Brand */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Athlete Name</label>
                  <input
                    type="text"
                    value={athleteName}
                    onChange={(e) => setAthleteName(e.target.value)}
                    placeholder="e.g., Jordan Smith"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Brand Name</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g., Nike"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-600"
                  />
                </div>
              </div>

              {/* Row: Campaign + Tone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Campaign Name</label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., Fall NIL Launch"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Tone (optional)</label>
                  <input
                    type="text"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="e.g., hype, chill, professional"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-600"
                  />
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating || !assetDescription.trim()}
                className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition text-center"
              >
                {generating ? 'Generating Captions...' : 'Generate Captions'}
              </button>

              {generateError && (
                <div className="p-3 bg-red-600/10 border border-red-600/30 rounded-lg text-red-400 text-sm">
                  {generateError}
                </div>
              )}
            </div>

            {/* Caption variants */}
            {(captionShort || captionMedium || captionLong) && (
              <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold">Caption Variants</h2>

                {/* Short */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm text-gray-400">Short</label>
                    <span className="text-xs text-gray-600">{captionShort.length} chars</span>
                  </div>
                  <textarea
                    value={captionShort}
                    onChange={(e) => setCaptionShort(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600 resize-none"
                    rows={2}
                  />
                </div>

                {/* Medium */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm text-gray-400">Medium</label>
                    <span className="text-xs text-gray-600">{captionMedium.length} chars</span>
                  </div>
                  <textarea
                    value={captionMedium}
                    onChange={(e) => setCaptionMedium(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600 resize-none"
                    rows={4}
                  />
                </div>

                {/* Long */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm text-gray-400">Long</label>
                    <span className="text-xs text-gray-600">{captionLong.length} chars</span>
                  </div>
                  <textarea
                    value={captionLong}
                    onChange={(e) => setCaptionLong(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600 resize-none"
                    rows={6}
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Hashtags</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 border border-blue-600/30 rounded-full text-blue-300 text-sm"
                      >
                        #{tag}
                        <button
                          onClick={() => removeHashtag(tag)}
                          className="text-blue-400 hover:text-white ml-0.5"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newHashtag}
                      onChange={(e) => setNewHashtag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                      placeholder="Add hashtag..."
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-600 text-sm"
                    />
                    <button
                      onClick={addHashtag}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* FTC Note */}
                {ftcNote && (
                  <div className="p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                    <p className="text-xs text-yellow-300 font-medium mb-1">FTC Disclosure</p>
                    <p className="text-sm text-yellow-200">{ftcNote}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="flex-1 px-5 py-2.5 border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg font-medium transition text-center"
                  >
                    {saving ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    onClick={handleApproveAndQueue}
                    disabled={saving}
                    className="flex-1 px-5 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition text-center"
                  >
                    {saving ? 'Saving...' : 'Approve & Queue'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Preview panel (2 cols) */}
          <div className="lg:col-span-2">
            <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Preview</h2>
                {/* Variant toggle */}
                {(captionShort || captionMedium || captionLong) && (
                  <div className="flex gap-1">
                    {(['short', 'medium', 'long'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setPreviewVariant(v)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                          previewVariant === v
                            ? 'bg-orange-600/20 text-orange-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone mockup */}
              <div className="bg-black rounded-2xl border-2 border-gray-700 overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${getChannelConfig(selectedChannel).color} flex items-center justify-center text-[10px] font-bold text-white`}>
                      {getChannelConfig(selectedChannel).icon}
                    </div>
                    <span className="text-xs font-medium text-gray-300">
                      {getChannelConfig(selectedChannel).label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-600">Preview</span>
                </div>

                {/* Asset preview */}
                <div className="aspect-square bg-gray-900 flex items-center justify-center">
                  {thumbnailUrl || assetUrl ? (
                    <img
                      src={thumbnailUrl || assetUrl}
                      alt="Asset preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <div className="text-3xl mb-2 text-gray-600">&#9654;</div>
                      <p className="text-xs text-gray-600">Asset preview</p>
                    </div>
                  )}
                </div>

                {/* Caption preview */}
                <div className="p-4">
                  {getPreviewCaption() ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-gray-700" />
                        <span className="text-xs font-semibold text-gray-300">
                          {athleteName || 'athlete'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                        {getPreviewCaption()}
                      </p>
                      {hashtags.length > 0 && (
                        <p className="text-xs text-blue-400 mt-2">
                          {hashtags.map((h) => `#${h}`).join(' ')}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-600 text-center py-4">
                      Generate captions to see a preview
                    </p>
                  )}
                </div>
              </div>

              {/* Character count */}
              {getPreviewCaption() && (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{getPreviewCaption().length} characters</span>
                  <span className="capitalize">{previewVariant} variant</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Queue table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Content Queue</h2>
            <span className="text-sm text-gray-500">{totalItems} items</span>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setQueueFilter(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  queueFilter === tab.key
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/30'
                    : 'text-gray-400 border border-gray-800 hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Queue items */}
          {queueLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-500">Loading queue...</p>
            </div>
          ) : queueItems.length === 0 ? (
            <div className="text-center py-16 border border-gray-800 rounded-xl bg-[#141414]">
              <div className="text-4xl mb-3 text-gray-700">&#9997;</div>
              <p className="text-gray-400 font-medium">No items in the queue</p>
              <p className="text-gray-600 text-sm mt-1">
                Generate captions above to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queueItems.map((item) => {
                const channelConfig = getChannelConfig(item.channel);
                const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                const isExpanded = expandedItem === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden"
                  >
                    {/* Item row */}
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition"
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden">
                        {item.thumbnail_url || item.asset_url ? (
                          <img
                            src={item.thumbnail_url || item.asset_url || ''}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-lg">
                            &#128247;
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">
                          {item.caption || 'No caption'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.athlete_name && (
                            <span className="text-xs text-gray-500">{item.athlete_name}</span>
                          )}
                          {item.scheduled_for && (
                            <span className="text-xs text-gray-600">
                              Scheduled: {new Date(item.scheduled_for).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Channel badge */}
                      <span className={`w-7 h-7 rounded-full ${channelConfig.color} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                        {channelConfig.icon}
                      </span>

                      {/* Status badge */}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.classes}`}>
                        {statusConfig.label}
                      </span>

                      {/* Expand chevron */}
                      <span className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        &#9660;
                      </span>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-gray-800 p-4 bg-[#0f0f0f]">
                        {/* Full caption */}
                        {item.caption && (
                          <div className="mb-4">
                            <p className="text-xs text-gray-500 mb-1">Caption</p>
                            <p className="text-sm text-gray-300 whitespace-pre-line">{item.caption}</p>
                          </div>
                        )}

                        {/* Hashtags */}
                        {item.hashtags && item.hashtags.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-gray-500 mb-1">Hashtags</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.hashtags.map((h) => (
                                <span key={h} className="px-2 py-0.5 bg-blue-600/10 border border-blue-600/20 rounded-full text-xs text-blue-300">
                                  #{h}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <div className="mb-4">
                            <p className="text-xs text-gray-500 mb-1">Notes</p>
                            <p className="text-xs text-gray-400 whitespace-pre-line">{item.notes}</p>
                          </div>
                        )}

                        {/* Error */}
                        {item.publish_error && (
                          <div className="mb-4 p-2 bg-red-600/10 border border-red-600/20 rounded-lg">
                            <p className="text-xs text-red-400">{item.publish_error}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          {item.status === 'draft' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApproveItem(item.id); }}
                              className="px-4 py-1.5 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg text-xs font-medium hover:bg-green-600/30 transition"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                            className="px-4 py-1.5 bg-red-600/10 text-red-400 border border-red-600/20 rounded-lg text-xs font-medium hover:bg-red-600/20 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
