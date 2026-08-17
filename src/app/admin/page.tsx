// ============================================================
// /admin — Admin Dashboard (CF start.cfm rebuilt).
// KPI stat tiles from real, read-only counts. No fake numbers:
// every tile is a live COUNT against the canonical table.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, StatTile } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

async function count(table: string, filter?: (q: any) => any): Promise<number> {
  try {
    const supabase = createServiceSupabase();
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count: n, error } = await q;
    if (error) return 0;
    return n ?? 0;
  } catch {
    return 0;
  }
}

export default async function AdminDashboard() {
  await requireAdmin("staff");

  const [users, campaigns, brands, mediaCount, rosterRows, colleges] = await Promise.all([
    count("people"),
    count("campaign_recaps"),
    count("brands", (q) => q.eq("archived", false)),
    count("media"),
    count("athletes"),
    count("colleges"),
  ]);

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Live counts from the Hub database — the CF start screen, rebuilt."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Users (people)" value={fmt(users)} href="/admin/users" />
        <StatTile label="Campaigns" value={fmt(campaigns)} href="/admin/campaigns" />
        <StatTile label="Brands" value={fmt(brands)} href="/admin/brands" />
        <StatTile label="Media items" value={fmt(mediaCount)} />
        <StatTile label="Roster rows" value={fmt(rosterRows)} href="/admin/athletes" />
        <StatTile label="Colleges" value={fmt(colleges)} href="/admin/colleges" />
      </div>
    </div>
  );
}
