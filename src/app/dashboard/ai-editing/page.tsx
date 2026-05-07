// ============================================================
// AI Editing Studio — /dashboard/ai-editing
//
// CMs pick an asset from the inspo library, describe what they
// want changed in plain language, and the pipeline (Gemini scene
// map → Claude edit plan → ffmpeg + AI tools) produces an edited
// version. This page is the front-end: form, queue, polling,
// per-status actions.
//
// API endpoints used:
//   POST   /api/editing/jobs                  — create + start pipeline
//   GET    /api/editing/jobs?status=...       — list jobs
//   POST   /api/editing/jobs/[id]/confirm     — approve plan, run edits
//   POST   /api/editing/jobs/[id]/retry       — retry failed
//
// While the integration code is still being assembled, the API
// routes return 501 — the UI surfaces the error instead of crashing.
// ============================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';
import InspoPickerModal, { SelectedInspoItem } from '@/components/InspoPickerModal';
import type { EditJob, EditJobStatus } from '@/lib/types/editing';

interface StatusMeta {
  label: string;
  color: string;     // tailwind color classes for the badge
  icon: string;      // single-char glyph used in the badge
}

const STATUS_CONFIG: Record<EditJobStatus, StatusMeta> = {
  pending:    { label: 'Pending',           color: 'bg-gray-700 text-gray-200',     icon: '·' },
  analyzing:  { label: 'Analyzing',         color: 'bg-blue-900/60 text-blue-200',  icon: '◐' },
  planning:   { label: 'Planning',          color: 'bg-blue-900/60 text-blue-200',  icon: '◑' },
  confirming: { label: 'Awaiting Approval', color: 'bg-amber-900/60 text-amber-200',icon: '?' },
  editing:    { label: 'Editing',           color: 'bg-orange-900/60 text-orange-200', icon: '✶' },
  review:     { label: 'Ready for Review',  color: 'bg-emerald-900/60 text-emerald-200', icon: '✓' },
  approved:   { label: 'Approved',          color: 'bg-green-700 text-green-100',   icon: '✓' },
  rejected:   { label: 'Rejected',          color: 'bg-red-900/60 text-red-200',    icon: '✕' },
  failed:     { label: 'Failed',            color: 'bg-red-900/60 text-red-200',    icon: '!' },
};

const FILTER_TABS: { key: 'all' | 'awaiting' | 'review' | 'in_progress' | 'approved' | 'failed'; label: string; statuses: EditJobStatus[] }[] = [
  { key: 'all',         label: 'All',                statuses: [] },
  { key: 'awaiting',    label: 'Awaiting Approval',  statuses: ['confirming'] },
  { key: 'review',      label: 'Ready for Review',   statuses: ['review'] },
  { key: 'in_progress', label: 'In Progress',        statuses: ['pending', 'analyzing', 'planning', 'editing'] },
  { key: 'approved',    label: 'Approved',           statuses: ['approved'] },
  { key: 'failed',      label: 'Failed',             statuses: ['failed', 'rejected'] },
];

const ACTIVE_STATUSES: EditJobStatus[] = ['pending', 'analyzing', 'planning', 'editing'];

