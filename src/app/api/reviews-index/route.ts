// src/app/api/reviews-index/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. What needs Postgame's attention across all campaigns.
//
//   GET → { rows } — one row per campaign that has a submission form,
//                    oldest first. See src/lib/reviews-index.ts for the SQL
//                    this is a port of and for why is_test_upload is excluded
//                    from the file counts but not from the age.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadReviewsIndex } from "@/lib/reviews-index";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const rows = await loadReviewsIndex(createServiceSupabase());
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ error: "Couldn't load the reviews index." }, { status: 500 });
  }
}
