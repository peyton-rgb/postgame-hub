// ============================================================
// POST /api/staff/auto-editor/suggestion-action  (staff only)
//
// The edit gate. dismiss → status 'dismissed'. approve → status 'approved' AND
// queue an athlete_edit_jobs row (status 'queued') for the future Edit Engine.
// THE BUTTON IS REAL; EXECUTION IS STUBBED — no real cutting/editing happens.
//
// Body: { suggestionId, action: "approve" | "dismiss" }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { suggestionId, action } = body || {};
  if (!suggestionId || !["approve", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Missing suggestionId or invalid action" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data: suggestion } = await service
    .from("edit_suggestions")
    .select("id,deliverable_id,kind,summary,detail,severity,status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

  if (action === "dismiss") {
    const { error } = await service.from("edit_suggestions").update({ status: "dismissed" }).eq("id", suggestionId);
    if (error) return NextResponse.json({ error: "Couldn't dismiss." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // approve → mark approved + queue an edit job (stubbed execution)
  const { error: updErr } = await service.from("edit_suggestions").update({ status: "approved" }).eq("id", suggestionId);
  if (updErr) return NextResponse.json({ error: "Couldn't approve." }, { status: 500 });

  const { error: jobErr } = await service.from("athlete_edit_jobs").insert({
    deliverable_id: suggestion.deliverable_id,
    suggestion_id: suggestion.id,
    type: suggestion.kind,
    params: { summary: suggestion.summary, detail: suggestion.detail, severity: suggestion.severity },
    status: "queued",
    // NOTE(stub): a worker picks up status='queued' jobs, runs the edit (OTIO),
    // writes result_url, and sets status. Not implemented — see
    // docs/auto-editor/EDIT-ENGINE-HANDOFF.md.
  });
  if (jobErr) {
    console.error("edit job queue error:", jobErr.message);
    return NextResponse.json({ error: "Approved, but couldn't queue the edit job." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, queued: true });
}
