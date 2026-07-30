// src/app/api/submission-forms/[token]/review/[submissionId]/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. Data behind the content-review page.
//
//   GET → { submission, suggestions, versions }
//     submission — the tier3_submissions row + its AI score (from
//                  /api/tier3/process; not re-run here).
//     suggestions — edit_suggestions for this submission.
//     versions    — edit_jobs for this submission, oldest first, each with
//                   its edit_steps. The ORIGINAL upload is V1; the first
//                   edit job's output is V2, and so on (parent_job_id chain).
//
// The edit engine itself (create / confirm / approve) is reused as-is via
// /api/editing/jobs/* — this endpoint only reads the review state.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string; submissionId: string } }
) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const svc = createServiceSupabase();

  const { data: submission } = await svc
    .from("tier3_submissions")
    .select(
      "id, campaign_id, athlete_name, ig_handle, file_name, asset_type, drive_file_url, drive_thumbnail_url, score_composite, score_composition, score_lighting, score_subject, score_brand_visibility, score_hook, tags, status"
    )
    .eq("id", params.submissionId)
    .single();
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const { data: suggestions } = await svc
    .from("edit_suggestions")
    .select("id, kind, summary, detail, severity, status")
    .eq("submission_id", params.submissionId)
    .order("severity", { ascending: false });

  const { data: jobs } = await svc
    .from("edit_jobs")
    .select(
      "id, status, instruction, edit_plan, estimated_cost_usd, actual_cost_usd, output_url, output_thumbnail_url, parent_job_id, content_type, source_url, created_at"
    )
    .eq("submission_id", params.submissionId)
    .order("created_at", { ascending: true });

  const jobIds = (jobs ?? []).map((j) => j.id);
  const stepsByJob: Record<string, any[]> = {};
  if (jobIds.length) {
    const { data: steps } = await svc
      .from("edit_steps")
      .select("id, edit_job_id, step_number, action, tool, description, params, status, cost_usd, error_message")
      .in("edit_job_id", jobIds)
      .order("step_number", { ascending: true });
    for (const s of steps ?? []) (stepsByJob[s.edit_job_id] ??= []).push(s);
  }

  // Original upload is V1; each edit job's output is the next version.
  const versions = (jobs ?? []).map((j, i) => ({
    ...j,
    versionLabel: `V${i + 2}`,
    steps: stepsByJob[j.id] ?? [],
  }));

  // Sibling submissions for this campaign (prev/next + "FILE 3 OF 8").
  const { data: sibs } = await svc
    .from("tier3_submissions")
    .select("id")
    .eq("campaign_id", submission.campaign_id)
    .order("created_at", { ascending: true });
  const siblings = (sibs ?? []).map((s) => s.id);

  return NextResponse.json({ submission, suggestions: suggestions ?? [], versions, siblings });
}

// POST → submission-level approve / reject (the idle-state buttons). The edit
// engine's own approve is separate (/api/editing/jobs/[id]/approve).
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string; submissionId: string } }
) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const nextStatus =
    body?.action === "approve" ? "approved" : body?.action === "reject" ? "rejected" : null;
  if (!nextStatus) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const svc = createServiceSupabase();
  const { error } = await svc
    .from("tier3_submissions")
    .update({ status: nextStatus, reviewed_by: staff.id, reviewed_at: new Date().toISOString() })
    .eq("id", params.submissionId);
  if (error) return NextResponse.json({ error: "Couldn't update the submission." }, { status: 500 });
  return NextResponse.json({ ok: true, status: nextStatus });
}
