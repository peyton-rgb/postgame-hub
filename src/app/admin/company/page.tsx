// ============================================================
// /admin/company — Company Dashboard (5C). Absorbs CF's profile +
// user dashboards. Every figure is a live read-only aggregate of
// the Hub database — no cached, invented, or CF-side numbers.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatMoney } from "@/lib/admin/db";
import { PageHeader, StatTile } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage() {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const head = (table: string, filter?: (q: any) => any) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    return q;
  };

  const [
    athletes,
    formerAthletes,
    fans,
    agents,
    videographers,
    activeAthletes,
    campaignsTotal,
    campaignsPublished,
    brandsActive,
    mediaCount,
    colleges,
    aliases,
    deals,
    rosterRows,
    linkedRoster,
    payoutsRes,
    agentRunsRes,
  ] = await Promise.all([
    head("people", (q) => q.eq("person_type", "Athlete")),
    head("people", (q) => q.eq("person_type", "Former Athlete")),
    head("people", (q) => q.eq("person_type", "Fan")),
    head("people", (q) => q.eq("person_type", "Agent")),
    head("people", (q) => q.eq("person_type", "Videographer")),
    head("people", (q) => q.eq("person_type", "Athlete").eq("is_active", true).eq("is_archived", false)),
    head("campaign_recaps"),
    head("campaign_recaps", (q) => q.eq("status", "published")),
    head("brands", (q) => q.eq("archived", false)),
    head("media"),
    head("colleges"),
    head("school_aliases"),
    head("deals"),
    head("athletes"),
    head("athletes", (q) => q.not("person_id", "is", null)),
    supabase.from("payouts").select("amount_cents, status"),
    supabase.from("agent_runs").select("cost_usd, status"),
  ]);

  const n = (r: { count: number | null }) => (r.count ?? 0).toLocaleString();

  const payouts = (payoutsRes.data ?? []) as { amount_cents: number | null; status: string | null }[];
  const paidCents = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const pendingCents = payouts
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  const runs = (agentRunsRes.data ?? []) as { cost_usd: number | null; status: string | null }[];
  const agentCost = runs.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

  const section = (title: string) => (
    <h2 className="pt-6 pb-2 text-[13px] font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
  );

  return (
    <div>
      <PageHeader
        title="Company Dashboard"
        subtitle="Live aggregates across the whole Hub — absorbs CF's profile and user dashboards"
      />

      {section("Network")}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Athletes" value={n(athletes)} href="/admin/users?preset=athletes" />
        <StatTile label="Active athletes" value={n(activeAthletes)} />
        <StatTile label="Former athletes" value={n(formerAthletes)} />
        <StatTile label="Fans" value={n(fans)} />
        <StatTile label="Agents" value={n(agents)} href="/admin/agents" />
        <StatTile label="Videographers" value={n(videographers)} />
        <StatTile label="Colleges" value={n(colleges)} href="/admin/colleges" />
        <StatTile label="School aliases" value={n(aliases)} href="/admin/colleges/mapper" />
      </div>

      {section("Campaigns & brands")}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Campaigns" value={n(campaignsTotal)} href="/admin/campaigns" />
        <StatTile label="Published" value={n(campaignsPublished)} />
        <StatTile label="Active brands" value={n(brandsActive)} href="/admin/brands" />
        <StatTile label="Media items" value={n(mediaCount)} />
        <StatTile label="Roster rows" value={n(rosterRows)} />
        <StatTile label="Roster ↔ network linked" value={n(linkedRoster)} />
        <StatTile label="Sales deals" value={n(deals)} />
      </div>

      {section("Money & agents (Hub ledger)")}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Payouts paid" value={formatMoney(paidCents)} href="/admin/pay?status=paid" />
        <StatTile label="Payouts pending" value={formatMoney(pendingCents)} href="/admin/pay?status=pending" />
        <StatTile label="Agent runs" value={runs.length.toLocaleString()} />
        <StatTile
          label="Agent spend"
          value={agentCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        />
      </div>

      <p className="pt-6 text-[12px] text-stone-500">
        CF-era figures (148M impressions, historical payment ledgers) live in the CF database and
        are deliberately not blended in — when those tables migrate, their tiles join this page.
      </p>
    </div>
  );
}
