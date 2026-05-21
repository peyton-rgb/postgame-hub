// ============================================================
// Review Dashboard — /dashboard/reviews
//
// The internal review queue where the Postgame team manages
// all content approvals. Two-gate workflow:
//   1. Internal review (Postgame approves first)
//   2. Brand review (brand gets a link to approve/reject)
//
// Features:
//   - Tab bar filtering by status
//   - Expandable detail view with video player + comment thread
//   - Add comment form for internal notes
//   - Approve/reject action buttons based on current status
//   - Status badges with color coding
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

interface ReviewSession {
  id: string;
  created_at: string;
  updated_at: string;
  campaign_id: string | null;
  inspo_item_id: string | null;
  version_number: number;
  video_url: string;
  video_duration_seconds: number | null;
  brand_token: string;
  agency_token: string;
  editor_token: string;
  status: string;
  brand_decision: string | null;
  brand_decided_at: string | null;
  revision_round: number;
  editor_deadline: string | null;
  asset_name: string | null;
  notes: string | null;
  brief_id: string | null;
  creator_brief_id: string | null;
  athlete_name: string | null;
}

interface ReviewComment {
  id: string;
  created_at: string;
  session_id: string;
  author_type: string;
  comment_type: string;
  timestamp_seconds: number | null;
  body: string;
  linked_brand_comment_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
}

// --- Status display config ---

type ReviewStatus = 'pending_internal' | 'pending_brand' | 'approved' | 'revision_requested';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_internal: {
    label: 'Pending Internal',
    color: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30',
  },
  pending_brand: {
    label: 'Pending Brand',
    color: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-600/20 text-green-300 border-green-600/30',
  },
  revision_requested: {
    label: 'Revisions',
    color: 'bg-red-600/20 text-red-300 border-red-600/30',
  },
};

const AUTHOR_COLORS: Record<string, string> = {
  postgame: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
  brand: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  agency: 'bg-cyan-600/20 text-cyan-300 border-cyan-600/30',
  editor: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
};

// --- Tabs ---

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending_internal', label: 'Pending Internal' },
  { key: 'pending_brand', label: 'Pending Brand' },
  { key: 'approved', label: 'Approved' },
  { key: 'revision_requested', label: 'Revisions' },
];

// --- Helper: format relative time ---

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- Helper: format timestamp for video ---

