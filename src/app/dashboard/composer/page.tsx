// ============================================================
// Post Composer — /dashboard/composer
//
// Station 2 full compose workflow. Step-by-step flow:
//   Step 1: Select Assets (InspoPickerModal or paste URL)
//   Step 2: Choose Channel & Template
//   Step 3: Write Caption (AI auto-generate, hashtags, mentions)
//   Step 4: Preview & Queue (schedule, save draft, or approve)
//
// Progress indicator at top, Back/Next navigation between steps.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import InspoPickerModal from '@/components/InspoPickerModal';
import type { SelectedInspoItem } from '@/components/InspoPickerModal';

// --- Types ---

type Channel = 'instagram_post' | 'instagram_reel' | 'instagram_story' | 'tiktok' | 'youtube_short' | 'linkedin' | 'twitter';
type TemplateType = 'carousel' | 'single_image' | 'video' | 'text_only';

interface CaptionVariant {
  text: string;
  hashtags: string[];
}

// --- Constants ---

const CHANNELS: { value: Channel; label: string; icon: string; charLimit: number }[] = [
  { value: 'instagram_post', label: 'Instagram Post', icon: 'IG', charLimit: 2200 },
  { value: 'instagram_reel', label: 'Instagram Reel', icon: 'IG', charLimit: 2200 },
  { value: 'instagram_story', label: 'Instagram Story', icon: 'IG', charLimit: 2200 },
  { value: 'tiktok', label: 'TikTok', icon: 'TT', charLimit: 2200 },
  { value: 'youtube_short', label: 'YouTube Short', icon: 'YT', charLimit: 5000 },
  { value: 'linkedin', label: 'LinkedIn', icon: 'LI', charLimit: 3000 },
  { value: 'twitter', label: 'Twitter/X', icon: 'X', charLimit: 280 },
];

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: 'carousel', label: 'Carousel' },
  { value: 'single_image', label: 'Single Image' },
  { value: 'video', label: 'Video' },
  { value: 'text_only', label: 'Text Only' },
];

const STEPS = [
  { num: 1, label: 'Select Assets' },
  { num: 2, label: 'Channel & Template' },
  { num: 3, label: 'Write Caption' },
  { num: 4, label: 'Preview & Queue' },
];

