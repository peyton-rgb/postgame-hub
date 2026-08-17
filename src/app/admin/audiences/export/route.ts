// ============================================================
// GET /admin/audiences/export — CSV download of the current
// audience segment (audiences_download.cfm rebuilt). Staff-gated,
// read-only, same filter logic as the builder page. Streams up to
// 10,000 rows in 1,000-row pages; the row cap is stated in the
// file header comment row, never silent.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import { buildAudienceFilters, applyAudienceFilters } from "@/lib/admin/audience";

export const dynamic = "force-dynamic";

const MAX_ROWS = 10000;
const CHUNK = 1000;

function csvCell(v: string | number | null): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const actor = await getAdminActor("staff");
  if (!actor) return NextResponse.json({ error: "staff only" }, { status: 403 });

  const sp: Record<string, string | undefined> = {};
  request.nextUrl.searchParams.forEach((v, k) => (sp[k] = v));
  const f = buildAudienceFilters(sp);

  const supabase = createServiceSupabase();
  const lines = [
    ["First Name", "Last Name", "IG Handle", "Followers", "Sport", "College", "State", "Rating"].join(","),
  ];

  let fetched = 0;
  let truncated = false;
  for (let fromIdx = 0; fromIdx < MAX_ROWS; fromIdx += CHUNK) {
    const { data, error } = await applyAudienceFilters(
      supabase
        .from("people")
        .select(
          "first_name, last_name, instagram_handle, instagram_followers, sport, college_raw, college_state, rating"
        ),
      f
    )
      .order("instagram_followers", { ascending: false, nullsFirst: false })
      .range(fromIdx, fromIdx + CHUNK - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = (data ?? []) as any[];
    for (const r of batch) {
      lines.push(
        [
          csvCell(r.first_name),
          csvCell(r.last_name),
          csvCell(r.instagram_handle),
          r.instagram_followers ?? "",
          csvCell(r.sport),
          csvCell(r.college_raw),
          csvCell(r.college_state),
          csvCell(r.rating),
        ].join(",")
      );
    }
    fetched += batch.length;
    if (batch.length < CHUNK) break;
    if (fromIdx + CHUNK >= MAX_ROWS) truncated = true;
  }
  if (truncated) lines.push(`# TRUNCATED at ${MAX_ROWS} rows — narrow the segment for a full export`);

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "audience.export",
    entity: "people",
    after: { filters: f as unknown as Record<string, unknown>, rows: fetched, truncated },
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audience-segment.csv"',
    },
  });
}
