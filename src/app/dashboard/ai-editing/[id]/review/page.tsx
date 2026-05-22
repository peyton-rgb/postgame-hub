// ============================================================
// Edit Review Page — /dashboard/ai-editing/[id]/review
//
// The before/after comparison page where CMs review an AI edit.
// Shows:
//   - Side-by-side original vs edited asset
//   - Synced video playback (both videos play/pause together)
//   - The edit instruction and plan steps
//   - Cost and timing breakdown
//   - Approve / Request Changes / Reject buttons
// ============================================================

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { EditJob, EditStep, EditJobStatus } from '@/lib/types/editing';

export default function EditReviewPage({ params }: { params: { id: string } }) {
  const supabase = createBrowserSupabase();
  const jobId = params.id;

  // --- State ---
  const [job, setJob] = useState<EditJob | null>(null);
  const [steps, setSteps] = useState<EditStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [changesFeedback, setChangesFeedback] = useState('');

  // Video sync refs
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const editedVideoRef = useRef<HTMLVideoElement>(null);

  // --- Fetch job data ---
  const fetchJob = useCallback(async () => {
    const res = await fetch(`/api/editing/jobs/${jobId}`);
    if (res.ok) {
      const data = await res.json();
      setJob(data.job);
      setSteps(data.steps || []);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Poll while job is still processing
  useEffect(() => {
    if (!job) return;
    const activeStatuses: EditJobStatus[] = ['pending', 'analyzing', 'planning', 'editing'];
    if (!activeStatuses.includes(job.status)) return;

    const interval = setInterval(fetchJob, 3000);
    return () => clearInterval(interval);
  }, [job, fetchJob]);

  // --- Synced video playback ---
  const handlePlayOriginal = () => {
    editedVideoRef.current?.play();
  };
  const handlePauseOriginal = () => {
    editedVideoRef.current?.pause();
  };
  const handleSeekedOriginal = () => {
    if (originalVideoRef.current && editedVideoRef.current) {
      editedVideoRef.current.currentTime = originalVideoRef.current.currentTime;
    }
  };

  // --- Actions ---
  const handleApprove = async (saveAsInspo: boolean) => {
    setActionLoading(true);
    await fetch(`/api/editing/jobs/${jobId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save_as_inspo: saveAsInspo }),
    });
    fetchJob();
    setActionLoading(false);
  };

  const handleRequestChanges = async () => {
    if (!changesFeedback.trim()) return;
    setActionLoading(true);
    await fetch(`/api/editing/jobs/${jobId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_changes',
        new_instruction: changesFeedback.trim(),
      }),
    });
    fetchJob();
    setActionLoading(false);
  };

  const handleReject = async () => {
    setActionLoading(true);
    await fetch(`/api/editing/jobs/${jobId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
    fetchJob();
    setActionLoading(false);
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500">Loading edit job...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-red-400">Edit job not found</p>
      </div>
    );
  }

  const isVideo = job.content_type === 'video';
  const isReviewable = job.status === 'review';
  const isDone = job.status === 'approved' || job.status === 'rejected';

  return (
    <div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <a
            href="/dashboard/ai-editing"
            className="text-gray-400 hover:text-white transition"
          >
            &larr; Back to Editing
          </a>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Edit Review</h1>
            <p className="text-gray-400 text-sm mt-1 truncate">
              &quot;{job.instruction}&quot;
            </p>
          </div>
          {/* Status badge */}
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              job.status === 'review'
                ? 'bg-[#D73F09]/20 text-[#D73F09] border-[#D73F09]/30'
                : job.status === 'approved'
                ? 'bg-green-600/20 text-green-400 border-green-600/30'
                : job.status === 'rejected'
                ? 'bg-red-600/20 text-red-400 border-red-600/30'
                : 'bg-gray-600/20 text-gray-400 border-gray-600/30'
            }`}
          >
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        </div>

        {/* Before / After comparison */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Original */}
          <div>
            <p className="text-sm text-gray-400 mb-2 font-medium">Original</p>
            <div className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden aspect-video">
              {isVideo ? (
                <video
                  ref={originalVideoRef}
                  src={job.source_url}
                  controls
                  className="w-full h-full object-contain"
                  onPlay={handlePlayOriginal}
                  onPause={handlePauseOriginal}
                  onSeeked={handleSeekedOriginal}
                />
              ) : (
                <img
                  src={job.source_url}
                  alt="Original"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>

          {/* Edited */}
          <div>
            <p className="text-sm text-gray-400 mb-2 font-medium">Edited</p>
            <div className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden aspect-video">
              {job.output_url ? (
                isVideo ? (
                  <video
                    ref={editedVideoRef}
                    src={job.output_url}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={job.output_url}
                    alt="Edited"
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  {job.status === 'failed'
                    ? 'Edit failed — no output'
                    : 'Processing...'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons (only when in review) */}
        {isReviewable && (
          <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 mb-8">
            {showChangesForm ? (
              <div>
                <p className="text-sm text-gray-400 mb-2 font-medium">
                  What should be different?
                </p>
                <textarea
                  value={changesFeedback}
                  onChange={(e) => setChangesFeedback(e.target.value)}
                  placeholder="e.g., The logo at 0:15 still has a faint outline, please remove it completely..."
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09] resize-none mb-3"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleRequestChanges}
                    disabled={!changesFeedback.trim() || actionLoading}
                    className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 rounded-lg font-medium transition"
                  >
                    Submit Changes
                  </button>
                  <button
                    onClick={() => setShowChangesForm(false)}
                    className="px-5 py-2.5 text-gray-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleApprove(true)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition"
                >
                  Approve & Save to Library
                </button>
                <button
                  onClick={() => handleApprove(false)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 rounded-lg font-medium transition"
                >
                  Approve
                </button>
                <button
                  onClick={() => setShowChangesForm(true)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-yellow-600/20 text-yellow-400 border border-yellow-600/30 hover:bg-yellow-600/30 rounded-lg font-medium transition"
                >
                  Request Changes
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 rounded-lg font-medium transition ml-auto"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}

        {/* Approved/rejected message */}
        {isDone && (
          <div
            className={`rounded-xl p-4 mb-8 border ${
              job.status === 'approved'
                ? 'bg-green-600/10 border-green-600/30 text-green-400'
                : 'bg-red-600/10 border-red-600/30 text-red-400'
            }`}
          >
            This edit was {job.status} {job.approved_by ? `by a team member` : ''}{' '}
            on {new Date(job.updated_at).toLocaleDateString()}.
          </div>
        )}

        {/* Details section */}
        <div className="grid grid-cols-3 gap-6">
          {/* Edit steps */}
          <div className="col-span-2 bg-[#141414] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Edit Steps</h2>
            {steps.length === 0 ? (
              <p className="text-gray-500 text-sm">
                {job.edit_plan
                  ? 'Steps will appear once execution begins.'
                  : 'Edit plan is still being generated...'}
              </p>
            ) : (
              <div className="space-y-3">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-lg"
                  >
                    {/* Status indicator */}
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        step.status === 'completed'
                          ? 'bg-green-500'
                          : step.status === 'running'
                          ? 'bg-blue-500 animate-pulse'
                          : step.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-gray-600'
                      }`}
                    />
                    <span className="text-gray-600 text-sm w-5 flex-shrink-0">
                      {step.step_number}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">
                        {step.description || step.action}
                      </p>
                      {step.error_message && (
                        <p className="text-xs text-red-400 mt-1 truncate">
                          {step.error_message}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 flex-shrink-0">
                      {step.tool}
                    </span>
                    {step.cost_usd != null && step.cost_usd > 0 && (
                      <span className="text-xs text-gray-600 flex-shrink-0">
                        ${step.cost_usd.toFixed(3)}
                      </span>
                    )}
                    {step.duration_seconds != null && step.duration_seconds > 0 && (
                      <span className="text-xs text-gray-600 flex-shrink-0">
                        {step.duration_seconds}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job metadata */}
          <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Content Type</p>
                <p className="text-gray-200">{job.content_type}</p>
              </div>
              <div>
                <p className="text-gray-500">Created</p>
                <p className="text-gray-200">{new Date(job.created_at).toLocaleString()}</p>
              </div>
              {job.estimated_cost_usd != null && (
                <div>
                  <p className="text-gray-500">Estimated Cost</p>
                  <p className="text-gray-200">${job.estimated_cost_usd.toFixed(2)}</p>
                </div>
              )}
              {job.actual_cost_usd != null && (
                <div>
                  <p className="text-gray-500">Actual Cost</p>
                  <p className="text-gray-200">${job.actual_cost_usd.toFixed(2)}</p>
                </div>
              )}
              {job.processing_time_seconds != null && (
                <div>
                  <p className="text-gray-500">Processing Time</p>
                  <p className="text-gray-200">
                    {job.processing_time_seconds < 60
                      ? `${job.processing_time_seconds}s`
                      : `${Math.round(job.processing_time_seconds / 60)}m ${job.processing_time_seconds % 60}s`}
                  </p>
                </div>
              )}
              {job.parent_job_id && (
                <div>
                  <p className="text-gray-500">Re-edit of</p>
                  <a
                    href={`/dashboard/ai-editing/${job.parent_job_id}/review`}
                    className="text-[#D73F09] hover:underline"
                  >
                    Previous version
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
