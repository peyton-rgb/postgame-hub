// ============================================================
// Station 1 — Content Intake Dashboard
// /dashboard/intake
//
// This is the main intake page where Postgame staff:
//   1. Upload raw footage and photos from shoots
//   2. See what's pending tagging, what's been tagged, what failed
//   3. Trigger Claude Vision tagging on uploaded content
//   4. Review and verify AI-generated tags
//   5. Upload raw brief documents for AI parsing
//
// The brain only gets smart when it gets fed — this is the mouth.
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { InspoItem, TaggingStatus } from '@/lib/types/intake';

// --- Status display helpers ---

const STATUS_LABELS: Record<TaggingStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  tagged: 'Tagged',
  failed: 'Failed',
  reviewed: 'Reviewed',
};

// Five states on three colours. The chip TEXT already names the state, so hue
// was carrying no information a reader did not already have — it was carrying
// five off-palette hues instead. States now separate by weight on the ink
// ladder, and only `failed` takes accent, because it is the only one asking for
// action.
//
// DESIGN REVIEW: collapsing five hues to four weights is a visible change, not a
// substitution. If pending and tagged prove hard to tell apart at a glance, the
// fix is an outline-vs-fill distinction, not a fourth colour.
const STATUS_COLORS: Record<TaggingStatus, string> = {
  pending: 'bg-surface-card text-ink-4 border-hairline',
  processing: 'bg-surface-raised text-ink-2 border-hairline',
  tagged: 'bg-surface-card text-ink-3 border-hairline',
  failed: 'bg-accent/15 text-accent border-accent/30',
  reviewed: 'bg-surface-card text-ink-3 border-ink-4',
};

// --- Tab types ---
type Tab = 'upload' | 'queue' | 'brief';

