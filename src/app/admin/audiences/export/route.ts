// ============================================================
// GET /admin/audiences/export — CSV of an audience
// (audiences_download.cfm rebuilt). Staff-gated, read-only.
//
//   ?id=<saved_audiences id>  → that saved audience's filters
//   otherwise                  → the filters in the query string
//                                (builder params; old single-value
//                                params still work)
//
// Same logic as the builder's count (src/lib/admin/audience.ts):
// the filtered athletes plus any hand-added handles, minus leave-outs,
// de-duplicated. Up to 10,000 rows in 1,000-row pages; the cap is
// written into the file, never silent.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import {
  AUDIENCE_PERSON_COLUMNS,
  applyAudienceFilters,
  applyAudienceHandles,
  buildAudienceFilters,
  hasNarrowingFilters,
  resolveExcludedPeople,
  savedFiltersToParams,
} from "@/lib/admin/audience";

export const dynamic = "force-dynamic";

const MAX_ROWS = 10000;
const CHUNK = 1000;

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const GENDER: Record<string, string> = { M: "Men", W: "Women", N: "Non-binary" };

export async function GET(request: NextRequest) {
  const actor = await getAdminActor("staff");
  if (!actor) return NextResponse.json({ error: "staff only" }, { status: 403 });

  const supabase = createServiceSupabase();
  let sp: Record<string, string | undefined> = {};
  request.nextUrl.searchParams.forEach((v, k) => (sp[k] = v));

  let fileName = "audience";
  const id = /^[0-9a-f-]{36}$/i.test(sp.id ?? "") ? sp.id! : null;
  if (id) {
    const { data, error } = await (supabase as any).from("saved_audiences").select("name, filters").eq("id", id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "audience not found" }, { status: 404 });
    sp = savedFiltersToParams(data.filters);
    fileName = String(data.name ?? "audience").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "audience";
  }
  const f = buildAudienceFilters(sp);
  const excluded = await resolveExcludedPeople(supabase, f);
  const handlesOnly = f.handles.length > 0 && !hasNarrowingFilters(f);

  const lines = [
    ["First name", "Last name", "Instagram", "Instagram followers", "TikTok", "College", "Sport", "Gender", "State", "Rating", "NIL value", "On the app"].join(","),
  ];
  const seen = new Set<string>();
  const push = (r: any) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    lines.push(
      [
        csvCell(r.first_name),
        csvCell(r.last_name),
        csvCell(r.instagram_handle),
        r.instagram_followers ?? "",
        csvCell(r.tiktok_handle),
        csvCell(r.college_raw),
        csvCell(r.sport),
        csvCell(GENDER[r.gender] ?? r.gender),
        csvCell(r.college_state),
        csvCell(r.rating),
        r.nil_value ?? "",
        r.device ? "Yes" : "No",
      ].join(",")
    );
  };

  // Hand-added handles first (≤ 500, one request).
  if (f.handles.length) {
    const { data, error } = await applyAudienceHandles(supabase.from("people").select(AUDIENCE_PERSON_COLUMNS), f, excluded).limit(1000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const r of (data ?? []) as any[]) push(r);
  }

  let truncated = false;
  if (!handlesOnly) {
    for (let fromIdx = 0; fromIdx < MAX_ROWS; fromIdx += CHUNK) {
      const { data, error } = await applyAudienceFilters(supabase.from("people").select(AUDIENCE_PERSON_COLUMNS), f, excluded)
        .order("instagram_followers", { ascending: false, nullsFirst: false })
        .order("id")
        .range(fromIdx, fromIdx + CHUNK - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data ?? []) as any[];
      for (const r of batch) push(r);
      if (batch.length < CHUNK) break;
      if (fromIdx + CHUNK >= MAX_ROWS) truncated = true;
    }
  }
  if (truncated) lines.push(`# TRUNCATED at ${MAX_ROWS} rows — narrow the audience for a full export`);

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "audience.export",
    entity: "people",
    entityId: id,
    after: { filters: f as unknown as Record<string, unknown>, rows: seen.size, truncated },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}-${stamp}.csv"`,
    },
  });
}
