// ============================================================
// AI Edit Review — /dashboard/ai-editing/[id]/review
//
// Side-by-side original vs edited video with synced playback,
// the EDL step list with per-step status, plus approve / request-
// changes / reject actions.
//
// Approve has an optional "save to library" toggle that the
// API treats as save_as_inspo.
// Request changes chains a follow-up job via parent_job_id.
// ============================================================

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { EditJob, EditStep, EditJobStatus, EditStepStatus } from '@/lib/types/editing';

interface JobResponse {
  job: EditJob;
  steps: EditStep[];
}

const STATUS_BADGE: Record<EditJobStatus, { label: string; color: string }> = {
  pending:    { label: 'Pending',           color: 'bg-gray-700 text-gray-200' },
  analyzing:  { label: 'Analyzing',         color: 'bg-blue-900/60 text-blue-200' },
  planning:   { label: 'Planning',          color: 'bg-blue-900/60 text-blue-200' },
  confirming: { label: 'Awaiting Approval', color: 'bg-amber-900/60 text-amber-200' },
  editing:    { label: 'Editing',           color: 'bg-orange-900/60 text-orange-200' },
  review:     { label: 'Ready for Review',  color: 'bg-emerald-900/60 text-emerald-200' },
  approved:   { label: 'Approved',          color: 'bg-green-700 text-green-100' },
  rejected:   { label: 'Rejected',          color: 'bg-red-900/60 text-red-200' },
  failed:     { label: 'Failed',            color: 'bg-red-900/60 text-red-200' },
};

const STEP_DOT: Record<EditStepStatus, string> = {
  pending:  'bg-gray-600',
  running:  'bg-orange-500 animate-pulse',
  complete: 'bg-emerald-500',
  failed:   'bg-red-500',
  skipped:  'bg-gray-700',
};

const ACTIVE_STATUSES: EditJobStatus[] = ['pending', 'analyzing', 'planning', 'editing'];

