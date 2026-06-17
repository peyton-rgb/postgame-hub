// ============================================================
// POST /api/athlete/deliverables/submit
//
// Submits a deal's uploaded content for approval (content-approval gate 1).
// Requires EVERY deliverable to be uploaded first, then flips them to
// in_review. Ownership verified from the session.
//
// Body: { optinId }
// ============================================================

import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { optinId } = body || {};
  if (!optinId) {
    return NextResponse.json({ error: "Missing optinId" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { data: deliverables } = await service
    .from("athlete_deliverables")
    .select("id,slot,status,file_url,athlete_id")
    .eq("optin_id", optinId);

  if (!deliverables || deliverables.length === 0) {
    return NextResponse.json({ error: "No deliverables to submit." }, { status: 404 });
  }
  if (deliverables.some((d) => d.athlete_id !== user.id)) {
    return NextResponse.json({ error: "Not your deal." }, { status: 403 });
  }

  // Every deliverable must have an uploaded file (or already be further along).
  // The upload writes file_url on the deliverable (not media_id), so check that.
  const notReady = deliverables.filter(
    (d) => !d.file_url || d.status === "to_upload" || d.status === "changes_requested"
  );
  if (notReady.length > 0) {
    return NextResponse.json(
      { error: `Upload all ${deliverables.length} deliverables before submitting.` },
      { status: 400 }
    );
  }

  const ids = deliverables.filter((d) => d.status === "uploaded").map((d) => d.id);
  if (ids.length > 0) {
    const { error: updErr } = await service
      .from("athlete_deliverables")
      .update({ status: "in_review", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (updErr) {
      console.error("submit update error:", updErr.message);
      return NextResponse.json({ error: "Couldn't submit. Please try again." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
