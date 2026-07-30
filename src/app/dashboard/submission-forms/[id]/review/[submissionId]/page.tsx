// ============================================================
// Content review — /dashboard/submission-forms/[id]/review/[submissionId]
//
// Per file. Reuses the existing AI-editing engine (/api/editing/jobs/*) —
// this page only drives it and reads state.
//   Idle (L):    AI score + suggestions + instruction → Request edit.
//   Running (M): the edit plan (edit_steps) with per-step state + cost,
//                estimated cost shown before charging, Confirm & Run / Cancel.
//   V2 (N):      side-by-side V1/V2, what changed, Approve V2 / Build V3 / Revert.
//
// Approving V2 KEEPS BOTH — it never overwrites the submission's original.
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardContent from "@/components/DashboardContent";

const ACTIVE_STATUSES = ["pending", "analyzing", "planning", "confirming", "editing"];

interface Step {
  id: string;
  step_number: number;
  action: string;
  tool: string;
  description: string | null;
  params: Record<string, unknown> | null;
  status: string;
  cost_usd: number | null;
  error_message: string | null;
}
interface Version {
  id: string;
  status: string;
  instruction: string;
  edit_plan: { estimated_cost_usd?: number; warnings?: string[]; steps?: any[] } | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  output_url: string | null;
  output_thumbnail_url: string | null;
  parent_job_id: string | null;
  content_type: string;
  source_url: string;
  created_at: string;
  versionLabel: string;
  steps: Step[];
}
interface Submission {
  id: string;
  campaign_id: string;
  athlete_name: string;
  ig_handle: string | null;
  file_name: string | null;
  asset_type: string | null;
  drive_file_url: string | null;
  drive_thumbnail_url: string | null;
  score_composite: number | null;
  score_composition: number | null;
  score_lighting: number | null;
  score_subject: number | null;
  score_brand_visibility: number | null;
  score_hook: number | null;
  tags: string[] | null;
  status: string;
}
interface Suggestion {
  id: string;
  kind: string | null;
  summary: string | null;
  detail: string | null;
  severity: string | null;
  status: string | null;
}
interface ReviewData {
  submission: Submission;
  suggestions: Suggestion[];
  versions: Version[];
  siblings: string[];
}

const money = (n: number | null | undefined) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);

