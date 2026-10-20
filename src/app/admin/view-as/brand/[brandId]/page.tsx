// ============================================================
// View as brand · Dashboard (prototype S["bp-dashboard"]).
// Welcome line, four tiles, In flight + Waiting on you, Your Postgame
// team. Numbers come from the live portal's loaders (portal_* views);
// anything not connected shows "—" and says so.
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadCampaignList, loadReportsMetrics } from "@/lib/portal/pages-data";
import { loadBrandDashboard } from "@/lib/portal/dashboard-data";
import { loadBrandManagers, loadPreviewBrand, loadReviewQueue } from "@/lib/admin/view-as/queries";
import { Tiles } from "@/components/admin/ops-bits";
import { Btn, Card } from "@/components/admin/campaign/bits";
import { Foot, PreviewHead } from "@/components/admin/view-as/bits";
import { BpCampRow } from "@/components/admin/view-as/brand";

export const dynamic = "force-dynamic";

export default async function BrandDashboardPreview({ params }: { params: { brandId: string } }) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();
  const base = `/admin/view-as/brand/${brand.id}`;

  const [list, dash, reports, queue, managers] = await Promise.all([
    loadCampaignList(brand.id),
    loadBrandDashboard(brand.id),
    loadReportsMetrics(brand.id).catch(() => null),
    loadReviewQueue(brand.id),
    loadBrandManagers(brand.id),
  ]);
  const live = list.items.filter((c) => c.live);
  const latest = list.items.slice().sort((a, b) => (b.quarter ?? "").localeCompare(a.quarter ?? ""))[0];
  const athletes = dash.kpis.find((k) => k.label === "Athletes");
  const reach = reports?.kpis[0];
  const toApprove = queue.pieces.filter((p) => p.status === "Needs approval").length;

  return (
    <div>
      <PreviewHead
        title={`Welcome back, ${brand.name}`}
        sub={`${list.items.length.toLocaleString("en-US")} campaigns together · ${live.length} in flight${latest ? ` · latest ${latest.name}` : ""}.`}
      />
      <Tiles
        tiles={[
          { n: list.items.length.toLocaleString("en-US"), l: "Campaigns", href: `${base}/campaigns` },
          { n: String(live.length), l: "In flight" },
          { n: athletes?.value ?? "—", l: athletes ? `Athletes · ${athletes.sub ?? ""}`.replace(/ · $/, "") : "Athletes" },
          { n: reach?.value ?? "—", l: reach ? reach.label : "Reach · awaiting verified data", href: `${base}/reports` },
        ]}
      />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card title="In flight" sub="Where each campaign is; click one to open it." actions={<Btn href={`${base}/campaigns`} small>All campaigns</Btn>} pad={false}>
          {live.length ? (
            live.map((c) => <BpCampRow key={c.id} base={base} c={c} />)
          ) : (
            <div className="px-4 py-6 text-[13px] text-stone-500">Nothing in flight right now.</div>
          )}
        </Card>

        <Card title="Waiting on you" sub="Open items from your Postgame team." pad={false}>
          {[
            { t: "Content to approve", d: "Review & approve", v: String(toApprove), href: `${base}/review` },
            { t: "Invoices due", d: "Invoices", v: "—", href: `${base}/invoices` },
          ].map((w) => (
            <Link key={w.t} href={w.href} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 border-t border-stone-100 px-4 py-2.5 first:border-t-0 hover:bg-[#FAFAFB]">
              <span className="text-[14px] font-medium text-stone-900">{w.t}</span>
              <span className="row-span-2 text-2xl font-semibold tabular-nums text-stone-900">{w.v}</span>
              <span className="text-[12px] text-stone-500">{w.d}</span>
            </Link>
          ))}
          <Foot>Content counts come from deliverables your team has sent for approval. Invoices aren&rsquo;t connected to the portal yet.</Foot>
        </Card>
      </div>

      <div className="mt-3.5">
        <Card title="Your Postgame team">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(managers.length ? managers.slice(0, 3) : [null]).map((m, i) => (
              <div key={m?.name ?? i} className="min-w-0">
                <div className="text-[12px] text-stone-500">{m?.live ? "Campaign manager · in flight" : "Campaign manager"}</div>
                <div className="truncate text-[14px] font-medium text-stone-900">{m ? m.name : "Being assigned"}</div>
                {m?.email && <div className="truncate text-[12px] text-stone-500">{m.email}</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
