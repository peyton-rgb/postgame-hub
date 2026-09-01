// ============================================================
// Inspo Triage — /dashboard/inspo/triage
//
// Fast, single-item review queue for pending inspo assets.
// Approving an item marks it triage_status='approved' and
// sets approved_by to the current user's ID, which unblocks
// pgvector similarity search across the library.
//
// Features:
//   - Keyboard-first (A: Approve, R: Reject, S: Skip, ←: Undo)
//   - Mobile-first (verified at 390px, bottom thumb-reachable controls)
//   - Optimistic UI (instant advance, background DB sync, rollback on error)
//   - Prefetch buffer (seamless zero-latency transitions)
//   - Handles both video (.mp4, video/*) and image media without thumbnail dependency
//   - Optional non-blocking reject reason
//   - Postgame Design System (dark #07070A, #D73F09 accent, Bebas Neue count, JetBrains Mono tags)
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';
import type { InspoItem, ContentType } from '@/lib/types/intake';

// Content type labels & styling
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
  produced: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  athlete_ugc: 'bg-green-500/10 text-green-300 border-green-500/30',
  bts: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  raw_footage: 'bg-[#D73F09]/10 text-[#e8663d] border-[#D73F09]/30',
  photography: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  talking_head: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
  inspo_external: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
};

const QUICK_REJECT_REASONS = [
  'Low visual quality',
  'Off brand / not relevant',
  'Duplicate asset',
  'Poor composition / lighting',
];

interface HistoryEntry {
  item: InspoItem;
  action: 'approved' | 'rejected' | 'skipped';
  reason?: string;
  timestamp: number;
}

const BUFFER_TARGET = 10;
const PREFETCH_THRESHOLD = 4;

