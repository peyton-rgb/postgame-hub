// ============================================================
// Public Review Portal — /review/[token]
//
// External-facing review page for brands, agencies, and editors.
// No auth required — access is controlled by unique tokens.
//
// The page:
//   1. Looks up the review session by matching the token against
//      brand_token, agency_token, or editor_token
//   2. Determines the viewer's role from which token matched
//   3. Shows the video player, asset details, and comment thread
//   4. Brands can approve or request changes
//   5. All roles can add comments
//
// Light theme for professional external presentation:
//   bg-gray-50, white cards, clean typography
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

// --- Types ---

interface ReviewSession {
  id: string;
  created_at: string;
  updated_at: string;
  campaign_id: string | null;
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
  is_resolved: boolean;
}

type ViewerRole = 'brand' | 'agency' | 'editor';

// --- Status display ---

const STATUS_DISPLAY: Record<string, { label: string; color: string; bgColor: string }> = {
  pending_internal: {
    label: 'Under Review',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  pending_brand: {
    label: 'Awaiting Your Review',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  approved: {
    label: 'Approved',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
  },
  revision_requested: {
    label: 'Changes Requested',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
  },
};

// --- Helper: format timestamp ---

function formatTimestamp(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// --- Helper: format date ---

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- Author badge colors (light theme) ---

const AUTHOR_BADGE: Record<string, string> = {
  postgame: 'bg-purple-100 text-purple-700 border-purple-200',
  brand: 'bg-blue-100 text-blue-700 border-blue-200',
  agency: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  editor: 'bg-orange-100 text-orange-700 border-orange-200',
};

// ============================================================
// Main component
// ============================================================

export default function PublicReviewPage() {
  const params = useParams();
  const token = params?.token as string;

  // --- State ---
  const [review, setReview] = useState<ReviewSession | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [viewerRole, setViewerRole] = useState<ViewerRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Comment form
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Approval / rejection
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // --- Fetch review by token ---
  const fetchReview = useCallback(async () => {
    if (!token) return;

    setLoading(true);

    // We need to look up the review by token. Since this is a public page
    // with no auth, we use a dedicated public API approach via Supabase client.
    // We try each token column to find the matching session.
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Try brand_token first
      let { data: session } = await supabase
        .from('review_sessions')
        .select('*')
        .eq('brand_token', token)
        .single();

      let role: ViewerRole = 'brand';

      if (!session) {
        // Try agency_token
        const { data: agencySession } = await supabase
          .from('review_sessions')
          .select('*')
          .eq('agency_token', token)
          .single();
        session = agencySession;
        role = 'agency';
      }

      if (!session) {
        // Try editor_token
        const { data: editorSession } = await supabase
          .from('review_sessions')
          .select('*')
          .eq('editor_token', token)
          .single();
        session = editorSession;
        role = 'editor';
      }

      if (!session) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setReview(session);
      setViewerRole(role);

      // Fetch comments — brands only see brand + postgame comments
      let commentQuery = supabase
        .from('review_comments')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (role === 'brand') {
        commentQuery = commentQuery.in('author_type', ['brand', 'postgame']);
      }

      const { data: commentData } = await commentQuery;
      setComments(commentData ?? []);
    } catch (err) {
      console.error('[public-review] Error fetching review:', err);
      setNotFound(true);
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  // --- Add comment (public — uses anon Supabase client) ---
  const handleAddComment = async () => {
    if (!newComment.trim() || !review || !viewerRole) return;

    setSubmittingComment(true);

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      await supabase.from('review_comments').insert({
        session_id: review.id,
        author_type: viewerRole,
        comment_type: 'note',
        body: newComment.trim(),
        is_resolved: false,
      });

      setNewComment('');
      await fetchReview();
    } catch (err) {
      console.error('[public-review] Error adding comment:', err);
    }

    setSubmittingComment(false);
  };

  // --- Brand approve ---
  const handleBrandApprove = async () => {
    if (!review) return;

    setActionLoading(true);

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const now = new Date().toISOString();

      await supabase
        .from('review_sessions')
        .update({
          status: 'approved',
          brand_decision: 'approved',
          brand_decided_at: now,
          updated_at: now,
        })
        .eq('id', review.id);

      // Add approval comment
      await supabase.from('review_comments').insert({
        session_id: review.id,
        author_type: 'brand',
        comment_type: 'approval',
        body: 'Brand approved this asset.',
        is_resolved: false,
      });

      // Create final asset
      await supabase.from('final_assets').insert({
        campaign_id: review.campaign_id || null,
        review_session_id: review.id,
        title: review.asset_name || 'Untitled Asset',
        asset_type: 'video',
        file_url: review.video_url,
        athlete_name: review.athlete_name || null,
        status: 'ready',
      });

      setActionSuccess('approved');
      await fetchReview();
    } catch (err) {
      console.error('[public-review] Error approving:', err);
    }

    setActionLoading(false);
  };

  // --- Brand reject ---
  const handleBrandReject = async () => {
    if (!review || !rejectFeedback.trim()) return;

    setActionLoading(true);

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const now = new Date().toISOString();
      const newRevisionRound = (review.revision_round || 1) + 1;

      await supabase
        .from('review_sessions')
        .update({
          status: 'revision_requested',
          brand_decision: 'changes_requested',
          brand_decided_at: now,
          revision_round: newRevisionRound,
          updated_at: now,
        })
        .eq('id', review.id);

      // Add rejection comment
      await supabase.from('review_comments').insert({
        session_id: review.id,
        author_type: 'brand',
        comment_type: 'revision',
        body: rejectFeedback.trim(),
        is_resolved: false,
      });

      setShowRejectForm(false);
      setRejectFeedback('');
      setActionSuccess('rejected');
      await fetchReview();
    } catch (err) {
      console.error('[public-review] Error rejecting:', err);
    }

    setActionLoading(false);
  };

  // ============================================================
  // Loading state
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  // ============================================================
  // Not found
  // ============================================================

  if (notFound || !review || !viewerRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Review Not Found</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This review link may have expired or is invalid.
            Please contact the Postgame team for an updated link.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // Main render
  // ============================================================

  const statusDisplay = STATUS_DISPLAY[review.status] || STATUS_DISPLAY.pending_internal;
  const isBrandViewer = viewerRole === 'brand';
  const canApprove = isBrandViewer && review.status === 'pending_brand';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              POSTGAME
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Content Review
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${statusDisplay.bgColor} ${statusDisplay.color}`}
            >
              {statusDisplay.label}
            </span>
            <span className="text-xs text-gray-400 capitalize">
              {viewerRole} view
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Success banner */}
        {actionSuccess && (
          <div
            className={`mb-6 p-4 rounded-xl border ${
              actionSuccess === 'approved'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <p className="text-sm font-medium">
              {actionSuccess === 'approved'
                ? 'Thank you! This asset has been approved and the team will proceed with delivery.'
                : 'Your feedback has been submitted. The team will make the requested changes.'}
            </p>
          </div>
        )}

        {/* Asset info card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          {/* Video player */}
          {review.video_url && (
            <div className="bg-black">
              <video
                src={review.video_url}
                controls
                className="w-full aspect-video"
              />
            </div>
          )}

          {/* Asset details */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              {review.asset_name || 'Untitled Asset'}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
              {review.athlete_name && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {review.athlete_name}
                </span>
              )}
              <span>Version {review.version_number}</span>
              {review.revision_round > 1 && (
                <span>Revision round {review.revision_round}</span>
              )}
              {review.video_duration_seconds && (
                <span>{formatTimestamp(review.video_duration_seconds)}</span>
              )}
            </div>

            {/* Notes */}
            {review.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Notes
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">{review.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Brand action buttons */}
        {canApprove && !actionSuccess && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Your Decision</h3>

            {!showRejectForm ? (
              <div className="flex gap-3">
                <button
                  onClick={handleBrandApprove}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  {actionLoading ? 'Processing...' : 'Approve'}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-white hover:bg-gray-50 text-red-600 text-sm font-semibold rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                >
                  Request Changes
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={rejectFeedback}
                  onChange={(e) => setRejectFeedback(e.target.value)}
                  placeholder="Please describe the changes you'd like..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectFeedback('');
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBrandReject}
                    disabled={actionLoading || !rejectFeedback.trim()}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comment thread */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Feedback ({comments.length})
          </h3>

          {comments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No comments yet. Add your feedback below.
            </p>
          ) : (
            <div className="space-y-4 mb-6">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="border border-gray-100 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${
                          AUTHOR_BADGE[comment.author_type] || AUTHOR_BADGE.postgame
                        }`}
                      >
                        {comment.author_type}
                      </span>
                      {comment.comment_type !== 'note' && (
                        <span className="text-[10px] text-gray-400 uppercase font-medium">
                          {comment.comment_type}
                        </span>
                      )}
                      {comment.timestamp_seconds !== null && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          @ {formatTimestamp(comment.timestamp_seconds)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment form */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex gap-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={`Add your feedback as ${viewerRole}...`}
                rows={2}
                className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleAddComment();
                  }
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={submittingComment || !newComment.trim()}
                className="self-end px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-30"
              >
                {submittingComment ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 mb-4">
          <p className="text-xs text-gray-400">
            Powered by Postgame
          </p>
        </div>
      </main>
    </div>
  );
}