export default function IntakePage() {
  const supabase = createBrowserSupabase();

  // --- State ---
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [queueItems, setQueueItems] = useState<InspoItem[]>([]);
  const [queueFilter, setQueueFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<string[]>([]);
  const [taggingIds, setTaggingIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState({ pending: 0, processing: 0, tagged: 0, failed: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InspoItem | null>(null);
  const [briefParsing, setBriefParsing] = useState(false);
  const [parsedBrief, setParsedBrief] = useState<Record<string, unknown> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const briefInputRef = useRef<HTMLInputElement>(null);

  // --- Fetch queue items ---
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/intake/queue?status=${queueFilter}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      setQueueItems(data.items || []);
      if (data.counts) {
        setCounts({
          pending: data.counts.pending ?? 0,
          processing: data.counts.processing ?? 0,
          tagged: data.counts.tagged ?? 0,
          failed: data.counts.failed ?? 0,
        });
      }
    }
    setLoading(false);
  }, [queueFilter]);

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchQueue();
    }
  }, [activeTab, queueFilter, fetchQueue]);

  // --- File upload handler ---
  const handleUpload = async (files: FileList | File[]) => {
    setUploading(true);
    setUploadResults([]);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await fetch('/api/intake/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      const messages: string[] = [];
      if (data.successful > 0) {
        messages.push(`${data.successful} file${data.successful > 1 ? 's' : ''} uploaded successfully`);
      }
      if (data.failed > 0) {
        messages.push(`${data.failed} file${data.failed > 1 ? 's' : ''} failed`);
        data.errors?.forEach((e: { file: string; error: string }) => {
          messages.push(`  → ${e.file}: ${e.error}`);
        });
      }
      setUploadResults(messages);

      // For video files, extract thumbnails client-side
      for (const result of (data.uploaded || [])) {
        const item = result.inspo_item;
        if (item.mime_type?.startsWith('video/') && !item.thumbnail_url) {
          await extractVideoThumbnail(item.id, item.file_url);
        }
      }
    } catch (err) {
      setUploadResults(['Upload failed. Please try again.']);
    }

    setUploading(false);
  };

  // --- Extract a thumbnail from a video using <canvas> ---
  const extractVideoThumbnail = async (inspoItemId: string, videoUrl: string) => {
    return new Promise<void>((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'metadata';

      video.onloadeddata = () => {
        // Seek to 1 second (or half duration for short clips)
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.8);

          // Upload the thumbnail
          await fetch('/api/intake/thumbnail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inspo_item_id: inspoItemId,
              thumbnail_base64: base64,
            }),
          });
        }
        resolve();
      };

      video.onerror = () => resolve(); // Silently fail thumbnail extraction
      video.src = videoUrl;
    });
  };

  // --- Drag and drop handlers ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // --- Tag a single item ---
  const handleTag = async (inspoItemId: string) => {
    setTaggingIds((prev) => new Set(prev).add(inspoItemId));

    try {
      const res = await fetch('/api/intake/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspo_item_id: inspoItemId }),
      });

      if (res.ok) {
        // Refresh the queue to show updated status
        fetchQueue();
      }
    } catch (err) {
      console.error('Tagging failed:', err);
    }

    setTaggingIds((prev) => {
      const next = new Set(prev);
      next.delete(inspoItemId);
      return next;
    });
  };

  // --- Tag all pending items ---
  const handleTagAll = async () => {
    const pendingIds = queueItems
      .filter((item) => item.tagging_status === 'pending')
      .map((item) => item.id);

    if (pendingIds.length === 0) return;

    // Tag in batches of 5 for UI responsiveness
    for (let i = 0; i < pendingIds.length; i += 5) {
      const batch = pendingIds.slice(i, i + 5);
      batch.forEach((id) => setTaggingIds((prev) => new Set(prev).add(id)));

      await fetch('/api/intake/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspo_item_ids: batch }),
      });

      batch.forEach((id) =>
        setTaggingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        })
      );

      // Refresh after each batch
      fetchQueue();
    }
  };

  // --- Extract thumbnails for videos that don't have one ---
  const [extractingThumbs, setExtractingThumbs] = useState(false);
  const [thumbProgress, setThumbProgress] = useState('');

  const handleExtractAllThumbnails = async () => {
    // Find videos in the queue that have no thumbnail
    const needsThumbnail = queueItems.filter(
      (item) => item.mime_type?.startsWith('video/') && !item.thumbnail_url && item.file_url
    );

    if (needsThumbnail.length === 0) {
      setThumbProgress('All videos already have thumbnails.');
      return;
    }

    setExtractingThumbs(true);
    let extracted = 0;

    for (const item of needsThumbnail) {
      setThumbProgress(`Extracting ${extracted + 1} of ${needsThumbnail.length}...`);
      try {
        await extractVideoThumbnail(item.id, item.file_url!);
        extracted++;
      } catch {
        // Skip failures silently — some videos may not load in the browser
      }
    }

    setThumbProgress(`Done — extracted ${extracted} of ${needsThumbnail.length} thumbnails.`);
    setExtractingThumbs(false);
    fetchQueue(); // Refresh to show updated items
  };

  // --- Brief document parsing ---
  const handleBriefUpload = async (file: File) => {
    setBriefParsing(true);
    setParsedBrief(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/intake/brief', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setParsedBrief(data.parsed_fields);
      } else {
        setParsedBrief({ error: data.error || 'Parsing failed' } as Record<string, unknown>);
      }
    } catch {
      setParsedBrief({ error: 'Failed to parse brief' } as Record<string, unknown>);
    }

    setBriefParsing(false);
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Station 1 — Content Intake</h1>
          <p className="text-ink-3 mt-1">
            Upload footage, tag content with AI, and parse briefs. Everything here feeds the brain.
          </p>
        </div>
        <a
          href="/dashboard/inspo"
          className="px-4 py-2 bg-surface-raised hover:bg-surface-raised rounded-lg text-sm transition-colors text-ink-3"
        >
          View Inspo Library →
        </a>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 bg-surface-card rounded-lg p-1 w-fit">
        {([
          { key: 'upload' as Tab, label: 'Upload Footage', icon: '↑' },
          { key: 'queue' as Tab, label: 'Tag Queue', icon: '◎' },
          { key: 'brief' as Tab, label: 'Parse Brief', icon: '✦' },
        ]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-[var(--accent)] text-ink-1'
                : 'text-ink-3 hover:text-ink-1 hover:bg-surface-card'
            }`}
          >
            <span className="mr-2">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ============================================ */}
      {/* TAB 1: Upload Footage                       */}
      {/* ============================================ */}
      {activeTab === 'upload' && (
        <div className="max-w-3xl">
          {/* Drag and drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-ink-4 hover:border-ink-4 hover:bg-surface-card'
            }`}
          >
            <div className="text-5xl mb-4">{uploading ? '⏳' : '🎬'}</div>
            <p className="text-lg font-medium mb-2">
              {uploading
                ? 'Uploading...'
                : dragActive
                ? 'Drop files here'
                : 'Drag footage here or click to browse'}
            </p>
            <p className="text-sm text-ink-3">
              Accepts video (MP4, MOV, WebM) and images (JPG, PNG, WebP, HEIC)
            </p>
            <p className="text-xs text-ink-4 mt-2">
              Max 500MB per file. Files go to the inspo library for AI tagging.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  handleUpload(e.target.files);
                }
              }}
            />
          </div>

          {/* Upload results */}
          {uploadResults.length > 0 && (
            <div className="mt-6 p-4 rounded-lg bg-surface-card border border-hairline">
              <h3 className="text-sm font-medium text-ink-3 mb-2">Upload Results</h3>
              {uploadResults.map((msg, i) => (
                <p key={i} className={`text-sm ${msg.includes('failed') ? 'text-accent' : 'text-ink-3'}`}>
                  {msg}
                </p>
              ))}
              <button
                onClick={() => { setActiveTab('queue'); setQueueFilter('pending'); }}
                className="mt-3 text-sm text-[var(--accent)] hover:underline"
              >
                → View in tag queue to start tagging
              </button>
            </div>
          )}

          {/* Quick info */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-surface-card border border-hairline">
              <h3 className="text-sm font-medium text-ink-3 mb-1">How it works</h3>
              <p className="text-xs text-ink-4">
                Upload → files land in the tag queue → Claude Vision analyzes each one across 13 categories → tags get saved to the inspo library → the Creative Director uses them for future concepts.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-surface-card border border-hairline">
              <h3 className="text-sm font-medium text-ink-3 mb-1">Video thumbnails</h3>
              <p className="text-xs text-ink-4">
                For videos, a thumbnail is automatically extracted from the first second. Claude tags the thumbnail — full video processing (frame-by-frame) comes in a future update.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB 2: Tag Queue                            */}
      {/* ============================================ */}
      {activeTab === 'queue' && (
        <div>
          {/* Queue stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {([
              { key: 'pending', label: 'Pending', color: 'text-ink-4' },
              { key: 'processing', label: 'Processing', color: 'text-ink-2' },
              { key: 'tagged', label: 'Tagged', color: 'text-ink-3' },
              { key: 'failed', label: 'Failed', color: 'text-accent' },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setQueueFilter(key)}
                className={`p-4 rounded-lg border transition-all ${
                  queueFilter === key
                    ? 'bg-surface-raised border-[var(--accent)]'
                    : 'bg-surface-card border-hairline hover:bg-surface-raised'
                }`}
              >
                <p className={`text-2xl font-bold ${color}`}>
                  {counts[key]}
                </p>
                <p className="text-xs text-ink-3">{label}</p>
              </button>
            ))}
          </div>

          {/* Batch actions */}
          {queueItems.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-3 items-center">
              {queueFilter === 'pending' && (
                <button
                  onClick={handleTagAll}
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent)] text-ink-1 text-sm font-medium rounded-lg transition-colors"
                >
                  Tag All Pending ({queueItems.filter(i => i.tagging_status === 'pending').length})
                </button>
              )}
              {/* Extract thumbnails — shows when there are videos without thumbnails */}
              {queueItems.some(i => i.mime_type?.startsWith('video/') && !i.thumbnail_url) && (
                <button
                  onClick={handleExtractAllThumbnails}
                  disabled={extractingThumbs}
                  className="px-4 py-2 bg-surface-card border border-hairline hover:bg-surface-raised text-ink-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {extractingThumbs ? 'Extracting...' : `Extract Thumbnails (${queueItems.filter(i => i.mime_type?.startsWith('video/') && !i.thumbnail_url).length} videos)`}
                </button>
              )}
              <button
                onClick={fetchQueue}
                className="px-4 py-2 bg-surface-raised hover:bg-surface-raised text-ink-1 text-sm rounded-lg transition-colors"
              >
                Refresh
              </button>
              {thumbProgress && (
                <span className="text-xs text-ink-3">{thumbProgress}</span>
              )}
            </div>
          )}

          {/* Queue list */}
          {loading ? (
            <div className="text-center py-12 text-ink-4">Loading...</div>
          ) : queueItems.length === 0 ? (
            <div className="text-center py-12 text-ink-4">
              <p className="text-lg mb-2">No items in this queue</p>
              <p className="text-sm">Upload some footage to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {queueItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  className={`rounded-lg border overflow-hidden cursor-pointer transition-all ${
                    selectedItem?.id === item.id
                      ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                      : 'border-hairline hover:border-ink-1/20'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-ground/50 relative">
                    {(item.thumbnail_url || item.file_url) && item.mime_type?.startsWith('image/') ? (
                      <img
                        src={item.thumbnail_url || item.file_url || ''}
                        alt="Content preview"
                        className="w-full h-full object-cover"
                      />
                    ) : item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-ink-4">
                        <span className="text-3xl">{item.mime_type?.startsWith('video/') ? '🎬' : '📷'}</span>
                      </div>
                    )}
                    {/* Status badge */}
                    <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.tagging_status as TaggingStatus] || STATUS_COLORS.pending}`}>
                      {STATUS_LABELS[item.tagging_status as TaggingStatus] || item.tagging_status}
                    </span>
                    {/* Content type badge */}
                    <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-ground/60 text-ink-3">
                      {item.content_type}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-surface-card">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-ink-3 truncate">
                        {item.format?.toUpperCase()} · {item.file_size_bytes ? `${(item.file_size_bytes / (1024 * 1024)).toFixed(1)} MB` : 'Unknown size'}
                      </p>
                      <p className="text-xs text-ink-4">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Tag action button */}
                    {item.tagging_status === 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTag(item.id); }}
                        disabled={taggingIds.has(item.id)}
                        className="mt-2 w-full px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent)] disabled:bg-surface-raised text-ink-1 text-xs font-medium rounded transition-colors"
                      >
                        {taggingIds.has(item.id) ? 'Tagging...' : 'Tag with AI'}
                      </button>
                    )}
                    {item.tagging_status === 'failed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTag(item.id); }}
                        disabled={taggingIds.has(item.id)}
                        className="mt-2 w-full px-3 py-1.5 bg-accent hover:bg-accent disabled:bg-surface-raised text-ink-1 text-xs font-medium rounded transition-colors"
                      >
                        {taggingIds.has(item.id) ? 'Retrying...' : 'Retry'}
                      </button>
                    )}

                    {/* Show tags preview if tagged */}
                    {item.tagging_status === 'tagged' && item.visual_description && (
                      <p className="mt-2 text-xs text-ink-3 line-clamp-2">
                        {item.visual_description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detail panel for selected item */}
          {selectedItem && selectedItem.tagging_status === 'tagged' && (
            <div className="mt-6 p-6 rounded-lg bg-surface-card border border-hairline">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tag Details</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-ink-3 hover:text-ink-1 text-sm"
                >
                  Close
                </button>
              </div>

              {/* Visual description */}
              {selectedItem.visual_description && (
                <div className="mb-4">
                  <p className="text-xs text-ink-4 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-ink-3">{selectedItem.visual_description}</p>
                </div>
              )}

              {/* Tag groups */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pro Tags */}
                <div>
                  <p className="text-xs text-ink-4 uppercase tracking-wider mb-2">Pro Tags (Technical)</p>
                  {selectedItem.pro_tags && Object.entries(selectedItem.pro_tags).map(([key, values]) => (
                    <div key={key} className="mb-2">
                      <p className="text-xs text-ink-3">{key.replace(/_/g, ' ')}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(values as string[])?.map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-surface-card/40 text-ink-2 border border-hairline/30">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Social Tags */}
                <div>
                  <p className="text-xs text-ink-4 uppercase tracking-wider mb-2">Social Tags (Platform)</p>
                  {selectedItem.social_tags && Object.entries(selectedItem.social_tags).map(([key, values]) => (
                    <div key={key} className="mb-2">
                      <p className="text-xs text-ink-3">{key.replace(/_/g, ' ')}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(values as string[])?.map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-surface-card text-ink-3 border border-hairline">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Context Tags */}
                <div>
                  <p className="text-xs text-ink-4 uppercase tracking-wider mb-2">Context Tags (Content)</p>
                  {selectedItem.context_tags && Object.entries(selectedItem.context_tags).map(([key, values]) => (
                    <div key={key} className="mb-2">
                      <p className="text-xs text-ink-3">{key.replace(/_/g, ' ')}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(values as string[])?.map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-surface-card text-ink-3 border border-hairline">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vibe words */}
              {selectedItem.search_phrases?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-ink-4 uppercase tracking-wider mb-2">Vibe Words</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.search_phrases.map((word: string) => (
                      <span key={word} className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Brief fit */}
              {selectedItem.brief_fit?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-ink-4 uppercase tracking-wider mb-2">Brief Fit</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.brief_fit.map((fit: string) => (
                      <span key={fit} className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-ink-3 border border-ink-1/20">
                        {fit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TAB 3: Parse Brief                          */}
      {/* ============================================ */}
      {activeTab === 'brief' && (
        <div className="max-w-3xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Brief Intake Agent</h2>
            <p className="text-sm text-ink-3">
              Upload a raw brief (PDF or Word doc) and the Intake agent will parse it into structured fields.
              You review and correct before anything gets saved.
            </p>
          </div>

          {/* Brief upload zone */}
          <div
            onClick={() => briefInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all border-ink-4 hover:border-ink-4 hover:bg-surface-card"
          >
            <div className="text-4xl mb-3">{briefParsing ? '⏳' : '📄'}</div>
            <p className="text-lg font-medium mb-1">
              {briefParsing ? 'Parsing brief...' : 'Drop a brief document here'}
            </p>
            <p className="text-sm text-ink-3">
              Accepts PDF and Word documents
            </p>
            <input
              ref={briefInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBriefUpload(file);
              }}
            />
          </div>

          {/* Parsed brief results */}
          {parsedBrief && (
            <div className="mt-6 p-6 rounded-lg bg-surface-card border border-hairline">
              {'error' in parsedBrief ? (
                <div className="text-accent">
                  <p className="font-medium">Parsing failed</p>
                  <p className="text-sm mt-1">{parsedBrief.error as string}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Parsed Brief Fields</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-surface-raised/20 text-ink-3 border border-hairline/30">
                      AI Extracted
                    </span>
                  </div>

                  {/* Summary */}
                  {parsedBrief.raw_summary && (
                    <div className="mb-4 p-3 rounded-lg bg-surface-card">
                      <p className="text-xs text-ink-4 uppercase tracking-wider mb-1">Summary</p>
                      <p className="text-sm text-ink-3">{parsedBrief.raw_summary as string}</p>
                    </div>
                  )}

                  {/* Extracted fields */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'name', label: 'Campaign Name' },
                      { key: 'brand_name', label: 'Brand' },
                      { key: 'campaign_type', label: 'Campaign Type' },
                      { key: 'campaign_goal', label: 'Goal' },
                      { key: 'athlete_notes', label: 'Athlete Notes' },
                      { key: 'budget_notes', label: 'Budget' },
                    ].map(({ key, label }) => (
                      parsedBrief[key] ? (
                        <div key={key}>
                          <p className="text-xs text-ink-4">{label}</p>
                          <p className="text-sm text-ink-1">{parsedBrief[key] as string}</p>
                        </div>
                      ) : null
                    ))}
                  </div>

                  {/* Lists */}
                  {(['mandatories', 'restrictions', 'deliverables', 'vibe_descriptors', 'color_palette'] as const).map((key) => {
                    const items = parsedBrief[key] as string[] | undefined;
                    if (!items?.length) return null;
                    return (
                      <div key={key} className="mt-4">
                        <p className="text-xs text-ink-4 uppercase tracking-wider mb-1">
                          {key.replace(/_/g, ' ')}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {items.map((item: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-ink-3">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Deadlines */}
                  {parsedBrief.deadlines && Object.keys(parsedBrief.deadlines as object).length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-ink-4 uppercase tracking-wider mb-1">Deadlines</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(parsedBrief.deadlines as Record<string, string>).map(([key, val]) => (
                          <div key={key} className="text-sm">
                            <span className="text-ink-3">{key.replace(/_/g, ' ')}:</span>{' '}
                            <span className="text-ink-1">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence flags */}
                  {(parsedBrief.confidence_flags as Array<Record<string, string>>)?.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-surface-card/20 border border-hairline/30">
                      <p className="text-xs text-ink-4 uppercase tracking-wider mb-2">
                        Needs Your Review
                      </p>
                      {(parsedBrief.confidence_flags as Array<Record<string, string>>).map((flag, i) => (
                        <div key={i} className="text-sm mb-2 last:mb-0">
                          <span className="text-ink-4 font-medium">{flag.field}:</span>{' '}
                          <span className="text-ink-3">{flag.reason}</span>
                          {flag.suggestion && (
                            <p className="text-xs text-ink-4 mt-0.5">→ {flag.suggestion}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action button */}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        // Navigate to the new brief form, pre-populated with parsed fields
                        // We'll store the parsed data in sessionStorage for the form to pick up
                        if (typeof window !== 'undefined') {
                          sessionStorage.setItem('parsed_brief', JSON.stringify(parsedBrief));
                          window.location.href = '/dashboard/campaign-briefs/new?from=intake';
                        }
                      }}
                      className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)] text-ink-1 font-medium rounded-lg transition-colors"
                    >
                      Create Brief from This
                    </button>
                    <button
                      onClick={() => setParsedBrief(null)}
                      className="px-6 py-2.5 bg-surface-raised hover:bg-surface-raised text-ink-3 rounded-lg transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