export default function AIEditingStudioPage() {
  // form state
  const [showForm, setShowForm] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosenAsset, setChosenAsset] = useState<SelectedInspoItem | null>(null);
  const [instruction, setInstruction] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // queue state
  const [jobs, setJobs] = useState<EditJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [filter, setFilter] = useState<typeof FILTER_TABS[number]['key']>('all');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/editing/jobs');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // 501 just means the backend isn't wired yet — render an empty list.
        if (res.status === 501) {
          setJobs([]);
          setError('Editing pipeline is not yet connected. UI is live; backend stubs return 501.');
          setLoadingJobs(false);
          return;
        }
        throw new Error(body.error || `Failed to load jobs (${res.status})`);
      }
      const data = await res.json();
      setJobs(Array.isArray(data) ? (data as EditJob[]) : (data.jobs as EditJob[]) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    }
    setLoadingJobs(false);
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Poll while any job is in an active state.
  const hasActive = useMemo(
    () => jobs.some((j) => ACTIVE_STATUSES.includes(j.status)),
    [jobs]
  );

  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => { loadJobs(); }, 5000);
    return () => clearInterval(id);
  }, [hasActive, loadJobs]);

  async function handleSubmit() {
    if (!chosenAsset || !instruction.trim()) {
      setError('Pick an asset and describe what you want changed.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/editing/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: chosenAsset.id,
          source_url: chosenAsset.file_url,
          content_type: chosenAsset.content_type,
          instruction: instruction.trim(),
          reference_image_url: referenceUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Create failed (${res.status})`);
      }
      // Reset form, refresh queue
      setShowForm(false);
      setChosenAsset(null);
      setInstruction('');
      setReferenceUrl('');
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create edit job');
    }
    setSubmitting(false);
  }

  async function handleConfirm(jobId: string) {
    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/editing/jobs/${jobId}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Confirm failed (${res.status})`);
      }
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm job');
    }
    setActionLoading(null);
  }

  async function handleRetry(jobId: string) {
    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/editing/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Retry failed (${res.status})`);
      }
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry job');
    }
    setActionLoading(null);
  }

  // Stash a thumbnail map keyed by asset_id so the queue can show a preview
  // without an extra fetch per job. Filled lazily as we encounter assets.
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = Array.from(
      new Set(jobs.map((j) => j.asset_id).filter((x): x is string => !!x && !thumbMap[x]))
    );
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase
        .from('inspo_items')
        .select('id, thumbnail_url')
        .in('id', ids);
      if (cancelled || !data) return;
      const next: Record<string, string> = {};
      (data as { id: string; thumbnail_url: string | null }[]).forEach((row) => {
        if (row.thumbnail_url) next[row.id] = row.thumbnail_url;
      });
      setThumbMap((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [jobs, thumbMap]);

  const filteredJobs = useMemo(() => {
    const tab = FILTER_TABS.find((t) => t.key === filter);
    if (!tab || tab.statuses.length === 0) return jobs;
    return jobs.filter((j) => tab.statuses.includes(j.status));
  }, [filter, jobs]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">AI Editing Studio</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Describe what you want changed — the AI handles the rest.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/inspo"
              className="px-4 py-2 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-gray-200 rounded-lg text-sm"
            >
              Inspo Library
            </Link>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold"
            >
              {showForm ? 'Cancel' : '+ New Edit'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 text-xs">Dismiss</button>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <section className="bg-[#141414] border border-[#262626] rounded-xl p-6 mb-8">
            <h2 className="text-lg font-bold mb-4">New Edit</h2>

            {/* Asset picker */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Source Asset</label>
              {chosenAsset ? (
                <div className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-[#262626] rounded-lg">
                  {chosenAsset.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={chosenAsset.thumbnail_url} alt="" className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-[#262626] rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {chosenAsset.athlete_name || chosenAsset.sport || 'Inspo asset'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{chosenAsset.visual_description || ''}</div>
                  </div>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="text-xs text-orange-600 hover:text-orange-500"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="w-full p-4 border-2 border-dashed border-[#262626] hover:border-[#404040] rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Pick from Inspo Library
                </button>
              )}
            </div>

            {/* Instruction */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Instruction</label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='e.g. "Make this 9:16, brighten the subject, add a Postgame logo bottom-right at 30% opacity"'
                rows={4}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-600 resize-y"
              />
            </div>

            {/* Reference image (optional) */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Reference Image URL (optional)</label>
              <input
                type="text"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-orange-600"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !chosenAsset || !instruction.trim()}
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting…' : 'Run Edit'}
            </button>
          </section>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-1 border-b border-[#262626] mb-6 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                filter === tab.key
                  ? 'text-white border-orange-600'
                  : 'text-gray-500 hover:text-gray-300 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Queue */}
        {loadingJobs ? (
          <div className="text-center text-gray-500 py-12">Loading jobs…</div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-[#141414] border border-[#262626] rounded-xl p-12 text-center">
            <p className="text-gray-300 font-medium">
              {filter === 'all' ? 'No edits yet' : 'Nothing in this filter'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {filter === 'all'
                ? 'Click "+ New Edit" to start your first AI edit.'
                : 'Try a different status tab.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredJobs.map((job) => {
              const meta = STATUS_CONFIG[job.status];
              const thumb = job.asset_id ? thumbMap[job.asset_id] : null;
              return (
                <li key={job.id} className="bg-[#141414] border border-[#262626] rounded-xl p-4 flex items-start gap-4">
                  {/* Thumb */}
                  <div className="w-24 h-24 flex-shrink-0 bg-[#0a0a0a] rounded-lg overflow-hidden">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">
                        no thumb
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-gray-200 flex-1 line-clamp-2">{job.instruction}</p>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        <span className="mr-1">{meta.icon}</span>{meta.label}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 mt-1">
                      Created {new Date(job.created_at).toLocaleString()}
                      {job.estimated_cost_usd != null && (
                        <> · est ${Number(job.estimated_cost_usd).toFixed(2)}</>
                      )}
                      {job.actual_cost_usd != null && (
                        <> · actual ${Number(job.actual_cost_usd).toFixed(2)}</>
                      )}
                    </div>

                    {/* Plan preview while confirming */}
                    {job.status === 'confirming' && job.edit_plan && (
                      <div className="mt-3 p-3 bg-[#0a0a0a] border border-[#262626] rounded-lg">
                        <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                          Proposed Plan
                          {job.edit_plan.estimated_total_cost_usd != null && (
                            <span className="text-gray-400 normal-case font-normal ml-2">
                              · est ${job.edit_plan.estimated_total_cost_usd.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <ol className="space-y-1 text-sm text-gray-300">
                          {job.edit_plan.steps.map((step, i) => (
                            <li key={step.id || i} className="flex gap-2">
                              <span className="text-gray-600 w-5 flex-shrink-0">{i + 1}.</span>
                              <span className="flex-1">
                                {step.description}
                                <span className="ml-2 text-xs text-gray-600">[{step.tool}/{step.action}]</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Action row */}
                    <div className="flex items-center gap-2 mt-3">
                      {job.status === 'confirming' && (
                        <button
                          onClick={() => handleConfirm(job.id)}
                          disabled={actionLoading === job.id}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                        >
                          {actionLoading === job.id ? 'Confirming…' : 'Confirm & Run'}
                        </button>
                      )}
                      {job.status === 'review' && (
                        <Link
                          href={`/dashboard/ai-editing/${job.id}/review`}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold"
                        >
                          Review →
                        </Link>
                      )}
                      {(job.status === 'failed' || job.status === 'rejected') && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={actionLoading === job.id}
                          className="px-3 py-1.5 bg-[#262626] hover:bg-[#333] text-gray-200 rounded text-xs disabled:opacity-50"
                        >
                          {actionLoading === job.id ? 'Retrying…' : 'Retry'}
                        </button>
                      )}
                      {(job.status === 'approved' || job.status === 'review') && job.output_url && (
                        <a
                          href={job.output_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-[#262626] hover:bg-[#333] text-gray-200 rounded text-xs"
                        >
                          Open Output ↗
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <InspoPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(items) => {
          if (items[0]) setChosenAsset(items[0]);
        }}
        contentType="video"
        title="Pick a video to edit"
      />
    </div>
  );
}
