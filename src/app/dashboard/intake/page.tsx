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

const STATUS_COLORS: Record<TaggingStatus, string> = {
  pending: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30',
  processing: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  tagged: 'bg-green-600/20 text-green-300 border-green-600/30',
  failed: 'bg-red-600/20 text-red-300 border-red-600/30',
  reviewed: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
};

// --- Triage status helpers ---
const TRIAGE_LABELS: Record<string, string> = {
  pending: 'Needs Review',
  approved: 'Approved',
  auto_approved: 'Auto-Approved',
  flagged: 'Flagged',
  rejected: 'Rejected',
};

const TRIAGE_COLORS: Record<string, string> = {
  pending: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30',
  approved: 'bg-green-600/20 text-green-300 border-green-600/30',
  auto_approved: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30',
  flagged: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
  rejected: 'bg-red-600/20 text-red-300 border-red-600/30',
};

// --- Tab types ---
type Tab = 'upload' | 'queue' | 'approval' | 'brief';

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
  const [approvalItems, setApprovalItems] = useState<InspoItem[]>([]);
  const [approvalFilter, setApprovalFilter] = useState<string>('pending');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalCounts, setApprovalCounts] = useState({ pending: 0, approved: 0, auto_approved: 0, flagged: 0, rejected: 0 });
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

  // --- Fetch approval queue (tagged items needing triage) ---
  const fetchApproval = useCallback(async () => {
    setApprovalLoading(true);
    // Fetch tagged items, filtered by triage_status
    const { data, error } = await supabase
      .from('inspo_items')
      .select('*')
      .eq('tagging_status', 'tagged')
      .eq('triage_status', approvalFilter)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setApprovalItems(data as InspoItem[]);
    }

    // Fetch counts for all triage statuses
    const countStatuses = ['pending', 'approved', 'auto_approved', 'flagged', 'rejected'];
    const newCounts: Record<string, number> = {};
    for (const s of countStatuses) {
      const { count } = await supabase
        .from('inspo_items')
        .select('id', { count: 'exact', head: true })
        .eq('tagging_status', 'tagged')
        .eq('triage_status', s);
      newCounts[s] = count || 0;
    }
    setApprovalCounts(newCounts as typeof approvalCounts);
    setApprovalLoading(false);
  }, [approvalFilter, supabase]);

  useEffect(() => {
    if (activeTab === 'approval') {
      fetchApproval();
    }
  }, [activeTab, approvalFilter, fetchApproval]);

  // --- Approve / reject / flag an item (Gate 1) ---
  const handleTriage = async (itemId: string, action: 'approved' | 'rejected' | 'flagged') => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('inspo_items')
      .update({
        triage_status: action,
        approved_by: action === 'approved' ? (user?.email || 'unknown') : null,
        approved_at: action === 'approved' ? new Date().toISOString() : null,
        // If approved, also set editing_status to pending so it enters the editing queue
        ...(action === 'approved' ? { editing_status: 'pending' } : {}),
      })
      .eq('id', itemId);

    if (!error) {
      fetchApproval();
      // Deselect if it was selected
      if (selectedItem?.id === itemId) setSelectedItem(null);
    }
  };

  // --- Batch approve all visible items ---
  const handleBatchApprove = async () => {
    const ids = approvalItems.map((i) => i.id);
    if (ids.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('inspo_items')
      .update({
        triage_status: 'approved',
        approved_by: user?.email || 'unknown',
        approved_at: new Date().toISOString(),
        editing_status: 'pending',
      })
      .in('id', ids);

    if (!error) fetchApproval();
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="min-h-screen bg-[#07070a] text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Station 1 — Content Intake</h1>
        <p className="text-gray-400 mt-1">
          Upload footage, tag content with AI, and parse briefs. Everything here feeds the brain.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 bg-white/5 rounded-lg p-1 w-fit">
        {([
          { key: 'upload' as Tab, label: 'Upload Footage', icon: '↑' },
          { key: 'queue' as Tab, label: 'Tag Queue', icon: '◎' },
          { key: 'approval' as Tab, label: 'Approval Queue', icon: '✓' },
          { key: 'brief' as Tab, label: 'Parse Brief', icon: '✦' },
        ]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-[#D73F09] text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
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
                ? 'border-[#D73F09] bg-[#D73F09]/10'
                : 'border-gray-600 hover:border-gray-400 hover:bg-white/5'
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
            <p className="text-sm text-gray-400">
              Accepts video (MP4, MOV, WebM) and images (JPG, PNG, WebP, HEIC)
            </p>
            <p className="text-xs text-gray-500 mt-2">
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
            <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Upload Results</h3>
              {uploadResults.map((msg, i) => (
                <p key={i} className={`text-sm ${msg.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                  {msg}
                </p>
              ))}
              <button
                onClick={() => { setActiveTab('queue'); setQueueFilter('pending'); }}
                className="mt-3 text-sm text-[#D73F09] hover:underline"
              >
                → View in tag queue to start tagging
              </button>
            </div>
          )}

          {/* Quick info */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="text-sm font-medium text-gray-300 mb-1">How it works</h3>
              <p className="text-xs text-gray-500">
                Upload → files land in the tag queue → Claude Vision analyzes each one across 13 categories → tags get saved to the inspo library → the Creative Director uses them for future concepts.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="text-sm font-medium text-gray-300 mb-1">Video thumbnails</h3>
              <p className="text-xs text-gray-500">
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
              { key: 'pending', label: 'Pending', color: 'text-yellow-400' },
              { key: 'processing', label: 'Processing', color: 'text-blue-400' },
              { key: 'tagged', label: 'Tagged', color: 'text-green-400' },
              { key: 'failed', label: 'Failed', color: 'text-red-400' },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setQueueFilter(key)}
                className={`p-4 rounded-lg border transition-all ${
                  queueFilter === key
                    ? 'bg-white/10 border-[#D73F09]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <p className={`text-2xl font-bold ${color}`}>
                  {counts[key]}
                </p>
                <p className="text-xs text-gray-400">{label}</p>
              </button>
            ))}
          </div>

          {/* Batch actions */}
          {queueFilter === 'pending' && queueItems.length > 0 && (
            <div className="mb-4 flex gap-3">
              <button
                onClick={handleTagAll}
                className="px-4 py-2 bg-[#D73F09] hover:bg-[#b33507] text-white text-sm font-medium rounded-lg transition-colors"
              >
                Tag All Pending ({queueItems.filter(i => i.tagging_status === 'pending').length})
              </button>
              <button
                onClick={fetchQueue}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
          )}

          {/* Queue list */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : queueItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
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
                      ? 'border-[#D73F09] ring-1 ring-[#D73F09]'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-black/50 relative">
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
                      <div className="flex items-center justify-center h-full text-gray-600">
                        <span className="text-3xl">{item.mime_type?.startsWith('video/') ? '🎬' : '📷'}</span>
                      </div>
                    )}
                    {/* Status badge */}
                    <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.tagging_status as TaggingStatus] || STATUS_COLORS.pending}`}>
                      {STATUS_LABELS[item.tagging_status as TaggingStatus] || item.tagging_status}
                    </span>
                    {/* Content type badge */}
                    <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/60 text-gray-300">
                      {item.content_type}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-400 truncate">
                        {item.format?.toUpperCase()} · {item.file_size_bytes ? `${(item.file_size_bytes / (1024 * 1024)).toFixed(1)} MB` : 'Unknown size'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Tag action button */}
                    {item.tagging_status === 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTag(item.id); }}
                        disabled={taggingIds.has(item.id)}
                        className="mt-2 w-full px-3 py-1.5 bg-[#D73F09] hover:bg-[#b33507] disabled:bg-gray-700 text-white text-xs font-medium rounded transition-colors"
                      >
                        {taggingIds.has(item.id) ? 'Tagging...' : 'Tag with AI'}
                      </button>
                    )}
                    {item.tagging_status === 'failed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTag(item.id); }}
                        disabled={taggingIds.has(item.id)}
                        className="mt-2 w-full px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white text-xs font-medium rounded transition-colors"
                      >
                        {taggingIds.has(item.id) ? 'Retrying...' : 'Retry'}
                      </button>
                    )}

                    {/* Show tags preview if tagged */}
                    {item.tagging_status === 'tagged' && item.visual_description && (
                      <p className="mt-2 text-xs text-gray-400 line-clamp-2">
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
            <div className="mt-6 p-6 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tag Details</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Close
                </button>
              </div>

              {/* Visual description */}
              {selectedItem.visual_description && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-gray-300">{selectedItem.visual_description}</p>
                </div>
              )}

              {/* Tag groups */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pro Tags */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Pro Tags (Technical)</p>
                  {selectedItem.pro_tags && Object.entries(selectedItem.pro_tags).map(([key, values]) => (
                    <div key={key} className="mb-2">
                      <p className="text-xs text-gray-400">{key.replace(/_/g, ' ')}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(values as string[])?.map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-700/30">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Social Tags */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Social Tags (Platform)</p>
                  {selectedItem.social_tags && Object.entries(selectedItem.social_tags).map(([key, values]) => (
                    <div key={key} className="mb-2">
                      <p className="text-xs text-gray-400">{key.replace(/_/g, ' ')}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(values as string[])?.map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/30">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Context Tags */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Context Tags (Content)</p>
                  {selectedItem.context_tags && Object.entries(selectedItem.context_tags).map(([key, values]) => (
                    <div key={key} className="mb-2">
                      <p className="text-xs text-gray-400">{key.replace(/_/g, ' ')}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(values as string[])?.map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-300 border border-green-700/30">
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
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Vibe Words</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.search_phrases.map((word: string) => (
                      <span key={word} className="text-xs px-2 py-0.5 rounded-full bg-[#D73F09]/20 text-orange-300 border border-[#D73F09]/30">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Brief fit */}
              {selectedItem.brief_fit?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Brief Fit</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.brief_fit.map((fit: string) => (
                      <span key={fit} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/20">
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
      {/* TAB 3: Approval Queue (Gate 1)              */}
      {/* ============================================ */}
      {activeTab === 'approval' && (
        <div>
          {/* Approval stats */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {([
              { key: 'pending', label: 'Needs Review', color: 'text-yellow-400' },
              { key: 'approved', label: 'Approved', color: 'text-green-400' },
              { key: 'auto_approved', label: 'Auto-Approved', color: 'text-emerald-400' },
              { key: 'flagged', label: 'Flagged', color: 'text-orange-400' },
              { key: 'rejected', label: 'Rejected', color: 'text-red-400' },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setApprovalFilter(key)}
                className={`p-4 rounded-lg border transition-all ${
                  approvalFilter === key
                    ? 'bg-white/10 border-[#D73F09]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <p className={`text-2xl font-bold ${color}`}>
                  {approvalCounts[key as keyof typeof approvalCounts]}
                </p>
                <p className="text-xs text-gray-400">{label}</p>
              </button>
            ))}
          </div>

          {/* Batch actions */}
          {approvalFilter === 'pending' && approvalItems.length > 0 && (
            <div className="mb-4 flex gap-3">
              <button
                onClick={handleBatchApprove}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Approve All ({approvalItems.length})
              </button>
              <button
                onClick={fetchApproval}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
          )}

          {/* Approval grid */}
          {approvalLoading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : approvalItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">No items {approvalFilter === 'pending' ? 'needing review' : `with status "${approvalFilter}"`}</p>
              <p className="text-sm">Tag content first, then it appears here for approval</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvalItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  className={`rounded-lg border overflow-hidden cursor-pointer transition-all ${
                    selectedItem?.id === item.id
                      ? 'border-[#D73F09] ring-1 ring-[#D73F09]'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-black/50 relative">
                    {(item.thumbnail_url || (item.file_url && item.mime_type?.startsWith('image/'))) ? (
                      <img
                        src={item.thumbnail_url || item.file_url || ''}
                        alt="Content preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-600">
                        <span className="text-3xl">{item.mime_type?.startsWith('video/') ? '🎬' : '📷'}</span>
                      </div>
                    )}
                    {/* Triage status badge */}
                    <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full border ${TRIAGE_COLORS[item.triage_status || 'pending']}`}>
                      {TRIAGE_LABELS[item.triage_status || 'pending']}
                    </span>
                    {/* Athlete tier badge */}
                    {item.athlete_tier && (
                      <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full border ${
                        item.athlete_tier === 1 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                        item.athlete_tier === 2 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                        'bg-gray-500/20 text-gray-300 border-gray-500/30'
                      }`}>
                        Tier {item.athlete_tier}
                      </span>
                    )}
                    {/* Content quality badge */}
                    {item.content_quality && (
                      <span className="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/60 text-gray-300">
                        {item.content_quality.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-white/5">
                    {/* Athlete + brand */}
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-white truncate">
                        {item.athlete_name || 'Unknown Athlete'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Mood tags */}
                    {item.mood_tags && (item.mood_tags as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(item.mood_tags as string[]).slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action description */}
                    {item.action_description && (
                      <p className="text-xs text-gray-400 line-clamp-2 mb-2">{item.action_description}</p>
                    )}

                    {/* Approval actions */}
                    {item.triage_status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTriage(item.id, 'approved'); }}
                          className="flex-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTriage(item.id, 'flagged'); }}
                          className="px-3 py-1.5 bg-orange-700/50 hover:bg-orange-600/50 text-orange-300 text-xs font-medium rounded transition-colors"
                        >
                          Flag
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTriage(item.id, 'rejected'); }}
                          className="px-3 py-1.5 bg-red-700/50 hover:bg-red-600/50 text-red-300 text-xs font-medium rounded transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detail panel for selected approval item */}
          {selectedItem && activeTab === 'approval' && (
            <div className="mt-6 p-6 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Content Details</h3>
                <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-white text-sm">Close</button>
              </div>

              {/* Identity info */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div><p className="text-xs text-gray-500">Athlete</p><p className="text-sm text-white">{selectedItem.athlete_name || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Tier</p><p className="text-sm text-white">{selectedItem.athlete_tier ? `Tier ${selectedItem.athlete_tier}` : '—'}</p></div>
                <div><p className="text-xs text-gray-500">Shot Type</p><p className="text-sm text-white">{selectedItem.shot_type?.replace(/_/g, ' ') || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Setting</p><p className="text-sm text-white">{selectedItem.scene_setting?.replace(/_/g, ' ') || '—'}</p></div>
              </div>

              {/* Action + description */}
              {selectedItem.action_description && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Action</p>
                  <p className="text-sm text-gray-300">{selectedItem.action_description}</p>
                </div>
              )}
              {selectedItem.visual_description && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Visual Description</p>
                  <p className="text-sm text-gray-300">{selectedItem.visual_description}</p>
                </div>
              )}

              {/* Mood + quality + vibe */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Mood</p>
                  <div className="flex flex-wrap gap-1">
                    {(selectedItem.mood_tags as string[] || []).map((tag: string) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/30">{tag}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quality</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedItem.content_quality === 'a_roll_hero' ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/30' :
                    selectedItem.content_quality === 'b_roll_support' ? 'bg-blue-900/40 text-blue-300 border border-blue-700/30' :
                    'bg-gray-900/40 text-gray-300 border border-gray-700/30'
                  }`}>
                    {selectedItem.content_quality?.replace(/_/g, ' ') || '—'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">People</p>
                  <p className="text-sm text-white">{selectedItem.people_count ?? '—'}</p>
                </div>
              </div>

              {/* Technical info */}
              <div className="grid grid-cols-4 gap-4 mb-4 p-3 rounded-lg bg-white/5">
                <div><p className="text-xs text-gray-500">Resolution</p><p className="text-sm text-white">{selectedItem.resolution || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Frame Rate</p><p className="text-sm text-white">{selectedItem.frame_rate || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Codec</p><p className="text-sm text-white">{selectedItem.codec || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Format</p><p className="text-sm text-white">{selectedItem.format?.toUpperCase() || '—'}</p></div>
              </div>

              {/* Vibe words */}
              {selectedItem.search_phrases?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Vibe Words</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.search_phrases.map((word: string) => (
                      <span key={word} className="text-xs px-2 py-0.5 rounded-full bg-[#D73F09]/20 text-orange-300 border border-[#D73F09]/30">{word}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval actions */}
              {selectedItem.triage_status === 'pending' && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => handleTriage(selectedItem.id, 'approved')}
                    className="px-6 py-2.5 bg-green-700 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Approve → Send to Editing
                  </button>
                  <button
                    onClick={() => handleTriage(selectedItem.id, 'flagged')}
                    className="px-6 py-2.5 bg-orange-700/50 hover:bg-orange-600/50 text-orange-300 font-medium rounded-lg transition-colors"
                  >
                    Flag for Review
                  </button>
                  <button
                    onClick={() => handleTriage(selectedItem.id, 'rejected')}
                    className="px-6 py-2.5 bg-red-700/50 hover:bg-red-600/50 text-red-300 font-medium rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TAB 4: Parse Brief                          */}
      {/* ============================================ */}
      {activeTab === 'brief' && (
        <div className="max-w-3xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Brief Intake Agent</h2>
            <p className="text-sm text-gray-400">
              Upload a raw brief (PDF or Word doc) and the Intake agent will parse it into structured fields.
              You review and correct before anything gets saved.
            </p>
          </div>

          {/* Brief upload zone */}
          <div
            onClick={() => briefInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all border-gray-600 hover:border-gray-400 hover:bg-white/5"
          >
            <div className="text-4xl mb-3">{briefParsing ? '⏳' : '📄'}</div>
            <p className="text-lg font-medium mb-1">
              {briefParsing ? 'Parsing brief...' : 'Drop a brief document here'}
            </p>
            <p className="text-sm text-gray-400">
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
            <div className="mt-6 p-6 rounded-lg bg-white/5 border border-white/10">
              {'error' in parsedBrief ? (
                <div className="text-red-400">
                  <p className="font-medium">Parsing failed</p>
                  <p className="text-sm mt-1">{parsedBrief.error as string}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Parsed Brief Fields</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-600/20 text-green-300 border border-green-600/30">
                      AI Extracted
                    </span>
                  </div>

                  {/* Summary */}
                  {parsedBrief.raw_summary && (
                    <div className="mb-4 p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Summary</p>
                      <p className="text-sm text-gray-300">{parsedBrief.raw_summary as string}</p>
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
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="text-sm text-white">{parsedBrief[key] as string}</p>
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
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                          {key.replace(/_/g, ' ')}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {items.map((item: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
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
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Deadlines</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(parsedBrief.deadlines as Record<string, string>).map(([key, val]) => (
                          <div key={key} className="text-sm">
                            <span className="text-gray-400">{key.replace(/_/g, ' ')}:</span>{' '}
                            <span className="text-white">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence flags */}
                  {(parsedBrief.confidence_flags as Array<Record<string, string>>)?.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/30">
                      <p className="text-xs text-yellow-400 uppercase tracking-wider mb-2">
                        Needs Your Review
                      </p>
                      {(parsedBrief.confidence_flags as Array<Record<string, string>>).map((flag, i) => (
                        <div key={i} className="text-sm mb-2 last:mb-0">
                          <span className="text-yellow-300 font-medium">{flag.field}:</span>{' '}
                          <span className="text-gray-400">{flag.reason}</span>
                          {flag.suggestion && (
                            <p className="text-xs text-gray-500 mt-0.5">→ {flag.suggestion}</p>
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
                      className="px-6 py-2.5 bg-[#D73F09] hover:bg-[#b33507] text-white font-medium rounded-lg transition-colors"
                    >
                      Create Brief from This
                    </button>
                    <button
                      onClick={() => setParsedBrief(null)}
                      className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg transition-colors"
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
