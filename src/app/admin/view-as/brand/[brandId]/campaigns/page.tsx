// ============================================================
// View as brand · Campaigns (prototype S["bp-campaigns"]).
// Every campaign with this brand, live first then newest, from the
// portal_campaigns view via the live portal's loader.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadCampaignList } from "@/lib/portal/pages-data";
import { loadPreviewBrand } from "@/lib/admin/view-as/queries";
import { CardFoot, CardTabs, Toolbar } from "@/components/admin/ops-bits";
import { PreviewHead } from "@/components/admin/view-as/bits";
import { BpCampRow } from "@/components/admin/view-as/brand";

export const dynamic = "force-dynamic";

export default async function BrandCampaignsPreview({
  params,
  searchParams,
}: {
  params: { brandId: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();
  const base = `/admin/view-as/brand/${brand.id}`;
  const tab = searchParams.tab === "live" ? "live" : searchParams.tab === "wrapped" ? "wrapped" : "all";
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const list = await loadCampaignList(brand.id);
  const rows = list.items
    .filter((c) => (tab === "live" ? c.live : tab === "wrapped" ? !c.live : true))
    .filter((c) => !q || c.name.toLowerCase().includes(q));

  const href = (t: string) => `${base}/campaigns${t === "all" ? "" : `?tab=${t}`}`;

  return (
    <div>
      <PreviewHead title="Campaigns" sub={`Everything we've made with ${brand.name}.`} />
      <section className="min-w-0 rounded-xl border border-stone-200 bg-white">
        <CardTabs
          tabs={[
            { href: href("all"), label: "All", count: list.items.length, active: tab === "all" },
            { href: href("live"), label: "In flight", count: list.liveCount, active: tab === "live" },
            { href: href("wrapped"), label: "Wrapped", count: list.wrappedCount, active: tab === "wrapped" },
          ]}
        />
        <Toolbar action={`${base}/campaigns`} placeholder="Search campaigns" q={searchParams.q} hidden={{ tab: tab === "all" ? undefined : tab }} />
        <div>
          {rows.length ? (
            rows.map((c) => <BpCampRow key={c.id} base={base} c={c} />)
          ) : (
            <div className="px-4 py-10 text-center text-[13px] text-stone-500">{q ? "No campaigns match." : "No campaigns on record yet."}</div>
          )}
        </div>
        <CardFoot>
          <span>Real campaign names, quarters and rosters for {brand.name}, from the portal&rsquo;s campaign view.</span>
          <span className="tabular-nums">{rows.length.toLocaleString("en-US")} shown</span>
        </CardFoot>
      </section>
    </div>
  );
}
