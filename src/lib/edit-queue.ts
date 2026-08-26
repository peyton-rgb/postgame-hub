// ============================================================
// Edit queue — the receiving end of the review hub's "send to edit queue".
//
// #218 writes tier3_submissions.status='needs_edit' and .review_instructions.
// Nothing read either, so queued work vanished. This module owns the lane:
// turning a review decision into an `edit_jobs` row, and moving that row
// through to an approved result.
//
// NOTHING HERE PERFORMS AN EDIT. A human does the work in Photoshop, After
// Effects or Frame.io and uploads the result. edit_steps.external_provider /
// external_job_id exist so a worker can later claim a job without the lane
// changing shape.
//
// ── Status vocabulary ───────────────────────────────────────
// edit_jobs.status is constrained in the database to:
//   pending | analyzing | planning | confirming | editing | review
//   | approved | rejected | failed
// (edit_jobs_status_check, confirmed against production.)
//
// That vocabulary predates this queue and no migration is in scope, so the
// three states this lane needs are mapped onto it rather than added:
//
//   queued             -> 'pending'    a job nobody has picked up
//   awaiting_approval  -> 'review'     a result is attached, a human must gate it
//   complete           -> 'approved'   approved; the submission has moved on
//
// The names below are the ones to use in code; the raw strings appear only
// here. If a migration ever widens the constraint, this map is the only edit.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export const JOB_STATUS = {
  queued: "pending",
  awaitingApproval: "review",
  complete: "approved",
  rejected: "rejected",
} as const;

export type JobStatusKey = keyof typeof JOB_STATUS;

// The states that still want a human. Anything else is off the queue.
export const OPEN_JOB_STATUSES: string[] = [JOB_STATUS.queued, JOB_STATUS.awaitingApproval];

// Where an approved edit sends its submission.
//
// Back to 'scored', not straight to 'approved'. The review hub's `approved`
// means "this file ships as-is", and the file that would ship is now the
// EDITED output — while every score and flag on the row still describes the
// original. Marking it approved would be approving it on the strength of
// scores that no longer describe the thing being approved.
//
// 'scored' returns it to the reviewer's queue to be judged on its own merits,
// which is the same path a first-time file takes. The hub already handles
// re-opening a file that had been sent to edit.
//
// The counter-argument is a ping-pong: reviewer queues an edit, approves the
// edit, then has to approve the file again. That is one extra look at a file
// that has materially changed, which is the look worth having.
export const SUBMISSION_STATUS_AFTER_EDIT = "scored";

// One reviewer instruction queued against a file. Mirrors the shape #218
// writes into tier3_submissions.review_instructions — `source` separates what
// the scorer flagged from what a person typed, and downstream those carry
// different weight.
export interface EditInstruction {
  source: "flag" | "note";
  text: string;
  timecode?: number;
}

// Postgres `numeric` arrives from PostgREST as a STRING. Coerce at the
// boundary, once: `"0.00" ?? fallback` is truthy and `"8" < 45` is a string
// comparison — both fail silently rather than loudly.
export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function isEditInstruction(v: unknown): v is EditInstruction {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (r.source === "flag" || r.source === "note") && typeof r.text === "string" && !!r.text.trim();
}

export function readInstructions(raw: unknown): EditInstruction[] {
  return Array.isArray(raw) ? raw.filter(isEditInstruction) : [];
}

// edit_jobs.content_type is NOT NULL and constrained to 'image' | 'video'
// (edit_jobs_content_type_check) — it is a media class, NOT a mime type, so
// the submission's mime_type cannot be passed through raw.
//
// mime_type is the more reliable signal where present; asset_type ('photo' |
// 'video' | 'unknown') is the fallback. An unresolvable file is treated as an
// image because the column cannot be null and 'image' is the safer default:
// the workspace shows it with an <img> and a download link either way, and
// nothing downstream branches on this yet. The submission keeps its own
// mime_type, so no information is lost by this narrowing.
export function contentClassFor(mimeType?: string | null, assetType?: string | null): "image" | "video" {
  const m = (mimeType ?? "").toLowerCase();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "image";
  if (assetType === "video") return "video";
  return "image";
}

