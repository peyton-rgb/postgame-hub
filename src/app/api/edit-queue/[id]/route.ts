// src/app/api/edit-queue/[id]/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. One edit job: the source file, the instruction, the result.
//
//   GET  → { job } — everything the workspace renders.
//   POST → the three actions on a job.
//     attach-output — the result has been uploaded to storage; store it and
//                     move the job to awaiting-approval.
//     approve       — the human gate. Stamps approved_by, completes the job
//                     and moves the submission out of needs_edit.
//     reject        — the result is not good enough. Closes this job and opens
//                     a chained one (parent_job_id) carrying the new note, so
//                     the file never sits at needs_edit without an open job.
//
// NOTHING HERE PERFORMS AN EDIT. attach-output is the seam a worker would
// later call instead of a person, which is why it takes a storage path rather
// than knowing where the bytes came from.
//
// Upload convention follows athlete/deliverables/upload and v/register: the
// client puts the bytes in the bucket, then hands the server the path. The
// server resolves the public URL and owns every database write.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import {
  num,
  readInstructions,
  compileInstruction,
  JOB_STATUS,
  OPEN_JOB_STATUSES,
  SUBMISSION_STATUS_AFTER_EDIT,
  type EditInstruction,
} from "@/lib/edit-queue";

export const dynamic = "force-dynamic";

// Same bucket as every other media upload in the app.
const BUCKET = "campaign-media";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const JOB_SELECT = `id, status, instruction, content_type, source_url, output_url, output_thumbnail_url,
   edit_plan, scene_map, estimated_cost_usd, actual_cost_usd, processing_time_seconds,
   parent_job_id, created_by, approved_by, created_at, updated_at, submission_id,
   submission:tier3_submissions!edit_jobs_submission_id_fkey(
     id, athlete_name, school, campaign_id, campaign_name, file_name, mime_type, asset_type,
     drive_file_url, drive_thumbnail_url, status, reviewed_at, reviewed_at_stage
   )`;

async function loadJob(svc: ReturnType<typeof createServiceSupabase>, id: string) {
  const { data } = await svc.from("edit_jobs").select(JOB_SELECT).eq("id", id).single();
  return data as any | null;
}

function shape(r: any, queuedBy: string | null, approvedBy: string | null) {
  const sub = one<any>(r.submission);
  return {
    id: r.id,
    status: r.status,
    instruction: r.instruction,
    instructions: readInstructions(r.edit_plan),
    contentType: r.content_type,
    sourceUrl: r.source_url,
    outputUrl: r.output_url ?? null,
    outputThumbnailUrl: r.output_thumbnail_url ?? null,
    estimatedCostUsd: num(r.estimated_cost_usd),
    actualCostUsd: num(r.actual_cost_usd),
    processingTimeSeconds: r.processing_time_seconds ?? null,
    parentJobId: r.parent_job_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
    queuedBy,
    approvedBy,
    submission: sub
      ? {
          id: sub.id,
          athleteName: sub.athlete_name ?? null,
          school: sub.school ?? null,
          campaignId: sub.campaign_id ?? null,
          campaignName: sub.campaign_name ?? null,
          fileName: sub.file_name ?? null,
          mimeType: sub.mime_type ?? null,
          assetType: sub.asset_type ?? null,
          driveFileUrl: sub.drive_file_url ?? null,
          thumbnailUrl: sub.drive_thumbnail_url ?? null,
          status: sub.status ?? null,
          reviewedAt: sub.reviewed_at ?? null,
          reviewedAtStage: sub.reviewed_at_stage ?? null,
        }
      : null,
  };
}

