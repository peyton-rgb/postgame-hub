// ============================================================
// GET /admin/pay/export?scope=… — the three CF CSV endpoints
// (pay_report / pay_report_detail / pay_report_balances) rebuilt
// as export buttons on the Pay queue. Exec-gated, read-only,
// exports the Hub payout ledger.
//   scope=paypal-venmo -> PayPal/Venmo payments
//   scope=all          -> every payout row
//   scope=balances     -> per-athlete totals (pending vs paid)
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

  const scope = request.nextUrl.searchParams.get("scope") ?? "all";
  const supabase = createServiceSupabase();

  let query = supabase
    .from("payouts")
    .select(
      "id, amount_cents, amount_label, status, provider, paid_at, created_at, profiles!athlete_id(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(10000);
  if (scope === "paypal-venmo") query = query.in("provider", ["paypal", "venmo"]);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as {
    id: string;
    amount_cents: number | null;
    amount_label: string | null;
    status: string | null;
    provider: string | null;
    paid_at: string | null;
    created_at: string | null;
    profiles: { full_name: string | null; email: string | null } | null;
  }[];

  let lines: string[];
  let filename: string;

  if (scope === "balances") {
    const byAthlete = new Map<string, { pending: number; paid: number }>();
    const nameOf = new Map<string, string>();
    for (const r of rows) {
      const key = r.profiles?.email ?? r.id;
      nameOf.set(key, r.profiles?.full_name ?? "");
      const cur = byAthlete.get(key) ?? { pending: 0, paid: 0 };
      if (r.status === "paid") cur.paid += r.amount_cents ?? 0;
      else if (r.status === "pending") cur.pending += r.amount_cents ?? 0;
      byAthlete.set(key, cur);
    }
    lines = [["Name", "Email", "Pending (USD)", "Paid (USD)"].join(",")];
    for (const [email, b] of Array.from(byAthlete.entries())) {
      lines.push(
        [csvCell(nameOf.get(email) ?? ""), csvCell(email), (b.pending / 100).toFixed(2), (b.paid / 100).toFixed(2)].join(",")
      );
    }
    filename = "payout-balances.csv";
  } else {
    lines = [["ID", "Name", "Email", "Amount (USD)", "Label", "Method", "Status", "Paid At", "Created At"].join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          csvCell(r.profiles?.full_name ?? ""),
          csvCell(r.profiles?.email ?? ""),
          r.amount_cents != null ? (r.amount_cents / 100).toFixed(2) : "",
          csvCell(r.amount_label),
          csvCell(r.provider),
          csvCell(r.status),
          csvCell(r.paid_at),
          csvCell(r.created_at),
        ].join(",")
      );
    }
    filename = scope === "paypal-venmo" ? "payments-paypal-venmo.csv" : "payments-all.csv";
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "report.pay_export",
    entity: "payouts",
    after: { scope, rows: rows.length },
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
