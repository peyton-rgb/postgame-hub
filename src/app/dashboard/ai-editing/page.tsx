// ============================================================
// AI Editing Studio — /dashboard/ai-editing
//
// The main page for the AI editing pipeline. CMs use this to:
//   1. Submit new edit jobs (pick an asset + type an instruction)
//   2. View the queue of all edit jobs and their status
//   3. Click into jobs to review results or check progress
//
// Two modes:
//   - Quick Edit: single instruction on a single asset
//   - Batch Edit: same instruction across multiple assets
//     (batch creates one job per asset)
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import InspoPickerModal from '@/components/InspoPickerModal';
import type { SelectedInspoItem } from '@/components/InspoPickerModal';
import type { EditJob, EditJobStatus } from '@/lib/types/editing';

// --- Status display helpers ---

const STATUS_CONFIG: Record<EditJobStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Queued', color: 'bg-gray-600/20 text-gray-300 border-gray-600/30', icon: '⏳' },
  analyzing: { label: 'Analyzing', color: 'bg-blue-600/20 text-blue-300 border-blue-600/30', icon: '🔍' },
  planning: { label: 'Planning', color: 'bg-indigo-600/20 text-indigo-300 border-indigo-600/30', icon: '📋' },
  confirming: { label: 'Awaiting Approval', color: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30', icon: '⚡' },
  editing: { label: 'Editing', color: 'bg-purple-600/20 text-purple-300 border-purple-600/30', icon: '✂️' },
  review: { label: 'Ready for Review', color: 'bg-[#D73F09]/20 text-[#e8663d] border-[#D73F09]/30', icon: '👀' },
  approved: { label: 'Approved', color: 'bg-green-600/20 text-green-300 border-green-600/30', icon: '✅' },
  rejected: { label: 'Rejected', color: 'bg-red-600/20 text-red-300 border-red-600/30', icon: '❌' },
  failed: { label: 'Failed', color: 'bg-red-600/20 text-red-300 border-red-600/30', icon: '⚠️' },
};

