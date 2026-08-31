// ============================================================
// /admin/brand-mapping — the human queue for account → brand.
//
// Campaigns synced from the admin arrive with an account id and no brand.
// Exact name matches are linked automatically (lib/account-brand-map.ts); the
// leftovers land here, because they are exactly the cases a machine must not
// guess: "Cane's" vs "Raising Cane's", "Hey Dude" vs "Heydude", "McDonalds"
// vs "McDonald's".
//
// PLACEMENT: the brief suggested /dashboard/settings/brand-mapping, but there
// is no dashboard/settings tree — creating one would be a new pattern for a
// single utility table. This lives in /admin instead, which already holds the
// staff-only registries (brands, campaigns, access) and supplies the auth gate
// and the UI kit. Noted in the PR.
//
// A utility, not a design surface: one table, existing components, no new
// patterns. It never creates a brand — the dropdown only offers what exists.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { EmptyRows, PageHeader, StatTile } from "@/components/admin/ui";
import { linkAccountToBrand } from "./actions";

export const dynamic = "force-dynamic";

interface MapRow {
  admin_account_id: string;
  account_name: string | null;
  brand_id: string | null;
  mapped_by: string | null;
}

export default async function BrandMappingPage() {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const [{ data: mapData }, { data: brandData }, { data: campaignData }] = await Promise.all([
    supabase
      .from("admin_account_map")
      .select("admin_account_id, account_name, brand_id, mapped_by")
      .order("account_name"),
    supabase.from("brands").select("id, name").order("name"),
    // Campaign counts per account, so the queue can be worked highest-impact
    // first. Only rows still missing a brand are counted — that is what linking
    // this account would actually fix.
    supabase.from("campaign_recaps").select("admin_account_id").is("brand_id", null),
  ]);

  const rows = (mapData ?? []) as MapRow[];
  const brands = (brandData ?? []) as Array<{ id: string; name: string }>;

  const unmappedCampaigns = new Map<string, number>();
  for (const c of (campaignData ?? []) as Array<{ admin_account_id: string | null }>) {
    if (!c.admin_account_id) continue;
    unmappedCampaigns.set(c.admin_account_id, (unmappedCampaigns.get(c.admin_account_id) ?? 0) + 1);
  }

  const unmapped = rows.filter((r) => !r.brand_id);
  const mapped = rows.filter((r) => r.brand_id);
  const autoCount = mapped.filter((r) => r.mapped_by === "auto_exact").length;
  const humanCount = mapped.filter((r) => r.mapped_by === "human").length;

  // Worst first: an account blocking ten campaigns is worth more attention
  // than one blocking none.
  const queue = [...unmapped].sort(
    (a, b) =>
      (unmappedCampaigns.get(b.admin_account_id) ?? 0) - (unmappedCampaigns.get(a.admin_account_id) ?? 0) ||
      (a.account_name ?? "").localeCompare(b.account_name ?? ""),
  );

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Brand mapping"
        subtitle="Link the admin's accounts to Hub brands. Exact name matches link themselves; these are the ones that need a person."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Accounts known" value={String(rows.length)} />
        <StatTile label="Needs a human" value={String(unmapped.length)} />
        <StatTile label="Auto-linked" value={String(autoCount)} />
        <StatTile label="Linked by hand" value={String(humanCount)} />
      </div>

      <h2 className="pb-2 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
        Unmapped accounts
      </h2>
      <div className="rounded-lg border border-stone-200 bg-white">
        {queue.length === 0 ? (
          <EmptyRows label="Every account the admin knows about is mapped to a brand." />
        ) : (
          <div className="divide-y divide-stone-200">
            {queue.map((row) => {
              const blocked = unmappedCampaigns.get(row.admin_account_id) ?? 0;
              return (
                <form
                  key={row.admin_account_id}
                  action={linkAccountToBrand}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <input type="hidden" name="admin_account_id" value={row.admin_account_id} />
                  <div className="min-w-[200px] flex-1">
                    <div className="text-[13.5px] font-medium text-stone-900">
                      {row.account_name || <span className="text-stone-400">(no name)</span>}
                    </div>
                    <div className="text-[12px] text-stone-500">
                      account {row.admin_account_id}
                      {blocked > 0 && (
                        <>
                          {" · "}
                          <span className="font-medium text-stone-700">
                            {blocked} campaign{blocked === 1 ? "" : "s"} waiting
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <select
                    name="brand_id"
                    required
                    defaultValue=""
                    className="min-w-[220px] rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-900"
                  >
                    <option value="" disabled>
                      Choose a brand…
                    </option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-md bg-stone-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-stone-700"
                  >
                    Link
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-4 text-[12.5px] text-stone-500">
        No brand here? Create it in{" "}
        <a href="/admin/brands" className="underline">
          Brands
        </a>{" "}
        first — this page never creates one.
      </p>
    </div>
  );
}