// edit_jobs.instruction is NOT NULL prose, for the person doing the work.
// The structured array goes to edit_plan untouched; this is the readable
// rendering of the same thing, so the two never disagree.
export function compileInstruction(instructions: EditInstruction[]): string {
  if (!instructions.length) return "No specific instructions were recorded.";
  const lines = instructions.map((i) => {
    const tc =
      typeof i.timecode === "number" && i.timecode >= 0 ? ` (at ${formatTimecode(i.timecode)})` : "";
    // The origin is kept in the prose too: "flagged" reads differently from
    // "asked for" to whoever picks the job up.
    const lead = i.source === "flag" ? "Flagged" : "Reviewer";
    return `• ${lead}${tc}: ${i.text}`;
  });
  return lines.join("\n");
}

export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// How long a job has been waiting, in whole days/hours. Age matters more than
// volume here — the oldest submission sat 13 days before anyone looked.
export function waitingLabel(createdAt: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// A submission as the queue needs it, to build a job from.
export interface QueueableSubmission {
  id: string;
  drive_file_url: string;
  mime_type: string | null;
  asset_type: string | null;
}

export interface NewEditJobRow {
  submission_id: string;
  source_url: string;
  content_type: "image" | "video";
  instruction: string;
  edit_plan: EditInstruction[];
  status: string;
  created_by: string;
}

// Build the rows for a set of submissions. Pure, so the shape is testable
// without a database.
//
// asset_id is deliberately left unset: edit_jobs_one_source enforces
// num_nonnulls(asset_id, submission_id) <= 1, and submission_id is the anchor
// for this lane. asset_id belongs to the older inspo_items design.
export function buildEditJobRows(
  submissions: QueueableSubmission[],
  instructions: EditInstruction[],
  createdBy: string
): NewEditJobRow[] {
  const instruction = compileInstruction(instructions);
  return submissions.map((s) => ({
    submission_id: s.id,
    source_url: s.drive_file_url,
    content_type: contentClassFor(s.mime_type, s.asset_type),
    instruction,
    // As-is: the structure is what a worker will consume, and it records
    // whether each item came from a flag or from a person.
    edit_plan: instructions,
    status: JOB_STATUS.queued,
    created_by: createdBy,
  }));
}

// Create one job per submission, replacing any job still open against the same
// submission.
//
// Re-queueing is a real path: #218 lets a reviewer re-open a file that is
// already needs_edit and send it back with different instructions. Without the
// supersede step that would leave two open jobs for one file, and the queue
// would show the same work twice with contradictory instructions.
//
// Superseded jobs are closed as 'rejected' rather than deleted — a job that was
// issued and withdrawn is history worth keeping, and parent_job_id on the new
// row is not used here because this is a replacement, not a chained edit.
export async function createEditJobsForSubmissions(
  svc: SupabaseClient,
  opts: { submissionIds: string[]; instructions: EditInstruction[]; createdBy: string }
): Promise<{ created: number; error: string | null }> {
  const { submissionIds, instructions, createdBy } = opts;
  if (!submissionIds.length) return { created: 0, error: null };

  const { data: subs, error: subErr } = await svc
    .from("tier3_submissions")
    .select("id, drive_file_url, mime_type, asset_type")
    .in("id", submissionIds);

  if (subErr || !subs?.length) return { created: 0, error: subErr?.message ?? "No submissions found" };

  const { error: supersedeErr } = await svc
    .from("edit_jobs")
    .update({ status: JOB_STATUS.rejected, updated_at: new Date().toISOString() })
    .in("submission_id", submissionIds)
    .in("status", OPEN_JOB_STATUSES);

  if (supersedeErr) return { created: 0, error: supersedeErr.message };

  const rows = buildEditJobRows(subs as QueueableSubmission[], instructions, createdBy);
  const { error: insErr } = await svc.from("edit_jobs").insert(rows);
  if (insErr) return { created: 0, error: insErr.message };

  return { created: rows.length, error: null };
}