export default function EditingDashboardPage() {
  const supabase = createBrowserSupabase();

  // --- State ---
  const [jobs, setJobs] = useState<EditJob[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New job form state
  const [showForm, setShowForm] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<SelectedInspoItem | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [inspoPickerOpen, setInspoPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- Fetch jobs ---
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50', offset: '0' });
    if (statusFilter !== 'all') params.set('status', statusFilter);

    const res = await fetch(`/api/editing/jobs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs || []);
      setTotalJobs(data.total || 0);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll for updates every 5 seconds when there are active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some((j) =>
      ['pending', 'analyzing', 'planning', 'editing'].includes(j.status)
    );
    if (!hasActiveJobs) return;

    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  // --- Submit new job ---
  const handleSubmit = async () => {
    if (!selectedAsset || !instruction.trim()) return;

    setSubmitting(true);
    try {
      const sourceUrl = selectedAsset.file_url || selectedAsset.thumbnail_url || '';
      const contentType = (selectedAsset.mime_type || '').startsWith('video/') ? 'video' : 'image';

      const res = await fetch('/api/editing/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: selectedAsset.id,
          source_url: sourceUrl,
          content_type: contentType,
          instruction: instruction.trim(),
          reference_image_url: referenceImageUrl || undefined,
        }),
      });

      if (res.ok) {
        // Reset form and refresh
        setInstruction('');
        setSelectedAsset(null);
        setReferenceImageUrl('');
        setShowForm(false);
        fetchJobs();
      }
    } catch (err) {
      console.error('Failed to submit edit job:', err);
    }
    setSubmitting(false);
  };

  // --- Confirm an edit plan ---
  const handleConfirm = async (jobId: string) => {
    await fetch(`/api/editing/jobs/${jobId}/confirm`, { method: 'POST' });
    fetchJobs();
  };

  // --- Retry a failed job ---
  const handleRetry = async (jobId: string) => {
    await fetch(`/api/editing/jobs/${jobId}/retry`, { method: 'POST' });
    fetchJobs();
  };

  // --- Status filter tabs ---
  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'confirming', label: 'Awaiting Approval' },
    { key: 'review', label: 'Ready for Review' },
    { key: 'editing', label: 'In Progress' },
    { key: 'approved', label: 'Approved' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">AI Editing Studio</h1>
            <p className="text-gray-400 mt-1">
              Describe what you want changed — the AI handles the rest
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard/inspo"
              className="px-4 py-2 text-sm text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
            >
              Inspo Library
            </a>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-5 py-2.5 bg-[#D73F09] hover:bg-[#b33507] rounded-lg font-medium transition"
            >
              {showForm ? 'Cancel' : '+ New Edit'}
            </button>
          </div>
        </div>

        {/* New Edit Form */}
        {showForm && (
          <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">New Edit Job</h2>

            {/* Asset selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Asset</label>
              {selectedAsset ? (
                <div className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-gray-700">
                  {(selectedAsset.thumbnail_url || selectedAsset.file_url) && (
                    <img
                      src={selectedAsset.thumbnail_url || selectedAsset.file_url || ''}
                      alt=""
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {selectedAsset.visual_description || selectedAsset.content_type}
                    </p>
                    <p className="text-xs text-gray-500">{selectedAsset.sport || 'No sport tagged'}</p>
                  </div>
                  <button
                    onClick={() => setSelectedAsset(null)}
                    className="text-gray-500 hover:text-white text-sm"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setInspoPickerOpen(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-[#D73F09] hover:text-[#D73F09] transition text-center"
                >
                  Click to select an asset from the inspo library
                </button>
              )}
            </div>

            {/* Instruction */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                What do you want to change?
              </label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g., Remove all visible logos from the jersey, make it vertical for TikTok, add a cinematic color grade..."
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09] resize-none"
                rows={3}
              />
            </div>

            {/* Reference image (optional) */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">
                Reference image URL (optional — for style guidance)
              </label>
              <input
                type="text"
                value={referenceImageUrl}
                onChange={(e) => setReferenceImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D73F09]"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!selectedAsset || !instruction.trim() || submitting}
              className="px-6 py-2.5 bg-[#D73F09] hover:bg-[#b33507] disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition"
            >
              {submitting ? 'Submitting...' : 'Run Edit'}
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                statusFilter === tab.key
                  ? 'bg-[#D73F09]/20 text-[#D73F09] border border-[#D73F09]/30'
                  : 'text-gray-400 border border-gray-800 hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-500 self-center">
            {totalJobs} job{totalJobs !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Jobs list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mb-2">No edit jobs yet</p>
            <p className="text-gray-600 text-sm">
              Click &quot;+ New Edit&quot; to submit your first AI editing job
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const statusCfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;

              return (
                <div
                  key={job.id}
                  className="bg-[#141414] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 bg-[#1a1a1a] rounded-lg overflow-hidden flex-shrink-0">
                      {job.source_url && (
                        <img
                          src={job.source_url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        &quot;{job.instruction}&quot;
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}
                        >
                          <span>{statusCfg.icon}</span>
                          {statusCfg.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {job.content_type}
                        </span>
                        {job.estimated_cost_usd && (
                          <span className="text-xs text-gray-500">
                            ~${job.estimated_cost_usd.toFixed(2)}
                          </span>
                        )}
                        <span className="text-xs text-gray-600">
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {job.status === 'confirming' && (
                        <button
                          onClick={() => handleConfirm(job.id)}
                          className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg text-sm hover:bg-green-600/30 transition"
                        >
                          Confirm & Run
                        </button>
                      )}
                      {job.status === 'review' && (
                        <a
                          href={`/dashboard/ai-editing/${job.id}/review`}
                          className="px-4 py-2 bg-[#D73F09]/20 text-[#D73F09] border border-[#D73F09]/30 rounded-lg text-sm hover:bg-[#D73F09]/30 transition"
                        >
                          Review
                        </a>
                      )}
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg text-sm hover:bg-red-600/30 transition"
                        >
                          Retry
                        </button>
                      )}
                      {['analyzing', 'planning', 'editing'].includes(job.status) && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-xs text-blue-400">Processing...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edit plan preview (when confirming) */}
                  {job.status === 'confirming' && job.edit_plan && (
                    <div className="mt-4 p-4 bg-[#0a0a0a] rounded-lg border border-gray-800">
                      <p className="text-sm text-gray-400 mb-2 font-medium">Edit Plan</p>
                      <div className="space-y-1.5">
                        {((job.edit_plan as unknown as { steps: Array<{ step_id: number; description: string; tool: string }> }).steps || []).map(
                          (step) => (
                            <div key={step.step_id} className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600 w-5">{step.step_id}.</span>
                              <span className="text-gray-300">{step.description}</span>
                              <span className="text-xs text-gray-600 ml-auto">
                                {step.tool}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                      {job.estimated_cost_usd && (
                        <p className="text-xs text-gray-500 mt-3">
                          Estimated cost: ${job.estimated_cost_usd.toFixed(2)} &middot;{' '}
                          {(job.edit_plan as unknown as { estimated_duration_minutes: number }).estimated_duration_minutes || '?'} min
                        </p>
                      )}
                      {((job.edit_plan as unknown as { warnings: string[] }).warnings || []).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {((job.edit_plan as unknown as { warnings: string[] }).warnings).map((w, i) => (
                            <p key={i} className="text-xs text-yellow-500">⚠ {w}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspo Picker Modal */}
      <InspoPickerModal
        isOpen={inspoPickerOpen}
        onClose={() => setInspoPickerOpen(false)}
        onSelect={(items) => {
          if (items.length > 0) {
            setSelectedAsset(items[0]);
          }
          setInspoPickerOpen(false);
        }}
        selectedIds={selectedAsset ? [selectedAsset.id] : []}
        maxSelections={1}
      />
    </div>
  );
}
