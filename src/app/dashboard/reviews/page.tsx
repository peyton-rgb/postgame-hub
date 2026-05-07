'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';

// --- Types ---

type ReviewStatus = 'draft' | 'in_review' | 'revision_requested' | 'approved';

interface ReviewSession {
  id: string;
  asset_name: string;
  athlete_name: string | null;
  status: ReviewStatus;
  revision_round: number;
  video_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewComment {
  id: string;
  session_id: string;
  author: string | null;
  body: string;
  timestamp_seconds: number | null;
  created_at: string;
}

// --- Helpers ---

const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  revision_requested: 'Revision Requested',
  approved: 'Approved',
};

const STATUS_COLORS: Record<ReviewStatus, string> = {
  draft: 'bg-gray-600/20 text-gray-300 border-gray-600/30',
  in_review: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  revision_requested: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30',
  approved: 'bg-green-600/20 text-green-300 border-green-600/30',
};

const FILTER_TABS: { label: string; value: ReviewStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Revision Requested', value: 'revision_requested' },
  { label: 'Approved', value: 'approved' },
];

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component ---

export default function ReviewsPage() {
  const supabase = createBrowserSupabase();

  // --- State ---
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newTimestamp, setNewTimestamp] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editorAgentResult, setEditorAgentResult] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ asset_name: '', athlete_name: '', video_url: '', notes: '' });
  const [creating, setCreating] = useState(false);

  // --- Fetch sessions ---
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('review_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setSessions(data as ReviewSession[]);
    }
    setLoading(false);
  }, [filter, supabase]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // --- Fetch comments for expanded session ---
  const fetchComments = useCallback(
    async (sessionId: string) => {
      setCommentsLoading(true);
      const { data, error } = await supabase
        .from('review_comments')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setComments(data as ReviewComment[]);
      }
      setCommentsLoading(false);
    },
    [supabase]
  );

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setComments([]);
      setEditorAgentResult(null);
      return;
    }
    setExpandedId(id);
    setEditorAgentResult(null);
    fetchComments(id);
  };

  // --- Add comment ---
  const handleAddComment = async () => {
    if (!expandedId || !newComment.trim()) return;
    setSubmittingComment(true);

    let tsSeconds: number | null = null;
    if (newTimestamp.trim()) {
      const parts = newTimestamp.split(':');
      if (parts.length === 2) {
        tsSeconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    }

    const { error } = await supabase.from('review_comments').insert({
      session_id: expandedId,
      body: newComment.trim(),
      timestamp_seconds: tsSeconds,
      author: 'Staff',
    });

    if (!error) {
      setNewComment('');
      setNewTimestamp('');
      fetchComments(expandedId);
    }
    setSubmittingComment(false);
  };

  // --- Approve ---
  const handleApprove = async (sessionId: string) => {
    setActionLoading('approve');
    try {
      const res = await fetch(`/api/reviews/${sessionId}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchSessions();
        if (expandedId === sessionId) fetchComments(sessionId);
      }
    } catch {
      // silent
    }
    setActionLoading(null);
  };

  // --- Request Changes ---
  const handleRequestChanges = async (sessionId: string) => {
    setActionLoading('changes');
    try {
      const res = await fetch(`/api/reviews/${sessionId}/request-changes`, { method: 'POST' });
      if (res.ok) {
        fetchSessions();
        if (expandedId === sessionId) fetchComments(sessionId);
      }
    } catch {
      // silent
    }
    setActionLoading(null);
  };

  // --- Run Editor Agent ---
  const handleRunEditorAgent = async (sessionId: string) => {
    setActionLoading('editor');
    setEditorAgentResult(null);
    try {
      const res = await fetch('/api/agents/editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditorAgentResult(
          typeof data.result === 'string' ? data.result : JSON.stringify(data, null, 2)
        );
      } else {
        setEditorAgentResult('Editor agent returned an error.');
      }
    } catch {
      setEditorAgentResult('Failed to reach the editor agent.');
    }
    setActionLoading(null);
  };

  // --- Create new review session ---
  const handleCreate = async () => {
    if (!newForm.asset_name.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('review_sessions').insert({
      asset_name: newForm.asset_name.trim(),
      athlete_name: newForm.athlete_name.trim() || null,
      video_url: newForm.video_url.trim() || null,
      notes: newForm.notes.trim() || null,
      status: 'draft',
      revision_round: 1,
    });
    if (!error) {
      setShowNewModal(false);
      setNewForm({ asset_name: '', athlete_name: '', video_url: '', notes: '' });
      fetchSessions();
    }
    setCreating(false);
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top bar */}
      <div className="border-b border-gray-800 px-8 py-5">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Review &amp; Approval</h1>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-5 py-2.5 rounded-lg font-semibold text-white transition-colors"
            style={{ backgroundColor: '#D73F09' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#bf3508')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#D73F09')}
          >
            + New Review
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.value
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-gray-500">Loading review sessions...</div>
        )}

        {/* Empty state */}
        {!loading && sessions.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No review sessions found.</p>
            <p className="text-gray-600 text-sm mt-2">
              Click &ldquo;+ New Review&rdquo; to create your first review session.
            </p>
          </div>
        )}

        {/* Cards grid */}
        {!loading && sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <div key={session.id}>
                {/* Card */}
                <button
                  onClick={() => handleExpand(session.id)}
                  className={`w-full text-left rounded-xl border p-5 transition-colors ${
                    expandedId === session.id
                      ? 'border-[#D73F09] bg-gray-800'
                      : 'border-gray-700 bg-gray-800/60 hover:bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-bold text-lg leading-tight">{session.asset_name}</h3>
                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        STATUS_COLORS[session.status]
                      }`}
                    >
                      {STATUS_LABELS[session.status]}
                    </span>
                  </div>

                  {session.athlete_name && (
                    <p className="text-sm text-gray-400 mb-1">
                      Athlete: <span className="text-gray-300">{session.athlete_name}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                    <span>Round {session.revision_round}</span>
                    <span>{formatDate(session.created_at)}</span>
                  </div>
                </button>

                {/* Expanded details */}
                {expandedId === session.id && (
                  <div className="mt-2 rounded-xl border border-gray-700 bg-gray-800 p-6 space-y-6">
                    {/* Video URL */}
                    {session.video_url && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Video URL
                        </h4>
                        <a
                          href={session.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 underline break-all"
                        >
                          {session.video_url}
                        </a>
                      </div>
                    )}

                    {/* Notes */}
                    {session.notes && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Notes
                        </h4>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{session.notes}</p>
                      </div>
                    )}

                    {/* Comments */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Comments
                      </h4>

                      {commentsLoading ? (
                        <p className="text-sm text-gray-600">Loading comments...</p>
                      ) : comments.length === 0 ? (
                        <p className="text-sm text-gray-600">No comments yet.</p>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                          {comments.map((c) => (
                            <div
                              key={c.id}
                              className="bg-gray-900/60 rounded-lg px-4 py-3 text-sm"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {c.author && (
                                  <span className="font-semibold text-gray-300">{c.author}</span>
                                )}
                                {c.timestamp_seconds !== null && (
                                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                                    {formatTimestamp(c.timestamp_seconds)}
                                  </span>
                                )}
                                <span className="text-xs text-gray-600 ml-auto">
                                  {formatDate(c.created_at)}
                                </span>
                              </div>
                              <p className="text-gray-300">{c.body}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add comment form */}
                      <div className="mt-4 flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                        />
                        <input
                          type="text"
                          placeholder="MM:SS"
                          value={newTimestamp}
                          onChange={(e) => setNewTimestamp(e.target.value)}
                          className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 font-mono text-center"
                        />
                        <button
                          onClick={handleAddComment}
                          disabled={submittingComment || !newComment.trim()}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {submittingComment ? '...' : 'Send'}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-700">
                      <button
                        onClick={() => handleApprove(session.id)}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleRequestChanges(session.id)}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === 'changes' ? 'Sending...' : 'Request Changes'}
                      </button>
                      <button
                        onClick={() => handleRunEditorAgent(session.id)}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                        style={{ backgroundColor: '#D73F09' }}
                        onMouseEnter={(e) =>
                          actionLoading === null &&
                          (e.currentTarget.style.backgroundColor = '#bf3508')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#D73F09')}
                      >
                        {actionLoading === 'editor' ? 'Running...' : 'Run Editor Agent'}
                      </button>
                    </div>

                    {/* Editor agent result */}
                    {editorAgentResult && (
                      <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Editor Agent Result
                        </h4>
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {editorAgentResult}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Review Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">New Review Session</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-gray-500 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Asset Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newForm.asset_name}
                  onChange={(e) => setNewForm({ ...newForm, asset_name: e.target.value })}
                  placeholder="e.g. Halftime Hype Reel v1"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Athlete Name
                </label>
                <input
                  type="text"
                  value={newForm.athlete_name}
                  onChange={(e) => setNewForm({ ...newForm, athlete_name: e.target.value })}
                  placeholder="e.g. Travis Hunter"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Video URL</label>
                <input
                  type="url"
                  value={newForm.video_url}
                  onChange={(e) => setNewForm({ ...newForm, video_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
                <textarea
                  value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Any context for the reviewer..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newForm.asset_name.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#D73F09' }}
                onMouseEnter={(e) =>
                  !creating && (e.currentTarget.style.backgroundColor = '#bf3508')
                }
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#D73F09')}
              >
                {creating ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
