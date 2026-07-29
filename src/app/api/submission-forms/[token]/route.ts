// src/app/api/submission-forms/[token]/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. Row actions from the •••  menu.
//
//   PATCH { action: "revoke" }     → active=false, revoked_at=now
//   PATCH { action: "regenerate" } → new token, re-activated, sent_at cleared
//
// Regenerate rewrites the row's token (its PK). Nothing FK-references the
// token — tier3_submissions keys on campaign_id — so this is safe and keeps
// the campaign + settings intact while invalidating the old URL.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const svc = createServiceSupabase();
  const token = params.token;

  if (body?.action === "revoke") {
    const { error } = await svc
      .from("submission_links")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("token", token);
    if (error) return NextResponse.json({ error: "Couldn't revoke." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "regenerate") {
    const newToken = randomBytes(12).toString("hex");
    const { error } = await svc
      .from("submission_links")
      .update({ token: newToken, active: true, revoked_at: null, sent_at: null })
      .eq("token", token);
    if (error) return NextResponse.json({ error: "Couldn't regenerate." }, { status: 500 });
    return NextResponse.json({ ok: true, token: newToken });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