function formatTimestamp(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// ============================================================
// Main component
// ============================================================

export default function ReviewsDashboardPage() {
  const supabase = createBrowserSupabase();

  // --- State ---
  const [reviews, setReviews] = useState<ReviewSession[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Detail panel state
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewSession | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Comment form state
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState(false);

  // Copy link feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // --- Fetch review list ---
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50', offset: '0' });
    if (activeTab !== 'all') params.set('status', activeTab);

    const res = await fetch(`/api/reviews?${params}`);
    if (res.ok) {
      const data = await res.json();
      setReviews(data.reviews || []);
      setTotalReviews(data.total || 0);
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // --- Fetch detail for selected review ---
  const fetchDetail = useCallback(async (reviewId: string) => {
    setLoadingDetail(true);
    const res = await fetch(`/api/reviews/${reviewId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedReview(data.review);
      setComments(data.comments || []);
    }
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    if (selectedReviewId) {
      fetchDetail(selectedReviewId);
    }
  }, [selectedReviewId, fetchDetail]);

  // --- Add comment ---
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedReviewId) return;

    setSubmittingComment(true);
    const res = await fetch(`/api/reviews/${selectedReviewId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_type: 'postgame',
        comment_type: 'note',
        body: newComment.trim(),
      }),
    });

    if (res.ok) {
      setNewComment('');
      await fetchDetail(selectedReviewId);
    }
    setSubmittingComment(false);
  };

  // --- Approve internally ---
  const handleApproveInternal = async () => {
    if (!selectedReviewId) return;
    setActionLoading(true);

    const res = await fetch(`/api/reviews/${selectedReviewId}/approve`, {
      method: 'POST',
    });

    if (res.ok) {
      await fetchDetail(selectedReviewId);
      await fetchReviews();
    }
    setActionLoading(false);
  };

  // --- Reject / request changes ---
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');

  const handleReject = async () => {
    if (!selectedReviewId || !rejectFeedback.trim()) return;
    setActionLoading(true);

    const res = await fetch(`/api/reviews/${selectedReviewId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: rejectFeedback.trim() }),
    });

    if (res.ok) {
      setShowRejectForm(false);
      setRejectFeedback('');
      await fetchDetail(selectedReviewId);
      await fetchReviews();
    }
    setActionLoading(false);
  };

  // --- Copy review link ---
  const copyReviewLink = (token: string, label: string) => {
    const url = `${window.location.origin}/review/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(label);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // --- Close detail panel ---
  const closeDetail = () => {
    setSelectedReviewId(null);
    setSelectedReview(null);
    setComments([]);
    setShowRejectForm(false);
    setRejectFeedback('');
    setNewComment('');
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Review & Approval</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage content approvals — internal review first, then brand sign-off
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                closeDetail();
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main content area */}
        <div className="flex gap-6">
          {/* Left: Review list */}
          <div className={`${selectedReviewId ? 'w-1/2' : 'w-full'} transition-all`}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30" />
              </div>
            ) : reviews.length === 0 ? (
              // Empty state
              <div className="text-center py-20 border border-white/10 rounded-xl">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-lg font-semibold text-white/70 mb-2">No reviews yet</h3>
                <p className="text-sm text-white/40 max-w-md mx-auto">
                  Approved assets from the editing flow will appear here for review.
                  The two-gate approval process ensures quality before brand delivery.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Results count */}
                <div className="text-xs text-white/40 mb-3">
                  {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                </div>

                {reviews.map((review) => {
                  const statusCfg = STATUS_CONFIG[review.status] || {
                    label: review.status,
                    color: 'bg-gray-600/20 text-gray-300 border-gray-600/30',
                  };
                  const isSelected = selectedReviewId === review.id;

                  return (
                    <button
                      key={review.id}
                      onClick={() => setSelectedReviewId(review.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        isSelected
                          ? 'border-white/30 bg-white/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Asset name + athlete */}
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm truncate">
                              {review.asset_name || 'Untitled Asset'}
                            </h3>
                            {review.revision_round > 1 && (
                              <span className="text-xs text-white/40 flex-shrink-0">
                                R{review.revision_round}
                              </span>
                            )}
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center gap-3 text-xs text-white/40">
                            {review.athlete_name && (
                              <span>{review.athlete_name}</span>
                            )}
                            <span>{timeAgo(review.created_at)}</span>
                            {review.version_number > 1 && (
                              <span>v{review.version_number}</span>
                            )}
                          </div>
                        </div>

                        {/* Status badge */}
                        <span
                          className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Detail panel */}
          {selectedReviewId && (
            <div className="w-1/2 border border-white/10 rounded-xl bg-white/[0.02] overflow-hidden">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30" />
                </div>
              ) : selectedReview ? (
                <div className="flex flex-col h-full max-h-[calc(100vh-200px)]">
                  {/* Detail header */}
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">
                        {selectedReview.asset_name || 'Untitled Asset'}
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                        {selectedReview.athlete_name && (
                          <span>{selectedReview.athlete_name}</span>
                        )}
                        <span>Round {selectedReview.revision_round}</span>
                        <span>v{selectedReview.version_number}</span>
                      </div>
                    </div>
                    <button
                      onClick={closeDetail}
                      className="text-white/40 hover:text-white p-1"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Video player */}
                    {selectedReview.video_url && (
                      <div className="p-4 border-b border-white/10">
                        <video
                          src={selectedReview.video_url}
                          controls
                          className="w-full rounded-lg bg-black aspect-video"
                        />
                      </div>
                    )}

                    {/* Status + Actions */}
                    <div className="p-4 border-b border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                            (STATUS_CONFIG[selectedReview.status] || STATUS_CONFIG.pending_internal).color
                          }`}
                        >
                          {(STATUS_CONFIG[selectedReview.status] || { label: selectedReview.status }).label}
                        </span>

                        {/* Editor deadline */}
                        {selectedReview.editor_deadline && (
                          <span className="text-xs text-white/40">
                            Editor deadline:{' '}
                            {new Date(selectedReview.editor_deadline).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>

                      {/* Action buttons based on status */}
                      {selectedReview.status === 'pending_internal' && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleApproveInternal}
                            disabled={actionLoading}
                            className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionLoading ? 'Approving...' : 'Approve Internally'}
                          </button>
                          <button
                            onClick={() => setShowRejectForm(true)}
                            disabled={actionLoading}
                            className="flex-1 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-sm font-medium rounded-lg border border-red-600/30 transition-colors disabled:opacity-50"
                          >
                            Request Changes
                          </button>
                        </div>
                      )}

                      {selectedReview.status === 'pending_brand' && (
                        <div className="space-y-3">
                          <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
                            <p className="text-xs text-blue-300">
                              Waiting for brand approval. Share the review link with the brand contact.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyReviewLink(selectedReview.brand_token, 'brand')}
                              className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-sm rounded-lg border border-white/10 transition-colors"
                            >
                              {copiedToken === 'brand' ? 'Copied!' : 'Copy Brand Link'}
                            </button>
                            <button
                              onClick={() => copyReviewLink(selectedReview.agency_token, 'agency')}
                              className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-sm rounded-lg border border-white/10 transition-colors"
                            >
                              {copiedToken === 'agency' ? 'Copied!' : 'Copy Agency Link'}
                            </button>
                            <button
                              onClick={() => copyReviewLink(selectedReview.editor_token, 'editor')}
                              className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-sm rounded-lg border border-white/10 transition-colors"
                            >
                              {copiedToken === 'editor' ? 'Copied!' : 'Copy Editor Link'}
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedReview.status === 'approved' && (
                        <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-3">
                          <p className="text-xs text-green-300">
                            This asset has been approved and is ready for delivery.
                          </p>
                        </div>
                      )}

                      {selectedReview.status === 'revision_requested' && (
                        <div className="bg-red-600/10 border border-red-600/20 rounded-lg p-3">
                          <p className="text-xs text-red-300">
                            Changes requested — revision round {selectedReview.revision_round}.
                            Review the feedback below and re-submit.
                          </p>
                        </div>
                      )}

                      {/* Reject form */}
                      {showRejectForm && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={rejectFeedback}
                            onChange={(e) => setRejectFeedback(e.target.value)}
                            placeholder="Describe what changes are needed..."
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleReject}
                              disabled={actionLoading || !rejectFeedback.trim()}
                              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              {actionLoading ? 'Submitting...' : 'Submit Changes Request'}
                            </button>
                            <button
                              onClick={() => {
                                setShowRejectForm(false);
                                setRejectFeedback('');
                              }}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-sm rounded-lg border border-white/10 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {selectedReview.notes && (
                      <div className="p-4 border-b border-white/10">
                        <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">
                          Notes
                        </h4>
                        <p className="text-sm text-white/70">{selectedReview.notes}</p>
                      </div>
                    )}

                    {/* Comment thread */}
                    <div className="p-4">
                      <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                        Comments ({comments.length})
                      </h4>

                      {comments.length === 0 ? (
                        <p className="text-sm text-white/30 py-4 text-center">
                          No comments yet
                        </p>
                      ) : (
                        <div className="space-y-3 mb-4">
                          {comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="bg-white/[0.03] border border-white/5 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                      AUTHOR_COLORS[comment.author_type] || AUTHOR_COLORS.postgame
                                    }`}
                                  >
                                    {comment.author_type}
                                  </span>
                                  {comment.comment_type !== 'note' && (
                                    <span className="text-[10px] text-white/30 uppercase">
                                      {comment.comment_type}
                                    </span>
                                  )}
                                  {comment.timestamp_seconds !== null && (
                                    <span className="text-[10px] text-white/30 font-mono">
                                      @ {formatTimestamp(comment.timestamp_seconds)}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-white/20">
                                  {timeAgo(comment.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-white/70 leading-relaxed">
                                {comment.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add comment form */}
                      <div className="flex gap-2">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add an internal note..."
                          rows={2}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.metaKey) {
                              handleAddComment();
                            }
                          }}
                        />
                        <button
                          onClick={handleAddComment}
                          disabled={submittingComment || !newComment.trim()}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-sm font-medium rounded-lg transition-colors disabled:opacity-30 self-end"
                        >
                          {submittingComment ? '...' : 'Send'}
                        </button>
                      </div>
                      <p className="text-[10px] text-white/20 mt-1">
                        Cmd+Enter to send
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
