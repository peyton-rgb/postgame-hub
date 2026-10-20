// ============================================================
// /admin/overview — Overview. Matches the prototype's last
// S.overview: count tiles, the money row (from the Hub payouts
// ledger, not the prototype's example figures), followers and
// sign-up bar lists, newest campaigns and most active brands.
// Every number is a live read-only count.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatMoney } from "@/lib/admin/db";
import { PageHeader } from "@/components/admin/ui";
import { Tiles, CampCell } from "@/components/admin/ops-bits";
import { BrandMark } from "@/components/admin/brand-bits";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { BarList, SimpleTable } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

interface BrandLite {
  id: string;
  name: string | null;
  logo_dark_url: string | null;
  logo_primary_url: string | null;
  logo_mark_url: string | null;
}
const logoOf = (b: BrandLite | null | undefined) =>
  b ? b.logo_dark_url || b.logo_primary_url || b.logo_mark_url || null : null;

const FOLLOWER_BUCKETS: [string, number, number | null][] = [
  ["Under 1K", 0, 1000],
  ["1K–5K", 1000, 5000],
  ["5K–10K", 5000, 10000],
  ["10K–50K", 10000, 50000],
  ["50K–100K", 50000, 100000],
  ["100K+", 100000, null],
];

export default async function OverviewPage() {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const head = async (table: string, filter?: (q: any) => any): Promise<number> => {
    try {
      let q: any = supabase.from(table).select("id", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count, error } = await q;
      return error ? 0 : count ?? 0;
    } catch {
      return 0;
    }
  };

  // Sign-ups: the newest six months that have data in the copied roster.
  const { data: latest } = await supabase
    .from("people")
    .select("admin_created_at")
    .not("admin_created_at", "is", null)
    .order("admin_created_at", { ascending: false })
    .limit(1);
  const lastDate = latest?.[0]?.admin_created_at ? new Date(latest[0].admin_created_at) : new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() - (5 - i), 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { start, end, label: start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) };
  });

  const [people, athletes, campaignsAll, campaignsActive, brands, colleges, followerCounts, signupCounts, payoutsRes, newestRes, activeRes] =
    await Promise.all([
      head("people"),
      head("athletes"),
      head("campaign_recaps"),
      head("campaign_recaps", (q) => q.eq("admin_is_active", true)),
      head("brands", (q) => q.eq("archived", false)),
      head("colleges"),
      Promise.all(
        FOLLOWER_BUCKETS.map(([, lo, hi]) =>
          head("people", (q) => {
            let x = q.gte("instagram_followers", lo);
            if (hi != null) x = x.lt("instagram_followers", hi);
            return x;
          })
        )
      ),
      Promise.all(
        months.map((m) =>
          head("people", (q) => q.gte("admin_created_at", m.start.toISOString()).lt("admin_created_at", m.end.toISOString()))
        )
      ),
      supabase.from("payouts").select("amount_cents, status, paid_at"),
      supabase
        .from("campaign_recaps")
        .select("id, name, admin_name, admin_campaign_id, admin_is_active, created_at, brand_id, brands(id, name, logo_dark_url, logo_primary_url, logo_mark_url)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("campaign_recaps")
        .select("brand_id, admin_is_active, brands(id, name, logo_dark_url, logo_primary_url, logo_mark_url)")
        .not("brand_id", "is", null),
    ]);

  const fmt = (n: number) => n.toLocaleString("en-US");

  // Money row — the Hub's own payouts ledger. No margin figure exists
  // anywhere in the database, so that tile says so instead of guessing.
  const payouts = (payoutsRes.data ?? []) as { amount_cents: number | null; status: string | null; paid_at: string | null }[];
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const paidThisYear = payouts
    .filter((p) => p.status === "paid" && p.paid_at && new Date(p.paid_at).getTime() >= yearStart)
    .reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const pending = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  const newest = (newestRes.data ?? []) as unknown as {
    id: string;
    name: string | null;
    admin_name: string | null;
    admin_campaign_id: string | null;
    admin_is_active: boolean | null;
    created_at: string | null;
    brands: BrandLite | null;
  }[];

  const byBrand = new Map<string, { brand: BrandLite; active: number; total: number }>();
  for (const r of (activeRes.data ?? []) as unknown as { brand_id: string; admin_is_active: boolean | null; brands: BrandLite | null }[]) {
    if (!r.brands) continue;
    const cur = byBrand.get(r.brand_id) ?? { brand: r.brands, active: 0, total: 0 };
    cur.total += 1;
    if (r.admin_is_active) cur.active += 1;
    byBrand.set(r.brand_id, cur);
  }
  const topBrands = Array.from(byBrand.values())
    .sort((a, b) => b.active - a.active || b.total - a.total)
    .slice(0, 5);

  return (
    <div>
      <PageHeader title="Overview" subtitle="The big picture across athletes, campaigns and brands." />

      <Tiles
        tiles={[
          { n: fmt(people), l: "People", href: "/admin/users" },
          { n: fmt(athletes), l: "Athletes on recap rosters", href: "/admin/athletes" },
          { n: fmt(campaignsAll), l: "Campaigns, all time", href: "/admin/campaigns" },
          { n: fmt(campaignsActive), l: "Active campaigns", href: "/admin/campaigns" },
          { n: fmt(brands), l: "Accounts (brands)", href: "/admin/brands" },
          { n: fmt(colleges), l: "Colleges", href: "/admin/schools" },
        ]}
      />
      <Tiles
        tiles={[
          { n: formatMoney(paidThisYear), l: "Paid to athletes this year" },
          { n: formatMoney(pending), l: "Payouts pending", flag: pending > 0 },
          { n: "—", l: "Booked & margin (not tracked yet)" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Athletes by Instagram followers" sub="People with a follower count on file">
          <BarList rows={FOLLOWER_BUCKETS.map(([l], i) => [l, followerCounts[i]] as [string, number])} />
        </Card>
        <Card
          title="New sign-ups per month"
          sub={`From the copied ColdFusion roster, through ${lastDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
        >
          <BarList rows={months.map((m, i) => [m.label, signupCounts[i]] as [string, number])} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Newest campaigns" pad={false} actions={<Link href="/admin/campaigns" className="text-[12px] text-stone-500 hover:text-stone-800">All campaigns →</Link>}>
          <SimpleTable
            rowKey={(r) => r.id}
            rows={newest}
            cols={[
              {
                h: "Campaign",
                r: (c) => (
                  <CampCell name={c.admin_name ?? c.name ?? "Untitled"} brandName={c.brands?.name ?? null} logo={logoOf(c.brands)} href={c.admin_campaign_id && /^\d+$/.test(c.admin_campaign_id) ? `/admin/campaigns/${c.admin_campaign_id}` : undefined} />
                ),
              },
              { h: "Status", r: (c) => (c.admin_is_active ? <Pill tone="ok">Active</Pill> : <Pill>Inactive</Pill>) },
              {
                h: "Created",
                r: (c) =>
                  c.created_at ? new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
              },
            ]}
          />
        </Card>
        <Card title="Most active brands" pad={false} actions={<Link href="/admin/brands" className="text-[12px] text-stone-500 hover:text-stone-800">All brands →</Link>}>
          <SimpleTable
            rowKey={(r) => r.brand.id}
            rows={topBrands}
            cols={[
              {
                h: "Account",
                r: (a) => (
                  <Link href={`/admin/brands/${a.brand.id}`} className="flex items-center gap-2.5 font-medium text-stone-900 hover:underline">
                    <BrandMark src={logoOf(a.brand)} name={a.brand.name} />
                    {a.brand.name ?? "—"}
                  </Link>
                ),
              },
              { h: "Active", num: true, r: (a) => a.active },
              { h: "All time", num: true, r: (a) => a.total },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