async function nameFor(svc: ReturnType<typeof createServiceSupabase>, id: string | null) {
  if (!id) return null;
  const { data } = await svc
    .from("profiles")
    .select("display_name, full_name, email")
    .eq("id", id)
    .single();
  if (!data) return null;
  return data.display_name || data.full_name || data.email || null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const svc = createServiceSupabase();
  const job = await loadJob(svc, params.id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const [queuedBy, approvedBy] = await Promise.all([
    nameFor(svc, job.created_by),
    nameFor(svc, job.approved_by),
  ]);

  return NextResponse.json({ job: shape(job, queuedBy, approvedBy) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const svc = createServiceSupabase();
  const job = await loadJob(svc, params.id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const action = body?.action;
  const nowIso = new Date().toISOString();

  // ── attach the finished file ──────────────────────────────
  if (action === "attach-output") {
    const storagePath = typeof body?.storagePath === "string" ? body.storagePath : "";
    // Scope the path to this job so one job cannot claim another's upload.
    if (!storagePath || !storagePath.startsWith(`edit-output/${job.id}/`)) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
    }
    if (!OPEN_JOB_STATUSES.includes(job.status)) {
      return NextResponse.json({ error: "This job is already closed." }, { status: 409 });
    }

    const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(storagePath);
    const url = pub?.publicUrl;
    if (!url) return NextResponse.json({ error: "Couldn't resolve the uploaded file." }, { status: 500 });

    // A still gets its own URL as the thumbnail; a video has no frame to point
    // at until something extracts one, and video thumbnails are not stored
    // anywhere yet, so it is left null rather than pointed at the video file.
    const thumb = job.content_type === "image" ? url : null;

    const { error } = await svc
      .from("edit_jobs")
      .update({
        output_url: url,
        output_thumbnail_url: thumb,
        status: JOB_STATUS.awaitingApproval,
        actual_cost_usd: num(body?.actualCostUsd),
        processing_time_seconds: Number.isFinite(Number(body?.processingTimeSeconds))
          ? Math.max(0, Math.floor(Number(body.processingTimeSeconds)))
          : null,
        updated_at: nowIso,
      })
      .eq("id", job.id);

    if (error) return NextResponse.json({ error: "Couldn't attach the result." }, { status: 500 });
    return NextResponse.json({ ok: true, status: JOB_STATUS.awaitingApproval, outputUrl: url });
  }

  // ── the human gate ────────────────────────────────────────
  if (action === "approve") {
    if (!job.output_url) {
      return NextResponse.json({ error: "Attach the edited file before approving." }, { status: 400 });
    }
    if (job.status === JOB_STATUS.complete) {
      return NextResponse.json({ error: "This job is already approved." }, { status: 409 });
    }

    const { error } = await svc
      .from("edit_jobs")
      .update({ status: JOB_STATUS.complete, approved_by: staff.id, updated_at: nowIso })
      .eq("id", job.id);
    if (error) return NextResponse.json({ error: "Couldn't approve the job." }, { status: 500 });

    // The submission leaves needs_edit. See SUBMISSION_STATUS_AFTER_EDIT for
    // why it goes back to the reviewer rather than straight to approved.
    if (job.submission_id) {
      const { error: subErr } = await svc
        .from("tier3_submissions")
        .update({
          status: SUBMISSION_STATUS_AFTER_EDIT,
          review_instructions: null,
          reviewed_at_stage: null,
          updated_at: nowIso,
        })
        .eq("id", job.submission_id);

      if (subErr) {
        // Put the job back so the pair cannot disagree: an approved job whose
        // submission is still needs_edit reads as work nobody has to do.
        await svc
          .from("edit_jobs")
          .update({ status: JOB_STATUS.awaitingApproval, approved_by: null, updated_at: nowIso })
          .eq("id", job.id);
        return NextResponse.json({ error: "Couldn't release the submission." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, status: JOB_STATUS.complete });
  }

  // ── not good enough: chain a follow-up ────────────────────
  if (action === "reject") {
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";
    if (!note) {
      return NextResponse.json({ error: "Say what still needs doing." }, { status: 400 });
    }
    if (!OPEN_JOB_STATUSES.includes(job.status)) {
      return NextResponse.json({ error: "This job is already closed." }, { status: 409 });
    }

    // The follow-up carries the original instructions plus the new note, so
    // whoever picks up v2 sees the whole ask rather than only the correction.
    const carried: EditInstruction[] = [...readInstructions(job.edit_plan), { source: "note", text: note }];

    const { data: child, error: insErr } = await svc
      .from("edit_jobs")
      .insert({
        submission_id: job.submission_id,
        source_url: job.source_url,
        content_type: job.content_type,
        instruction: compileInstruction(carried),
        edit_plan: carried,
        status: JOB_STATUS.queued,
        parent_job_id: job.id,
        created_by: staff.id,
      })
      .select("id")
      .single();

    if (insErr || !child) {
      return NextResponse.json({ error: "Couldn't open the follow-up job." }, { status: 500 });
    }

    // Close the old one only once its replacement exists, so the submission is
    // never momentarily at needs_edit with no open job.
    const { error: closeErr } = await svc
      .from("edit_jobs")
      .update({ status: JOB_STATUS.rejected, updated_at: nowIso })
      .eq("id", job.id);
    if (closeErr) return NextResponse.json({ error: "Couldn't close the job." }, { status: 500 });

    return NextResponse.json({ ok: true, status: JOB_STATUS.rejected, nextJobId: child.id });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
