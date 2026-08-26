// src/app/api/submission-forms/[token]/review/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. The campaign-wide review hub behind
// /dashboard/submission-forms/[token]/review.
//
//   GET → { campaign, requirements, files }
//     campaign     — name, client and brand logo for the header.
//     requirements — min_photos / min_videos off submission_links. The
//                    "3 of 3" chips are driven by these, never by a constant:
//                    every form carries its own minimum.
//     files        — the reviewable tier3_submissions rows for the campaign.
//
//   POST → the three review actions (approve / queue-edit / reshoot).
//
// The per-file page (./[submissionId]) is the older AI-editing surface and is
// left alone; this endpoint only serves the hub.
//
// WHAT IS EXCLUDED FROM `files`, and why:
//   is_test_upload            — staff dry-runs. They are real rows with real
//                               scores, so nothing but the flag distinguishes
//                               them from an athlete's work.
//   status = 'scoring_failed' — no scores, so every bar and flag would be
//                               blank. It is a scorer problem, not a review
//                               one, and #214 owns that surface.
//
// Scores come back from PostgREST as STRINGS (the columns are `numeric`).
// They are coerced here, once, so the client never has to think about it —
// `"0.00" ?? fallback` is truthy and `"88" < 45` is a string comparison, and
// both of those fail silently rather than loudly.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// One reviewer instruction queued against a file. `source` separates what the
// scorer inferred from what a person actually asked for; downstream those
// carry different weight, so the distinction is stored rather than derived.
interface Instruction {
  source: "flag" | "note";
  text: string;
  timecode?: number;
}

function cleanInstructions(raw: unknown): Instruction[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Instruction[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const source = (r as any).source;
    const text = (r as any).text;
    if (source !== "flag" && source !== "note") continue;
    if (typeof text !== "string" || !text.trim()) continue;
    const item: Instruction = { source, text: text.trim().slice(0, 500) };
    const tc = num((r as any).timecode);
    if (tc !== null && tc >= 0) item.timecode = tc;
    out.push(item);
  }
  return out.length ? out.slice(0, 100) : null;
}

async function loadLink(svc: ReturnType<typeof createServiceSupabase>, token: string) {
  const { data } = await svc
    .from("submission_links")
    .select("token, campaign_id, min_photos, min_videos")
    .eq("token", token)
    .single();
  return data;
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const svc = createServiceSupabase();

  const link = await loadLink(svc, params.token);
  if (!link) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const { data: recap } = await svc
    .from("campaign_recaps")
    // Logo comes from the linked brand rather than campaign_recaps.client_logo_url,
    // for the reason given in ../route.ts: brand_id is the column that is
    // actually populated. Nested through the FK so this stays one query.
    .select(
      "id, name, client_name, brand:brands!campaigns_brand_id_fkey(id, name, logo_light_url, logo_primary_url)"
    )
    .eq("id", link.campaign_id)
    .single();

  // The generated types model this to-one embed as an array while PostgREST
  // returns a single object. Normalise so the shape is the same either way.
  const brand = (Array.isArray(recap?.brand) ? recap?.brand[0] : recap?.brand) ?? null;

  const { data: rows } = await svc
    .from("tier3_submissions")
    // One string literal, not a concatenation: the client infers the row type
    // from the literal, and `a + b` collapses it to `string`, which degrades
    // every column to GenericStringError.
    .select(
      "id, submission_id, athlete_name, school, asset_type, file_name, drive_file_url, drive_thumbnail_url, score_composite, score_composition, score_lighting, score_subject, score_brand_visibility, score_hook, tags, status, reviewed_at, reviewed_by, review_notes, review_instructions, reviewed_at_stage"
    )
    .eq("campaign_id", link.campaign_id)
    .eq("is_test_upload", false)
    .neq("status", "scoring_failed")
    .order("score_composite", { ascending: false, nullsFirst: false });

  const files = (rows ?? []).map((r) => ({
    id: r.id,
    athleteName: r.athlete_name || "Unknown",
    school: r.school ?? null,
    assetType: r.asset_type === "video" ? "video" : r.asset_type === "photo" ? "photo" : "unknown",
    fileName: r.file_name ?? "Untitled",
    fileUrl: r.drive_file_url ?? null,
    thumbUrl: r.drive_thumbnail_url ?? null,
    composite: num(r.score_composite),
    composition: num(r.score_composition),
    lighting: num(r.score_lighting),
    subject: num(r.score_subject),
    brandVisibility: num(r.score_brand_visibility),
    // Null on every video by design — the hook is scored from a poster frame,
    // which cannot carry a temporal property, and the composite renormalises
    // over the other four. It must render blank, never zero.
    hook: num(r.score_hook),
    tags: (r.tags as string[] | null) ?? [],
    status: r.status,
    reviewedAt: r.reviewed_at ?? null,
    reviewNotes: r.review_notes ?? null,
    reviewInstructions: (r.review_instructions as Instruction[] | null) ?? null,
    reviewedAtStage: r.reviewed_at_stage ?? null,
  }));

  return NextResponse.json({
    campaign: {
      id: link.campaign_id,
      name: recap?.name ?? "Campaign",
      clientName: recap?.client_name ?? null,
      logoUrl: brand?.logo_light_url || brand?.logo_primary_url || null,
    },
    requirements: { minPhotos: link.min_photos ?? 0, minVideos: link.min_videos ?? 0 },
    files,
  });
}

