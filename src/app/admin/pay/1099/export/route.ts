// ============================================================
// GET /admin/pay/1099/export — CSV export of the 1099 screen.
// Exec-gated. Read-only (a download is a read, not a mutation).
// Contains EXACTLY what the masked screen shows: name, email,
// W-9 status, payment count, paid total. No SSNs exist in the Hub
// database, so no PII beyond the visible screen can leak here.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const actor = await getAdminActor("exec");
  if (!actor) return NextResponse.json({ error: "exec only" }, { status: 403 });

  const yearParam = request.nextUrl.searchParams.get("year") ?? "";
  const year = /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : new Date().getFullYear();

  const supabase = createServiceSupabase();
  const { data: paid, error } = await supabase
    .from("payouts")
    .select("athlete_id, amount_cents, profiles!athlete_id(full_name, email, w9_status)")
    .eq("status", "paid")
    .gte("paid_at", `${year}-01-01`)
    .lt("paid_at", `${year + 1}-01-01`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byAthlete = new Map<
    string,
    { name: string; email: string; w9: string; total: number; count: number }
  >();
  for (const p of (paid ?? []) as unknown as {
    athlete_id: string | null;
    amount_cents: number | null;
    profiles: { full_name: string | null; email: string | null; w9_status: string | null } | null;
  }[]) {
    if (!p.athlete_id) continue;
    const cur = byAthlete.get(p.athlete_id) ?? {
      name: p.profiles?.full_name ?? "",
      email: p.profiles?.email ?? "",
      w9: p.profiles?.w9_status ?? "",
      total: 0,
      count: 0,
    };
    cur.total += p.amount_cents ?? 0;
    cur.count += 1;
    byAthlete.set(p.athlete_id, cur);
  }

  const lines = [["Name", "Email", "W9 Status", "Payments", `Paid Total ${year} (USD)`].join(",")];
  for (const r of Array.from(byAthlete.values()).sort((a, b) => b.total - a.total)) {
    lines.push(
      [csvCell(r.name), csvCell(r.email), csvCell(r.w9), r.count, (r.total / 100).toFixed(2)].join(",")
    );
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "report.1099_export",
    entity: "payouts",
    after: { year, rows: byAthlete.size },
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="1099-report-${year}.csv"`,
    },
  });
}