export default function EditReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = params?.id;

  const [job, setJob] = useState<EditJob | null>(null);
  const [steps, setSteps] = useState<EditStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeRequest, setChangeRequest] = useState('');

  const beforeRef = useRef<HTMLVideoElement | null>(null);
  const afterRef = useRef<HTMLVideoElement | null>(null);
  // Suppresses re-entrant sync events.
  const syncing = useRef(false);

  const load = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/editing/jobs/${jobId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 501) {
          setError('Editing pipeline is not yet connected. UI is live; backend stubs return 501.');
          setJob(null);
          setSteps([]);
          setLoading(false);
          return;
        }
        throw new Error(body.error || `Load failed (${res.status})`);
      }
      const data = (await res.json()) as JobResponse | EditJob;
      // Accept both { job, steps } and a flat EditJob (steps may be embedded).
      if ('job' in data && data.job) {
        setJob(data.job);
        setSteps(data.steps || []);
      } else {
        setJob(data as EditJob);
        // If the API returns steps inline on the job, surface them.
        const inline = (data as unknown as { steps?: EditStep[] }).steps;
        setSteps(Array.isArray(inline) ? inline : []);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  // Poll while pipeline is still working.
  useEffect(() => {
    if (!job) return;
    if (!ACTIVE_STATUSES.includes(job.status)) return;
    const id = setInterval(() => { load(); }, 5000);
    return () => clearInterval(id);
  }, [job, load]);

  // --- Synced playback (play/pause/seek mirror across both videos) ---
  function attachSync() {
    const a = beforeRef.current;
    const b = afterRef.current;
    if (!a || !b) return;

    const onPlay = (src: HTMLVideoElement, dst: HTMLVideoElement) => () => {
      if (syncing.current) return;
      syncing.current = true;
      // Match position before resuming the partner.
      if (Math.abs(dst.currentTime - src.currentTime) > 0.1) {
        dst.currentTime = src.currentTime;
      }
      void dst.play().catch(() => { /* ignore play interruption */ });
      // release on the next tick
      setTimeout(() => { syncing.current = false; }, 0);
    };
    const onPause = (dst: HTMLVideoElement) => () => {
      if (syncing.current) return;
      syncing.current = true;
      dst.pause();
      setTimeout(() => { syncing.current = false; }, 0);
    };
    const onSeek = (src: HTMLVideoElement, dst: HTMLVideoElement) => () => {
      if (syncing.current) return;
      syncing.current = true;
      dst.currentTime = src.currentTime;
      setTimeout(() => { syncing.current = false; }, 0);
    };

    const aPlay = onPlay(a, b);
    const bPlay = onPlay(b, a);
    const aPause = onPause(b);
    const bPause = onPause(a);
    const aSeek = onSeek(a, b);
    const bSeek = onSeek(b, a);

    a.addEventListener('play', aPlay);
    b.addEventListener('play', bPlay);
    a.addEventListener('pause', aPause);
    b.addEventListener('pause', bPause);
    a.addEventListener('seeked', aSeek);
    b.addEventListener('seeked', bSeek);

    return () => {
      a.removeEventListener('play', aPlay);
      b.removeEventListener('play', bPlay);
      a.removeEventListener('pause', aPause);
      b.removeEventListener('pause', bPause);
      a.removeEventListener('seeked', aSeek);
      b.removeEventListener('seeked', bSeek);
    };
  }

  useEffect(() => {
    if (!job?.output_url || !job?.source_url) return;
    return attachSync();
  }, [job?.output_url, job?.source_url]);

  async function handleApprove() {
    if (!job) return;
    setActionLoading('approve');
    try {
      const res = await fetch(`/api/editing/jobs/${job.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save_as_inspo: saveToLibrary }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Approve failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
    setActionLoading(null);
  }

  async function handleReject() {
    if (!job) return;
    setActionLoading('reject');
    try {
      const res = await fetch(`/api/editing/jobs/${job.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reject: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Reject failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    }
    setActionLoading(null);
  }

  async function handleRequestChanges() {
    if (!job) return;
    if (!changeRequest.trim()) {
      setError('Describe what to change.');
      return;
    }
    setActionLoading('changes');
    try {
      const res = await fetch(`/api/editing/jobs/${job.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_changes: changeRequest.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const body = (await res.json().catch(() => ({}))) as { new_job_id?: string };
      // If the API returns the new chained job, jump to its review page.
      if (body.new_job_id) {
        router.push(`/dashboard/ai-editing/${body.new_job_id}/review`);
        return;
      }
      // Otherwise refresh and head back to the queue.
      router.push('/dashboard/ai-editing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request changes failed');
    }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-gray-500">Loading edit…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto p-8">
        <Link
          href="/dashboard/ai-editing"
          className="text-gray-400 hover:text-white text-sm mb-6 inline-block"
        >
          ← Back to AI Editing Studio
        </Link>

        {error && (
          <div className="bg-red-900/40 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {!job ? (
          <div className="bg-[#141414] border border-[#262626] rounded-xl p-12 text-center">
            <p className="text-gray-300">Edit job not found or backend is offline.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold">Review Edit</h1>
                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{job.instruction}</p>
              </div>
              <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[job.status].color}`}>
                {STATUS_BADGE[job.status].label}
              </span>
            </div>

            {/* Side-by-side videos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
                <div className="p-3 border-b border-[#262626] text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  Original
                </div>
                {job.source_url ? (
                  job.content_type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.source_url} alt="original" className="w-full bg-black" />
                  ) : (
                    <video
                      ref={beforeRef}
                      src={job.source_url}
                      controls
                      className="w-full bg-black"
                    />
                  )
                ) : (
                  <div className="aspect-video bg-black flex items-center justify-center text-gray-700 text-sm">
                    no source
                  </div>
                )}
              </div>

              <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
                <div className="p-3 border-b border-[#262626] text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  Edited
                </div>
                {job.output_url ? (
                  job.content_type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.output_url} alt="edited" className="w-full bg-black" />
                  ) : (
                    <video
                      ref={afterRef}
                      src={job.output_url}
                      controls
                      className="w-full bg-black"
                    />
                  )
                ) : (
                  <div className="aspect-video bg-black flex items-center justify-center text-gray-700 text-sm">
                    {ACTIVE_STATUSES.includes(job.status) ? 'Rendering…' : 'No output yet'}
                  </div>
                )}
              </div>
            </div>

            {/* Action bar — only relevant when we're at "review" */}
            {job.status === 'review' && (
              <section className="bg-[#141414] border border-[#262626] rounded-xl p-5 mb-6">
                <div className="flex flex-wrap gap-3 items-center">
                  <label className="flex items-center gap-2 text-sm text-gray-300 mr-2">
                    <input
                      type="checkbox"
                      checked={saveToLibrary}
                      onChange={(e) => setSaveToLibrary(e.target.checked)}
                      className="w-4 h-4 accent-orange-600"
                    />
                    Save to library on approve
                  </label>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading === 'approve'}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {actionLoading === 'approve'
                      ? 'Approving…'
                      : saveToLibrary ? 'Approve & Save to Library' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setShowChangeRequest((s) => !s)}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm"
                  >
                    Request Changes
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading === 'reject'}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>

                {showChangeRequest && (
                  <div className="mt-4 pt-4 border-t border-[#262626]">
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                      What should the AI change?
                    </label>
                    <textarea
                      value={changeRequest}
                      onChange={(e) => setChangeRequest(e.target.value)}
                      rows={3}
                      placeholder='e.g. "Make the logo smaller and move it to the top-right"'
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm focus:outline-none focus:border-orange-600 resize-y"
                    />
                    <button
                      onClick={handleRequestChanges}
                      disabled={actionLoading === 'changes' || !changeRequest.trim()}
                      className="mt-3 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      {actionLoading === 'changes' ? 'Submitting…' : 'Send Change Request'}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Steps + metadata */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <section className="bg-[#141414] border border-[#262626] rounded-xl p-5 lg:col-span-2">
                <h2 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Edit Steps</h2>
                {steps.length === 0 ? (
                  <p className="text-gray-500 text-sm">No steps recorded yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {steps.map((step) => (
                      <li key={step.id} className="flex items-start gap-3">
                        <span
                          className={`flex-shrink-0 w-3 h-3 mt-1.5 rounded-full ${STEP_DOT[step.status]}`}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-200">
                              {step.step_number}. {step.description}
                            </span>
                            <span className="text-xs text-gray-600">
                              [{step.tool}/{step.action}]
                            </span>
                          </div>
                          {step.error_message && (
                            <p className="text-xs text-red-400 mt-1">{step.error_message}</p>
                          )}
                          <div className="text-xs text-gray-600 mt-0.5">
                            {step.cost_usd != null && <span>${Number(step.cost_usd).toFixed(2)} · </span>}
                            {step.duration_seconds != null && <span>{step.duration_seconds.toFixed(1)}s · </span>}
                            <span>{step.status}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="bg-[#141414] border border-[#262626] rounded-xl p-5">
                <h2 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Job Info</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Created</dt>
                    <dd className="text-gray-300 text-right">{new Date(job.created_at).toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Updated</dt>
                    <dd className="text-gray-300 text-right">{new Date(job.updated_at).toLocaleString()}</dd>
                  </div>
                  {job.estimated_cost_usd != null && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Est. cost</dt>
                      <dd className="text-gray-300">${Number(job.estimated_cost_usd).toFixed(2)}</dd>
                    </div>
                  )}
                  {job.actual_cost_usd != null && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Actual cost</dt>
                      <dd className="text-gray-300">${Number(job.actual_cost_usd).toFixed(2)}</dd>
                    </div>
                  )}
                  {job.parent_job_id && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Parent</dt>
                      <dd className="text-gray-300 text-right truncate" title={job.parent_job_id}>
                        <Link
                          href={`/dashboard/ai-editing/${job.parent_job_id}/review`}
                          className="text-orange-500 hover:underline"
                        >
                          previous version
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