// POST → the three review actions.
//
//   { action: "approve",    submissionId }
//   { action: "queue-edit", submissionId, instructions[], stage? }
//   { action: "reshoot",    submissionIds[], note }   ← per athlete, not per file
//
// Every id is checked against this token's campaign before anything is
// written. The token is the only thing the caller controls, so trusting the
// ids alongside it would let one form's page write to another's rows.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const svc = createServiceSupabase();
  const link = await loadLink(svc, params.token);
  if (!link) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const action = body?.action;
  const ids: string[] =
    action === "reshoot"
      ? Array.isArray(body?.submissionIds)
        ? body.submissionIds.filter((x: unknown) => typeof x === "string")
        : []
      : typeof body?.submissionId === "string"
        ? [body.submissionId]
        : [];
  if (!ids.length) return NextResponse.json({ error: "No submission specified" }, { status: 400 });

  // Scope check: every id must belong to this form's campaign.
  const { data: owned } = await svc
    .from("tier3_submissions")
    .select("id")
    .eq("campaign_id", link.campaign_id)
    .in("id", ids);
  const ownedIds = (owned ?? []).map((r) => r.id);
  if (ownedIds.length !== ids.length) {
    return NextResponse.json({ error: "Submission not part of this campaign" }, { status: 404 });
  }

  const stamp = { reviewed_by: staff.id, reviewed_at: new Date().toISOString() };
  let patch: Record<string, unknown>;

  if (action === "approve") {
    // Approving clears any queued edit: the reviewer looked again and decided
    // it ships as-is, so leaving stale instructions behind would hand the edit
    // queue work that has been explicitly called off.
    patch = { ...stamp, status: "approved", review_instructions: null, reviewed_at_stage: null };
  } else if (action === "queue-edit") {
    const instructions = cleanInstructions(body?.instructions);
    if (!instructions) {
      return NextResponse.json({ error: "Nothing to queue — tick a flag or add a note." }, { status: 400 });
    }
    const stage = typeof body?.stage === "string" && body.stage.trim() ? body.stage.trim().slice(0, 40) : null;
    patch = { ...stamp, status: "needs_edit", review_instructions: instructions, reviewed_at_stage: stage };
  } else if (action === "reshoot") {
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";
    if (!note) return NextResponse.json({ error: "A reshoot needs a note saying why." }, { status: 400 });
    patch = { ...stamp, status: "rejected", review_notes: note };
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { error } = await svc.from("tier3_submissions").update(patch).in("id", ownedIds);
  if (error) return NextResponse.json({ error: "Couldn't save the review." }, { status: 500 });

  return NextResponse.json({ ok: true, status: patch.status, count: ownedIds.length });
}