export default function ReviewPage() {
  const params = useParams<{ id: string; submissionId: string }>();
  const token = params?.id;
  const submissionId = params?.submissionId;

  const [d, setD] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    if (!token || !submissionId) return;
    try {
      const res = await fetch(`/api/submission-forms/${token}/review/${submissionId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setD(body);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, submissionId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const activeJob = useMemo(() => {
    if (!d?.versions.length) return null;
    const latest = d.versions[d.versions.length - 1];
    return ACTIVE_STATUSES.includes(latest.status) ? latest : null;
  }, [d]);

  // Poll while a job is mid-pipeline.
  useEffect(() => {
    if (activeJob) {
      pollRef.current = setInterval(load, 4000);
      return () => clearInterval(pollRef.current);
    }
  }, [activeJob, load]);

  const reviewedVersion = useMemo(() => {
    if (!d?.versions.length) return null;
    const latest = d.versions[d.versions.length - 1];
    return latest.output_url && (latest.status === "review" || latest.status === "approved") ? latest : null;
  }, [d]);

  if (loading) return <DashboardContent><div className="text-white/40 text-sm py-16 text-center">Loading…</div></DashboardContent>;
  if (error || !d) return <DashboardContent><div className="text-red-400 text-sm py-16 text-center">{error || "Not found"}</div></DashboardContent>;

  const s = d.submission;
  const idx = d.siblings.indexOf(s.id);
  const prevId = idx > 0 ? d.siblings[idx - 1] : null;
  const nextId = idx >= 0 && idx < d.siblings.length - 1 ? d.siblings[idx + 1] : null;

  const post = async (url: string, payload?: any) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await load();
      return body;
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const requestEdit = (parentJobId?: string) => {
    const text = instruction.trim();
    if (!text) return;
    return post("/api/editing/jobs", {
      source_url: s.drive_file_url,
      content_type: s.asset_type === "video" ? "video" : "image",
      instruction: text,
      submission_id: s.id,
      ...(parentJobId ? { parent_job_id: parentJobId } : {}),
    }).then(() => setInstruction(""));
  };
  const confirmRun = (jobId: string) => post(`/api/editing/jobs/${jobId}/confirm`);
  const approveJob = (jobId: string) => post(`/api/editing/jobs/${jobId}/approve`);
  const approveSubmission = () => post(`/api/submission-forms/${token}/review/${submissionId}`, { action: "approve" });
  const rejectSubmission = () => post(`/api/submission-forms/${token}/review/${submissionId}`, { action: "reject" });

  const dims: [string, number | null][] = [
    ["Composition", s.score_composition],
    ["Lighting", s.score_lighting],
    ["Subject", s.score_subject],
    ["Brand visibility", s.score_brand_visibility],
    ["Hook", s.score_hook],
  ];

  const preview = reviewedVersion?.output_url || s.drive_file_url || undefined;

  return (
    <DashboardContent>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/dashboard/submission-forms/${token}`} className="text-xs text-white/45 hover:text-white/70">
          ← {s.athlete_name} {s.ig_handle ? `· @${s.ig_handle}` : ""}
        </Link>
        <div className="flex items-center gap-2 font-mono text-xs text-white/50">
          {prevId ? (
            <Link href={`/dashboard/submission-forms/${token}/review/${prevId}`} className="px-2 py-1 rounded hover:bg-white/10">←</Link>
          ) : (
            <span className="px-2 py-1 text-white/20">←</span>
          )}
          <span>FILE {idx + 1} OF {d.siblings.length}</span>
          {nextId ? (
            <Link href={`/dashboard/submission-forms/${token}/review/${nextId}`} className="px-2 py-1 rounded hover:bg-white/10">→</Link>
          ) : (
            <span className="px-2 py-1 text-white/20">→</span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Preview / comparison */}
        <div>
          {reviewedVersion ? (
            <div className="grid grid-cols-2 gap-3">
              <Media label="V1 · Original" url={s.drive_file_url} isVideo={s.asset_type === "video"} thumb={s.drive_thumbnail_url} />
              <Media label={`${reviewedVersion.versionLabel} · Edited`} url={reviewedVersion.output_url} isVideo={reviewedVersion.content_type === "video"} thumb={reviewedVersion.output_thumbnail_url} />
            </div>
          ) : (
            <Media label="Original" url={preview ?? null} isVideo={s.asset_type === "video"} thumb={s.drive_thumbnail_url} big />
          )}

          {/* What changed (V2) */}
          {reviewedVersion && (
            <div className="mt-4 bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">What changed</div>
              <ul className="space-y-1">
                {reviewedVersion.steps.filter((st) => st.status === "completed").map((st) => (
                  <li key={st.id} className="text-sm text-white/70">• {st.description || st.action}</li>
                ))}
                {reviewedVersion.steps.length === 0 && <li className="text-sm text-white/40">No step detail recorded.</li>}
              </ul>
              <div className="text-xs text-white/45 mt-3">
                Ran {reviewedVersion.steps.length} step{reviewedVersion.steps.length === 1 ? "" : "s"} · cost {money(reviewedVersion.actual_cost_usd)}
              </div>
              <div className="flex gap-2 mt-4">
                {reviewedVersion.status === "review" && (
                  <button onClick={() => approveJob(reviewedVersion.id)} disabled={busy} className="px-4 py-2 rounded-lg bg-[#D73F09] text-white text-sm font-semibold disabled:opacity-50">
                    Approve {reviewedVersion.versionLabel} (keeps both)
                  </button>
                )}
                <button onClick={() => requestEdit(reviewedVersion.id)} disabled={busy || !instruction.trim()} title="Type an instruction below, then build the next round" className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 disabled:opacity-40">
                  Build next round
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          {/* AI score */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-wider text-white/40">AI score</div>
              <div className="text-2xl font-bold text-white">{s.score_composite != null ? Math.round(s.score_composite) : "—"}</div>
            </div>
            <div className="mt-3 space-y-1.5">
              {dims.map(([label, v]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-white/45 w-28">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-[#D73F09]" style={{ width: `${v ?? 0}%` }} />
                  </div>
                  <span className="text-xs text-white/50 w-7 text-right">{v != null ? Math.round(v) : "—"}</span>
                </div>
              ))}
            </div>
            {s.tags && s.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {s.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/45">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Running plan (M) */}
          {activeJob ? (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wider text-white/40">Edit plan</div>
                <span className="text-[10px] font-mono uppercase text-[#D73F09]">{activeJob.status}</span>
              </div>
              {activeJob.status === "confirming" && (
                <div className="text-xs text-white/50 mb-3">
                  Estimated cost <span className="text-white font-semibold">{money(activeJob.edit_plan?.estimated_cost_usd ?? activeJob.estimated_cost_usd)}</span> — nothing is charged until you run it.
                </div>
              )}
              <ol className="space-y-2">
                {activeJob.steps.map((st) => (
                  <li key={st.id} className="flex items-start gap-2 text-sm">
                    <span className="text-white/30 font-mono text-xs mt-0.5">{st.step_number}</span>
                    <div className="flex-1">
                      <div className="text-white/80">{st.description || st.action}</div>
                      <div className="text-[10px] font-mono text-white/35">
                        {st.tool} · {st.status}{st.cost_usd != null ? ` · ${money(st.cost_usd)}` : ""}
                      </div>
                    </div>
                    <StepDot status={st.status} />
                  </li>
                ))}
                {activeJob.steps.length === 0 && <li className="text-xs text-white/40">Building the plan…</li>}
              </ol>
              <div className="flex gap-2 mt-4">
                {activeJob.status === "confirming" && (
                  <button onClick={() => confirmRun(activeJob.id)} disabled={busy} className="flex-1 px-3 py-2 rounded-lg bg-[#D73F09] text-white text-sm font-semibold disabled:opacity-50">
                    Confirm &amp; Run
                  </button>
                )}
                <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-center text-xs text-white/40">
                  You can leave — we&apos;ll keep working.
                </div>
              </div>
            </div>
          ) : (
            /* Idle (L): suggestions + instruction + actions */
            <>
              {d.suggestions.length > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                  <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Suggested edits</div>
                  <div className="space-y-2">
                    {d.suggestions.map((sg) => (
                      <div key={sg.id} className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="text-sm text-white/80">{sg.summary}</div>
                          {sg.detail && <div className="text-xs text-white/45">{sg.detail}</div>}
                        </div>
                        {sg.severity && <span className="text-[9px] uppercase font-mono text-white/35 mt-1">{sg.severity}</span>}
                        <button
                          onClick={() => setInstruction((i) => (i ? `${i} ${sg.summary}` : sg.summary || ""))}
                          className="text-xs text-[#D73F09] hover:underline mt-0.5"
                        >
                          ADD
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Your instruction</div>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={3}
                  placeholder="e.g. crop to 9:16 and brighten the subject"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#D73F09]/40 resize-none"
                />
                <button
                  onClick={() => requestEdit()}
                  disabled={busy || !instruction.trim() || !s.drive_file_url}
                  className="w-full mt-2 px-3 py-2.5 rounded-lg bg-[#D73F09] text-white text-sm font-semibold disabled:opacity-40"
                >
                  Request edit
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={approveSubmission} disabled={busy} className="flex-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-emerald-400 disabled:opacity-50">
                  Approve{s.status === "approved" ? "d ✓" : ""}
                </button>
                <button onClick={rejectSubmission} disabled={busy} className="flex-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 disabled:opacity-50">
                  Reject{s.status === "rejected" ? "ed" : ""}
                </button>
              </div>
            </>
          )}

          {/* Versions */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Versions</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70">V1 · Original</span>
                <span className="text-xs text-white/35">upload</span>
              </div>
              {d.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/70">{v.versionLabel} · {v.status}</span>
                  <span className="text-xs text-white/35">{money(v.actual_cost_usd ?? v.estimated_cost_usd)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardContent>
  );
}

function Media({ label, url, isVideo, thumb, big }: { label: string; url: string | null; isVideo?: boolean; thumb?: string | null; big?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
      <div className={`rounded-xl overflow-hidden bg-white/5 border border-white/10 ${big ? "aspect-video" : "aspect-[3/4]"} flex items-center justify-center`}>
        {url ? (
          isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={url} poster={thumb || undefined} controls className="w-full h-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb || url} alt={label} className="w-full h-full object-contain" />
          )
        ) : (
          <span className="text-white/25 text-xs">No preview</span>
        )}
      </div>
    </div>
  );
}

function StepDot({ status }: { status: string }) {
  const cls =
    status === "completed" ? "bg-emerald-400" : status === "running" ? "bg-[#D73F09] animate-pulse" : status === "failed" ? "bg-red-400" : "bg-white/20";
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cls}`} />;
}