export default function ComposerPage() {
  const supabase = createBrowserSupabase();

  // --- Step state ---
  const [currentStep, setCurrentStep] = useState(1);

  // --- Step 1: Assets ---
  const [selectedAssets, setSelectedAssets] = useState<SelectedInspoItem[]>([]);
  const [pasteUrl, setPasteUrl] = useState('');
  const [inspoPickerOpen, setInspoPickerOpen] = useState(false);

  // --- Step 2: Channel & Template ---
  const [channel, setChannel] = useState<Channel | ''>('');
  const [templateType, setTemplateType] = useState<TemplateType | ''>('');

  // --- Step 3: Caption ---
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [mentions, setMentions] = useState('');
  const [ftcDisclosure, setFtcDisclosure] = useState(false);
  const [captionVariants, setCaptionVariants] = useState<CaptionVariant[]>([]);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);

  // --- Step 4: Queue ---
  const [scheduledFor, setScheduledFor] = useState('');
  const [athleteName, setAthleteA] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // --- Campaigns list ---
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('campaign_briefs')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setCampaigns(data);
    }
    load();
  }, [supabase]);

  // --- Character limit for selected channel ---
  const charLimit = CHANNELS.find((c) => c.value === channel)?.charLimit || 2200;
  const captionLength = caption.length;
  const isOverLimit = captionLength > charLimit;

  // --- Handle asset selection from picker ---
  const handleAssetSelect = (items: SelectedInspoItem[]) => {
    setSelectedAssets(items);
    // Auto-fill athlete name from first selected asset
    if (items.length > 0 && items[0].athlete_name && !athleteName) {
      setAthleteA(items[0].athlete_name);
    }
  };

  // Remove a selected asset
  const removeAsset = (id: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== id));
  };

  // --- AI Caption Generation ---
  const generateCaptions = useCallback(async () => {
    if (!channel) return;
    setGeneratingCaptions(true);
    setCaptionVariants([]);

    try {
      // Build context for the caption generator
      const assetContext = selectedAssets.map((a) => ({
        content_type: a.content_type,
        description: a.visual_description,
        sport: a.sport,
        athlete: a.athlete_name,
        vibes: a.search_phrases?.slice(0, 5),
      }));

      const res = await fetch('/api/captions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          template_type: templateType || undefined,
          assets: assetContext,
          athlete_name: athleteName || undefined,
          ftc_required: ftcDisclosure,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.variants && Array.isArray(data.variants)) {
          setCaptionVariants(data.variants);
        }
      }
    } catch (err) {
      console.error('Failed to generate captions:', err);
    }

    setGeneratingCaptions(false);
  }, [channel, templateType, selectedAssets, athleteName, ftcDisclosure]);

  // Select a caption variant
  const selectVariant = (variant: CaptionVariant) => {
    setCaption(variant.text);
    if (variant.hashtags?.length > 0) {
      setHashtags((prev) => {
        const existing = new Set(prev);
        variant.hashtags.forEach((h) => existing.add(h));
        return Array.from(existing);
      });
    }
  };

  // --- Hashtag management ---
  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags((prev) => [...prev, tag]);
    }
    setHashtagInput('');
  };

  const removeHashtag = (tag: string) => {
    setHashtags((prev) => prev.filter((h) => h !== tag));
  };

  // --- Save / Submit ---
  const handleSave = async (status: 'draft' | 'approved' | 'review') => {
    setSaving(true);
    setSaveSuccess('');

    const payload = {
      inspo_item_ids: selectedAssets.map((a) => a.id),
      asset_url: pasteUrl || (selectedAssets[0]?.file_url ?? null),
      asset_urls: selectedAssets.map((a) => a.file_url).filter(Boolean),
      thumbnail_url: selectedAssets[0]?.thumbnail_url ?? null,
      channel,
      template_type: templateType || null,
      caption: ftcDisclosure ? caption + '\n\n#ad #sponsored' : caption,
      hashtags,
      mentions: mentions || null,
      athlete_name: athleteName || null,
      campaign_id: campaignId || null,
      scheduled_for: scheduledFor || null,
      notes: notes || null,
      status,
    };

    try {
      const res = await fetch('/api/composer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const labels: Record<string, string> = {
          draft: 'Draft saved',
          approved: 'Approved & queued',
          review: 'Sent for review',
        };
        setSaveSuccess(labels[status] || 'Saved');
        // Reset form after successful queue/approve
        if (status !== 'draft') {
          setTimeout(() => {
            setCurrentStep(1);
            setSelectedAssets([]);
            setPasteUrl('');
            setChannel('');
            setTemplateType('');
            setCaption('');
            setHashtags([]);
            setMentions('');
            setFtcDisclosure(false);
            setCaptionVariants([]);
            setScheduledFor('');
            setAthleteA('');
            setCampaignId('');
            setNotes('');
            setSaveSuccess('');
          }, 2000);
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save post');
    }

    setSaving(false);
  };

  // --- Navigation ---
  const canGoNext = () => {
    switch (currentStep) {
      case 1: return selectedAssets.length > 0 || pasteUrl.trim().length > 0;
      case 2: return channel !== '';
      case 3: return caption.trim().length > 0 && !isOverLimit;
      default: return false;
    }
  };

  // --- Render ---

  return (
    <div>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Post Composer</h1>
          <p className="text-gray-400 mt-1">Create, caption, and queue content for distribution</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((step, i) => (
            <div key={step.num} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => {
                  // Allow going back to completed steps
                  if (step.num < currentStep) setCurrentStep(step.num);
                }}
                className={`flex items-center gap-2 text-sm transition-colors ${
                  step.num === currentStep
                    ? 'text-white font-medium'
                    : step.num < currentStep
                    ? 'text-green-400 cursor-pointer'
                    : 'text-gray-600'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                    step.num === currentStep
                      ? 'bg-white text-black border-white'
                      : step.num < currentStep
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-white/5 text-gray-600 border-white/10'
                  }`}
                >
                  {step.num < currentStep ? '✓' : step.num}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${step.num < currentStep ? 'bg-green-500/30' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ===== STEP 1: Select Assets ===== */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Select Assets</h2>

            {/* Browse Library Button */}
            <button
              onClick={() => setInspoPickerOpen(true)}
              className="w-full py-6 border-2 border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/40 transition-colors mb-4"
            >
              <span className="text-2xl block mb-1">+</span>
              Browse Library
            </button>

            {/* Selected Assets Strip */}
            {selectedAssets.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">{selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''} selected</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedAssets.map((asset) => {
                    const thumb = asset.thumbnail_url || asset.file_url;
                    return (
                      <div key={asset.id} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-white/5 group">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">📷</div>
                        )}
                        <button
                          onClick={() => removeAsset(asset.id)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/70 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Or paste URL */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Or paste a URL directly</p>
              <input
                type="url"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        )}

        {/* ===== STEP 2: Channel & Template ===== */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Choose Channel</h2>

            {/* Channel buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => setChannel(ch.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    channel === ch.value
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <span className="text-lg font-mono font-bold">{ch.icon}</span>
                  <span className="text-xs text-center">{ch.label}</span>
                  <span className="text-[9px] text-gray-600">{ch.charLimit} chars</span>
                </button>
              ))}
            </div>

            <h2 className="text-lg font-semibold mb-4">Template Type (Optional)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TEMPLATE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTemplateType(templateType === t.value ? '' : t.value)}
                  className={`p-3 rounded-xl border text-sm transition-all ${
                    templateType === t.value
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== STEP 3: Write Caption ===== */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Write Caption</h2>

            {/* Auto-Generate Button */}
            <button
              onClick={generateCaptions}
              disabled={generatingCaptions}
              className="mb-4 px-4 py-2 bg-blue-600/20 text-blue-300 border border-blue-600/30 rounded-lg text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-50"
            >
              {generatingCaptions ? 'Generating...' : 'Auto-Generate Captions'}
            </button>

            {/* AI Variants */}
            {captionVariants.length > 0 && (
              <div className="mb-6 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">AI Suggestions (click to use)</p>
                {captionVariants.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => selectVariant(v)}
                    className="w-full text-left p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    <p className="line-clamp-3">{v.text}</p>
                    {v.hashtags?.length > 0 && (
                      <p className="text-xs text-blue-400 mt-1">
                        {v.hashtags.map((h) => `#${h}`).join(' ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Caption Textarea */}
            <div className="mb-4">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption..."
                rows={6}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30 resize-none"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-600">
                  {CHANNELS.find((c) => c.value === channel)?.label || 'Selected channel'}
                </span>
                <span className={`text-xs ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
                  {captionLength} / {charLimit}
                </span>
              </div>
            </div>

            {/* Hashtags */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Hashtags</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full text-xs"
                  >
                    #{tag}
                    <button
                      onClick={() => removeHashtag(tag)}
                      className="hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHashtag(); } }}
                  placeholder="Add hashtag..."
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
                />
                <button
                  onClick={addHashtag}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Mentions */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Mentions</p>
              <input
                type="text"
                value={mentions}
                onChange={(e) => setMentions(e.target.value)}
                placeholder="@athlete @brand..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* FTC Disclosure */}
            <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.07] transition-colors">
              <input
                type="checkbox"
                checked={ftcDisclosure}
                onChange={(e) => setFtcDisclosure(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-blue-500"
              />
              <div>
                <p className="text-sm text-white">FTC Disclosure Required</p>
                <p className="text-xs text-gray-500">Auto-adds #ad #sponsored to caption</p>
              </div>
            </label>
          </div>
        )}

        {/* ===== STEP 4: Preview & Queue ===== */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Preview & Queue</h2>

            {/* Mock Preview */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  {CHANNELS.find((c) => c.value === channel)?.label || 'Preview'}
                </p>
              </div>

              {/* Preview content */}
              <div className="p-4">
                {/* Asset preview */}
                {selectedAssets.length > 0 ? (
                  <div className="mb-4">
                    {selectedAssets.length === 1 ? (
                      <div className="aspect-square max-w-sm mx-auto bg-white/5 rounded-lg overflow-hidden">
                        {(selectedAssets[0].thumbnail_url || selectedAssets[0].file_url) ? (
                          <img
                            src={selectedAssets[0].thumbnail_url || selectedAssets[0].file_url!}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl">📷</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {selectedAssets.map((a) => (
                          <div key={a.id} className="w-32 h-32 flex-shrink-0 bg-white/5 rounded-lg overflow-hidden">
                            {(a.thumbnail_url || a.file_url) ? (
                              <img src={a.thumbnail_url || a.file_url!} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">📷</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : pasteUrl ? (
                  <div className="mb-4 p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-400">URL: {pasteUrl}</p>
                  </div>
                ) : null}

                {/* Caption preview */}
                <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {caption}
                  {ftcDisclosure && <span className="text-gray-500">{'\n\n'}#ad #sponsored</span>}
                </div>

                {/* Hashtags preview */}
                {hashtags.length > 0 && (
                  <p className="text-sm text-blue-400 mt-2">
                    {hashtags.map((h) => `#${h}`).join(' ')}
                  </p>
                )}

                {/* Mentions preview */}
                {mentions && (
                  <p className="text-sm text-gray-400 mt-1">{mentions}</p>
                )}
              </div>
            </div>

            {/* Scheduling & Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Schedule For</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/30"
                />
                <p className="text-[10px] text-gray-600 mt-1">Leave empty for manual posting</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Athlete</label>
                <input
                  type="text"
                  value={athleteName}
                  onChange={(e) => setAthleteA(e.target.value)}
                  placeholder="Athlete name..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Campaign</label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/30"
                >
                  <option value="">No campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => handleSave('approved')}
                disabled={saving}
                className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {saving ? 'Queuing...' : 'Approve & Queue'}
              </button>
              <button
                onClick={() => handleSave('review')}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600/20 text-blue-300 border border-blue-600/30 rounded-lg text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-50"
              >
                {saving ? 'Sending...' : 'Send for Review'}
              </button>
            </div>

            {/* Success Toast */}
            {saveSuccess && (
              <div className="mt-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">
                {saveSuccess}
              </div>
            )}
          </div>
        )}

        {/* ===== Navigation ===== */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/10">
          <button
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1}
            className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {currentStep < 4 && (
            <button
              onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
              disabled={!canGoNext()}
              className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>

      {/* Inspo Picker Modal */}
      <InspoPickerModal
        isOpen={inspoPickerOpen}
        onClose={() => setInspoPickerOpen(false)}
        onSelect={handleAssetSelect}
        selectedIds={selectedAssets.map((a) => a.id)}
        maxSelections={20}
      />
    </div>
  );
}
