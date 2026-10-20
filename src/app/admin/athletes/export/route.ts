// ============================================================
// GET /admin/athletes/export — CSV of the athlete list exactly as
// filtered on /admin/athletes (same level + toolbar logic, from
// src/lib/admin/athletes.ts). Staff-gated, read-only. Up to 10,000
// rows; a cap is stated in the file, never silent.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import { applyAthleteList, buildAthleteListFilters, levelOf, ATHLETE_LEVELS } from "@/lib/admin/athletes";

// ?ids=<uuid>,<uuid>… (the pick bar) exports exactly those athletes, in
// the same columns; otherwise the current tab + toolbar filters.

export const dynamic = "force-dynamic";

const MAX_ROWS = 10000;
const CHUNK = 1000;

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const actor = await getAdminActor("staff");
  if (!actor) return NextResponse.json({ error: "staff only" }, { status: 403 });

  const sp: Record<string, string | undefined> = {};
  request.nextUrl.searchParams.forEach((v, k) => (sp[k] = v));
  const f = buildAthleteListFilters(sp);
  const ids = (sp.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 1000);
  const supabase = createServiceSupabase();

  let collegeIds: number[] = [];
  if (f.school) {
    const [byName, byAlias] = await Promise.all([
      supabase.from("colleges").select("id").ilike("name", `%${f.school}%`).limit(50),
      supabase.from("school_aliases").select("college_id").ilike("alias", `%${f.school}%`).limit(50),
    ]);
    collegeIds = Array.from(
      new Set([
        ...((byName.data ?? []).map((c) => c.id) as number[]),
        ...((byAlias.data ?? []).map((a) => a.college_id).filter(Boolean) as number[]),
      ])
    );
  }

  const labelOf = (k: string) => ATHLETE_LEVELS.find((l) => l.key === k)?.label ?? k;
  const lines = [
    ["First name", "Last name", "Instagram", "Instagram followers", "TikTok", "TikTok followers", "Level", "School", "State", "Sport", "Gender", "Rating", "NIL value", "On the app"].join(","),
  ];

  let fetched = 0;
  let truncated = false;
  for (let fromIdx = 0; fromIdx < MAX_ROWS; fromIdx += CHUNK) {
    const cols =
      "first_name, last_name, instagram_handle, instagram_followers, tiktok_handle, tiktok_followers, person_type, roster_status, college_raw, college_state, sport, gender, rating, nil_value, device, colleges(name)";
    const { data, error } = await (ids.length
      ? supabase.from("people").select(cols).in("id", ids)
      : applyAthleteList(supabase.from("people").select(cols), f, collegeIds)
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
          csvCell(r.tiktok_handle),
          r.tiktok_followers ?? "",
          csvCell(labelOf(levelOf(r))),
          csvCell(r.colleges?.name ?? r.college_raw),
          csvCell(r.college_state),
          csvCell(r.sport),
          csvCell(r.gender),
          csvCell(r.rating),
          r.nil_value ?? "",
          r.device ? "Yes" : "No",
        ].join(",")
      );
    }
    fetched += batch.length;
    if (batch.length < CHUNK) break;
    if (fromIdx + CHUNK >= MAX_ROWS) truncated = true;
  }
  if (truncated) lines.push(`# TRUNCATED at ${MAX_ROWS} rows — narrow the list for a full export`);

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "athletes.export",
    entity: "people",
    after: { filters: f as unknown as Record<string, unknown>, picked: ids.length || undefined, rows: fetched, truncated },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="athletes-${ids.length ? "picked" : f.level}-${stamp}.csv"`,
    },
  });
}
