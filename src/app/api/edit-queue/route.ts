// src/app/api/edit-queue/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. The open edit queue behind /dashboard/edit-queue.
//
//   GET → { jobs, campaigns, orphans }
//     jobs      — every open job (queued or awaiting approval), oldest first.
//     campaigns — the distinct campaigns present, for the filter.
//     orphans   — submissions at needs_edit with NO open job. This should
//                 always be empty; it is returned rather than hidden because
//                 a silent orphan is the bug this whole lane exists to stop,
//                 and the screen says so out loud when one appears.
//
// Sorted by longest waiting, not by volume: the oldest submission sat 13 days
// before anyone looked at it.
//
// Costs are `numeric` and arrive from PostgREST as strings — coerced here via
// num() so the client never has to think about it.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { num, readInstructions, OPEN_JOB_STATUSES, JOB_STATUS } from "@/lib/edit-queue";

export const dynamic = "force-dynamic";

export interface EditQueueJob {
  id: string;
  status: string;
  instruction: string;
  contentType: string;
  sourceUrl: string;
  outputUrl: string | null;
  outputThumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  queuedBy: string | null;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  instructionCount: number;
  parentJobId: string | null;
  submission: {
    id: string;
    athleteName: string | null;
    campaignId: string | null;
    campaignName: string | null;
    fileName: string | null;
    thumbnailUrl: string | null;
    status: string | null;
  } | null;
}

// The embed comes back as an object for a to-one FK, but the generated types
// model it as an array. Normalise so downstream sees one shape either way.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function GET() {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const svc = createServiceSupabase();

  const { data, error } = await svc
    .from("edit_jobs")
    .select(
      `id, status, instruction, content_type, source_url, output_url, output_thumbnail_url,
       edit_plan, estimated_cost_usd, actual_cost_usd, parent_job_id, created_by, created_at, updated_at,
       submission:tier3_submissions!edit_jobs_submission_id_fkey(
         id, athlete_name, campaign_id, campaign_name, file_name, drive_thumbnail_url, status
       )`
    )
    .in("status", OPEN_JOB_STATUSES)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Couldn't load the edit queue." }, { status: 500 });
  }

  const rows = data ?? [];

  // Resolve who queued each job in one round trip rather than per row.
  const creatorIds = Array.from(new Set(rows.map((r: any) => r.created_by).filter(Boolean)));
  const names = new Map<string, string>();
  if (creatorIds.length) {
    const { data: people } = await svc
      .from("profiles")
      .select("id, display_name, full_name, email")
      .in("id", creatorIds);
    for (const p of people ?? []) {
      names.set(p.id, p.display_name || p.full_name || p.email || "Unknown");
    }
  }

  const jobs: EditQueueJob[] = rows.map((r: any) => {
    const sub = one<any>(r.submission);
    return {
      id: r.id,
      status: r.status,
      instruction: r.instruction,
      contentType: r.content_type,
      sourceUrl: r.source_url,
      outputUrl: r.output_url ?? null,
      outputThumbnailUrl: r.output_thumbnail_url ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? null,
      queuedBy: names.get(r.created_by) ?? null,
      estimatedCostUsd: num(r.estimated_cost_usd),
      actualCostUsd: num(r.actual_cost_usd),
      instructionCount: readInstructions(r.edit_plan).length,
      parentJobId: r.parent_job_id ?? null,
      submission: sub
        ? {
            id: sub.id,
            athleteName: sub.athlete_name ?? null,
            campaignId: sub.campaign_id ?? null,
            campaignName: sub.campaign_name ?? null,
            fileName: sub.file_name ?? null,
            thumbnailUrl: sub.drive_thumbnail_url ?? null,
            status: sub.status ?? null,
          }
        : null,
    };
  });

  // The orphan assertion. A file at needs_edit must always have an open job;
  // anything listed here is queued work that has gone missing.
  const withOpenJob = new Set(jobs.map((j) => j.submission?.id).filter(Boolean) as string[]);
  const { data: needsEdit } = await svc
    .from("tier3_submissions")
    .select("id, athlete_name, campaign_name, file_name, drive_thumbnail_url, reviewed_at")
    .eq("status", "needs_edit");

  const orphans = (needsEdit ?? [])
    .filter((s: any) => !withOpenJob.has(s.id))
    .map((s: any) => ({
      id: s.id,
      athleteName: s.athlete_name ?? null,
      campaignName: s.campaign_name ?? null,
      fileName: s.file_name ?? null,
      thumbnailUrl: s.drive_thumbnail_url ?? null,
      reviewedAt: s.reviewed_at ?? null,
    }));

  const campaigns = Array.from(
    new Map(
      jobs
        .filter((j) => j.submission?.campaignId)
        .map((j) => [j.submission!.campaignId!, j.submission!.campaignName ?? "Untitled campaign"])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  return NextResponse.json({
    jobs,
    campaigns,
    orphans,
    statuses: { queued: JOB_STATUS.queued, awaitingApproval: JOB_STATUS.awaitingApproval },
  });
}
