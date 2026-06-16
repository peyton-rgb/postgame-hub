// ============================================================
// POST /api/athlete/paypal — link the PayPal email that receives payouts
//
// profiles.paypal_linked / paypal_email are frozen against client self-update
// (see the protect trigger), so this must run server-side with the service
// role. We never store PayPal credentials — just the destination email.
// ============================================================

import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

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
  const email = (body?.email || "").trim();
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Enter a valid PayPal email." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error: updErr } = await service
    .from("profiles")
    .update({ paypal_email: email, paypal_linked: true, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updErr) {
    console.error("paypal link error:", updErr.message);
    return NextResponse.json({ error: "Couldn't save your PayPal email. Please try again." }, { status: 500 });
  }

  // Snapshot the email onto any not-yet-paid payouts so they pay out correctly.
  await service
    .from("payouts")
    .update({ paypal_email: email, updated_at: new Date().toISOString() })
    .eq("athlete_id", user.id)
    .neq("status", "paid");

  return NextResponse.json({ ok: true });
}