export default function InspoTriagePage() {
  const supabase = createBrowserSupabase();

  // --- State ---
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [items, setItems] = useState<InspoItem[]>([]);
  const [initialTotal, setInitialTotal] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [triagedCount, setTriagedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Reject reason dialog state
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Undo history stack
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Tracking loaded IDs to avoid duplicate fetches
  const fetchedIdsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef<boolean>(false);
  const reasonInputRef = useRef<HTMLInputElement | null>(null);

  // --- Authenticate user ---
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser({ id: data.user.id });
      }
    });
  }, [supabase]);

  // --- Fetch pending items buffer ---
  const fetchPendingBuffer = useCallback(
    async (isInitial = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        if (isInitial) {
          // Get total pending count for accurate progress tracking
          const { count } = await supabase
            .from('inspo_items')
            .select('id', { count: 'exact', head: true })
            .eq('triage_status', 'pending');

          const total = count ?? 0;
          setPendingCount(total);
          setInitialTotal(total);
        }

        // Fetch pending items buffer
        const { data, error } = await supabase
          .from('inspo_items')
          .select('*')
          .eq('triage_status', 'pending')
          .order('created_at', { ascending: true })
          .limit(BUFFER_TARGET * 2);

        if (error) {
          console.error('Failed to fetch pending buffer:', error);
          setErrorToast('Failed to load pending items. Please refresh.');
        } else if (data) {
          // Filter out items we've already loaded or acted on
          const newItems = (data as InspoItem[]).filter(
            (item) => !fetchedIdsRef.current.has(item.id)
          );

          newItems.forEach((item) => fetchedIdsRef.current.add(item.id));

          setItems((prev) => {
            const merged = [...prev, ...newItems];
            return merged;
          });
        }
      } catch (err) {
        console.error('Buffer fetch error:', err);
      } finally {
        isFetchingRef.current = false;
        if (isInitial) setLoading(false);
      }
    },
    [supabase]
  );

  // Initial load
  useEffect(() => {
    fetchPendingBuffer(true);
  }, [fetchPendingBuffer]);

  // Prefetch when buffer gets low
  useEffect(() => {
    if (!loading && items.length <= PREFETCH_THRESHOLD && pendingCount > items.length) {
      fetchPendingBuffer(false);
    }
  }, [items.length, loading, pendingCount, fetchPendingBuffer]);

  // Focus input when reject modal opens
  useEffect(() => {
    if (showRejectModal) {
      setTimeout(() => reasonInputRef.current?.focus(), 50);
    }
  }, [showRejectModal]);

  const currentItem: InspoItem | undefined = items[0];

  // --- Action: Approve ---
  const handleApprove = useCallback(async () => {
    if (!currentItem) return;

    const itemToApprove = currentItem;

    // Optimistic UI state update
    setItems((prev) => prev.slice(1));
    setPendingCount((prev) => Math.max(0, prev - 1));
    setTriagedCount((prev) => prev + 1);

    const newHistoryEntry: HistoryEntry = {
      item: itemToApprove,
      action: 'approved',
      timestamp: Date.now(),
    };
    setHistory((prev) => [...prev, newHistoryEntry]);

    // Asynchronous database write
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('inspo_items')
      .update({
        triage_status: 'approved',
        approved_by: currentUser?.id || null,
        approved_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', itemToApprove.id);

    if (error) {
      console.error('Approve failed:', error);
      setErrorToast(`Failed to approve asset ${itemToApprove.id.slice(0, 8)}`);
      // Rollback
      setItems((prev) => [itemToApprove, ...prev]);
      setPendingCount((prev) => prev + 1);
      setTriagedCount((prev) => Math.max(0, prev - 1));
      setHistory((prev) => prev.filter((h) => h.timestamp !== newHistoryEntry.timestamp));
    }
  }, [currentItem, currentUser, supabase]);

  // --- Action: Trigger / Submit Reject ---
  const handleOpenRejectModal = useCallback(() => {
    if (!currentItem) return;
    setRejectReason('');
    setShowRejectModal(true);
  }, [currentItem]);

  const handleConfirmReject = useCallback(
    async (reasonText: string = rejectReason) => {
      if (!currentItem) return;

      const itemToReject = currentItem;
      const cleanReason = reasonText.trim();
      setShowRejectModal(false);

      // Optimistic UI state update
      setItems((prev) => prev.slice(1));
      setPendingCount((prev) => Math.max(0, prev - 1));
      setTriagedCount((prev) => prev + 1);

      const newHistoryEntry: HistoryEntry = {
        item: itemToReject,
        action: 'rejected',
        reason: cleanReason || undefined,
        timestamp: Date.now(),
      };
      setHistory((prev) => [...prev, newHistoryEntry]);

      // Database update payload
      const nowIso = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        triage_status: 'rejected',
        approved_by: currentUser?.id || null,
        approved_at: nowIso,
        updated_at: nowIso,
      };

      // Store reason in notes if provided (since triage_reason is not in DB schema)
      if (cleanReason) {
        updatePayload.notes = itemToReject.notes
          ? `${itemToReject.notes} | Triage reject: ${cleanReason}`
          : `Triage reject: ${cleanReason}`;
      }

      const { error } = await supabase
        .from('inspo_items')
        .update(updatePayload)
        .eq('id', itemToReject.id);

      if (error) {
        console.error('Reject failed:', error);
        setErrorToast(`Failed to reject asset ${itemToReject.id.slice(0, 8)}`);
        // Rollback
        setItems((prev) => [itemToReject, ...prev]);
        setPendingCount((prev) => prev + 1);
        setTriagedCount((prev) => Math.max(0, prev - 1));
        setHistory((prev) => prev.filter((h) => h.timestamp !== newHistoryEntry.timestamp));
      }
    },
    [currentItem, currentUser, rejectReason, supabase]
  );

  // --- Action: Skip ---
  const handleSkip = useCallback(() => {
    if (!currentItem) return;

    const itemToSkip = currentItem;

    // Shift item to end of local queue (no DB update)
    setItems((prev) => [...prev.slice(1), itemToSkip]);

    const newHistoryEntry: HistoryEntry = {
      item: itemToSkip,
      action: 'skipped',
      timestamp: Date.now(),
    };
    setHistory((prev) => [...prev, newHistoryEntry]);
  }, [currentItem]);

  // --- Action: Undo ---
  const handleUndo = useCallback(async () => {
    if (history.length === 0) return;

    const lastEntry = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));

    if (lastEntry.action === 'skipped') {
      // Re-insert skipped item at front
      setItems((prev) => [lastEntry.item, ...prev.filter((i) => i.id !== lastEntry.item.id)]);
      return;
    }

    // Re-insert approved/rejected item at the front
    setItems((prev) => [lastEntry.item, ...prev]);
    setPendingCount((prev) => prev + 1);
    setTriagedCount((prev) => Math.max(0, prev - 1));

    // Revert DB record back to pending
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('inspo_items')
      .update({
        triage_status: 'pending',
        approved_by: null,
        approved_at: null,
        updated_at: nowIso,
      })
      .eq('id', lastEntry.item.id);

    if (error) {
      console.error('Undo failed in database:', error);
      setErrorToast(`Failed to rollback asset ${lastEntry.item.id.slice(0, 8)}`);
    }
  }, [history, supabase]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in any input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        if (showRejectModal) {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmReject();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowRejectModal(false);
          }
        }
        return;
      }

      if (showRejectModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowRejectModal(false);
        }
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleOpenRejectModal();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowLeft' || (e.key === 'z' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleApprove,
    handleOpenRejectModal,
    handleConfirmReject,
    handleSkip,
    handleUndo,
    showRejectModal,
  ]);

  // Determine media type
  const isVideo = Boolean(
    currentItem &&
      (currentItem.mime_type?.startsWith('video/') ||
        currentItem.file_url?.match(/\.(mp4|mov|webm)(\?|$)/i))
  );

  // Format duration helper
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Collect all tags from pro_tags, social_tags, context_tags, search_phrases
  const allTags: { group: string; label: string }[] = [];
  if (currentItem) {
    if (currentItem.search_phrases && Array.isArray(currentItem.search_phrases)) {
      currentItem.search_phrases.forEach((phrase) => {
        if (phrase) allTags.push({ group: 'Vibe', label: phrase });
      });
    }

    const collectFromGroup = (
      groupName: string,
      groupObj: Record<string, string[]> | undefined | null
    ) => {
      if (!groupObj || typeof groupObj !== 'object') return;
      Object.entries(groupObj).forEach(([_, tagList]) => {
        if (Array.isArray(tagList)) {
          tagList.forEach((tag) => {
            if (tag) allTags.push({ group: groupName, label: tag });
          });
        }
      });
    };

    collectFromGroup('Pro', currentItem.pro_tags as unknown as Record<string, string[]>);
    collectFromGroup('Social', currentItem.social_tags as unknown as Record<string, string[]>);
    collectFromGroup('Context', currentItem.context_tags as unknown as Record<string, string[]>);
  }

  // Progress percentage calculation
  const totalItemsCount = initialTotal || pendingCount;
  const progressPercent =
    totalItemsCount > 0
      ? Math.min(100, Math.max(0, (triagedCount / totalItemsCount) * 100))
      : 100;

  return (
    <div className="min-h-screen bg-[#07070A] text-[#FAF8F5] flex flex-col justify-between selection:bg-[#D73F09]/30">
      {/* Top Header & Progress Bar */}
      <header className="sticky top-0 z-30 bg-[#07070A]/95 backdrop-blur-md border-b border-white/10 px-4 md:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Back link & Title */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/inspo"
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <span>←</span>
              <span className="hidden sm:inline">Inspo Library</span>
            </Link>
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-white uppercase font-mono">
                Inspo Triage
              </h1>
            </div>
          </div>

          {/* Progress stats */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-display text-xl md:text-2xl text-white tracking-wider leading-none">
                {triagedCount}{' '}
                <span className="text-gray-500 text-sm font-sans">of</span>{' '}
                {totalItemsCount}
              </div>
              <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                {pendingCount} pending remaining
              </div>
            </div>

            {/* Quick Undo button in header */}
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo last action (←)"
              className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed text-gray-300 hover:text-white transition-all text-xs flex items-center gap-1 font-mono"
            >
              <span>↩</span>
              <span className="hidden md:inline">Undo</span>
            </button>
          </div>
        </div>

        {/* Thin progress bar */}
        <div className="max-w-6xl mx-auto mt-2.5 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D73F09]/80 to-[#D73F09] transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Error Toast */}
      {errorToast && (
        <div className="fixed top-20 right-4 z-50 bg-red-950/90 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3">
          <span>⚠️ {errorToast}</span>
          <button
            onClick={() => setErrorToast(null)}
            className="text-red-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 md:py-6 flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-10 h-10 border-2 border-[#D73F09] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-mono text-gray-400">Loading pending triage queue...</p>
          </div>
        ) : !currentItem ? (
          /* Zero-state completion screen */
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 md:p-14 text-center max-w-xl mx-auto my-12 shadow-2xl">
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="font-display text-4xl text-white tracking-wider mb-2">
              TRIAGE COMPLETE
            </h2>
            <p className="text-base text-[#FAF8F5]/70 mb-6 leading-relaxed">
              All {initialTotal || '500+'} pending assets have been reviewed. The Creative Brain is
              now fully searchable across the entire library.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard/inspo"
                className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all"
              >
                Browse Inspo Library
              </Link>
              {history.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-sm transition-all"
                >
                  ↩ Undo Last ({history[history.length - 1].action})
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Active Item Viewer */
          <div className="space-y-4">
            {/* Dominant Media Container */}
            <div className="relative w-full rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center min-h-[280px] max-h-[58vh] shadow-2xl group">
              {isVideo ? (
                <video
                  key={currentItem.id}
                  src={currentItem.file_url || undefined}
                  poster={currentItem.thumbnail_url || undefined}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="max-h-[56vh] w-auto max-w-full object-contain mx-auto"
                />
              ) : currentItem.file_url || currentItem.thumbnail_url ? (
                <img
                  src={currentItem.file_url || currentItem.thumbnail_url || ''}
                  alt={currentItem.visual_description || 'Inspo asset'}
                  className="max-h-[56vh] w-auto max-w-full object-contain mx-auto"
                />
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center text-gray-500 py-16">
                  <span className="text-4xl mb-2">🎬</span>
                  <span className="text-sm font-mono text-gray-400">No media preview available</span>
                </div>
              )}

              {/* Bottom soft gradient blend */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#07070A] to-transparent opacity-80" />

              {/* Top Media Badges */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10 pointer-events-none">
                <span
                  className={`px-2.5 py-1 text-xs font-mono uppercase tracking-wider rounded-lg border backdrop-blur-md ${
                    CONTENT_TYPE_COLORS[currentItem.content_type]
                  }`}
                >
                  {CONTENT_TYPE_LABELS[currentItem.content_type] || currentItem.content_type}
                </span>

                {currentItem.sport && (
                  <span className="px-2.5 py-1 text-xs font-mono uppercase rounded-lg border border-white/20 bg-black/60 backdrop-blur-md text-gray-200">
                    {currentItem.sport}
                  </span>
                )}
              </div>

              {/* Duration badge */}
              {currentItem.duration_seconds && (
                <div className="absolute top-3 right-3 z-10 pointer-events-none px-2.5 py-1 bg-black/70 border border-white/10 backdrop-blur-md rounded-lg text-xs font-mono text-white">
                  {formatDuration(currentItem.duration_seconds)}
                </div>
              )}
            </div>

            {/* Asset Metadata & Description Details */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 md:p-5 space-y-3.5">
              {/* AI Visual Description */}
              {currentItem.visual_description ? (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                    AI Visual Description
                  </h3>
                  <p className="text-base md:text-lg text-[#FAF8F5]/85 leading-relaxed font-normal">
                    {currentItem.visual_description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No visual description available.</p>
              )}

              {/* Tag Chips */}
              {allTags.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-2">
                    Tags & Vibe Phrases
                  </h4>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {allTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:border-white/25 transition-colors"
                      >
                        <span className="text-gray-500 text-[9px]">{tag.group}:</span>
                        <span>{tag.label.replace(/_/g, ' ')}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Secondary Details Row */}
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-400">
                <div className="flex items-center gap-3">
                  {currentItem.athlete_name && (
                    <span>
                      Athlete: <strong className="text-gray-200">{currentItem.athlete_name}</strong>
                    </span>
                  )}
                  {currentItem.school && (
                    <span>
                      School: <strong className="text-gray-200">{currentItem.school}</strong>
                    </span>
                  )}
                  {currentItem.source && (
                    <span className="hidden sm:inline">
                      Source: <span className="text-gray-300">{currentItem.source}</span>
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-gray-500">
                  ID: {currentItem.id.slice(0, 8)}... •{' '}
                  {new Date(currentItem.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Reject Reason Modal / Input Sheet */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#0e0e14] border border-white/15 rounded-2xl w-full max-w-lg p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="text-red-400">✕</span> Reject Asset
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-white text-sm font-mono px-2 py-1"
              >
                Esc to cancel
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-3">
              Optional feedback reason. Press <kbd className="px-1 py-0.5 bg-white/10 rounded">Enter</kbd> to confirm or skip.
            </p>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5 mb-3.5">
              {QUICK_REJECT_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setRejectReason(reason);
                    handleConfirmReject(reason);
                  }}
                  className="text-xs font-mono px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-red-500/40 hover:bg-red-500/10 text-gray-300 hover:text-red-300 transition-colors text-left"
                >
                  {reason}
                </button>
              ))}
            </div>

            {/* Freeform input */}
            <input
              ref={reasonInputRef}
              type="text"
              placeholder="Or type a custom reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500/50 mb-4 font-sans"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleConfirmReject('')}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-mono transition-colors"
              >
                Reject without reason [Enter]
              </button>
              <button
                onClick={() => handleConfirmReject(rejectReason)}
                className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-200 text-xs font-medium transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thumb-Reachable Sticky Bottom Action Bar */}
      <footer className="sticky bottom-0 z-30 bg-[#07070A]/95 backdrop-blur-lg border-t border-white/10 px-4 py-3 md:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          {/* Reject Button */}
          <button
            onClick={handleOpenRejectModal}
            disabled={!currentItem}
            className="flex-1 py-3.5 px-4 rounded-xl border border-red-500/30 bg-red-950/20 hover:bg-red-900/30 active:scale-95 text-red-300 font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-30 disabled:pointer-events-none"
          >
            <span>✕ Reject</span>
            <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-red-900/40 text-[10px] font-mono text-red-200 border border-red-700/50">
              R
            </span>
          </button>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            disabled={!currentItem}
            className="py-3.5 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 text-gray-300 hover:text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
          >
            <span>Skip</span>
            <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-gray-400">
              S
            </span>
          </button>

          {/* Approve Button (#D73F09 accent on borders & text, never solid fill) */}
          <button
            onClick={handleApprove}
            disabled={!currentItem}
            className="flex-1 py-3.5 px-4 rounded-xl border-2 border-[#D73F09] bg-[#D73F09]/10 hover:bg-[#D73F09]/20 hover:border-[#ff5314] active:scale-95 text-[#ff6a38] font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(215,63,9,0.2)] disabled:opacity-30 disabled:pointer-events-none"
          >
            <span>✓ Approve</span>
            <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-[#D73F09]/30 text-[10px] font-mono text-[#ff8d66] border border-[#D73F09]/50">
              A
            </span>
          </button>
        </div>

        {/* Mobile keyboard hints */}
        <div className="max-w-3xl mx-auto mt-2 flex items-center justify-center gap-4 text-[11px] font-mono text-gray-500">
          <span>Key shortcuts: [A] Approve • [R] Reject • [S] Skip • [←] Undo</span>
        </div>
      </footer>
    </div>
  );
}
