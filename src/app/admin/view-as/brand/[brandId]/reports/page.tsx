// ============================================================
// View as brand · Reports (prototype S["bp-reports"]): four headline
// tiles, By quarter, Top posts. Figures come from the portal's report
// views (portal_brand_report_periods / _quarters / portal_top_posts)
// through the live portal's loader; a brand with no tracked posts
// shows "—" and says so.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { compact, loadReportsMetrics } from "@/lib/portal/pages-data";
import { loadPreviewBrand } from "@/lib/admin/view-as/queries";
import { Tiles } from "@/components/admin/ops-bits";
import { Card } from "@/components/admin/campaign/bits";
import { Avatar } from "@/components/admin/ops-bits";
import { PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

export default async function BrandReportsPreview({ params }: { params: { brandId: string } }) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();

  const m = await loadReportsMetrics(brand.id).catch(() => null);
  const kpis = m?.kpis ?? [];
  const hasData = kpis.length > 0 && kpis.some((k) => k.value && k.value !== "0" && k.value !== "—");
  const maxQ = Math.max(1, ...(m?.quarters ?? []).map((q) => q.reelViews));

  return (
    <div>
      <PreviewHead
        title="Reports"
        sub={hasData ? `Verified performance across your campaigns · ${m!.periodLabel}.` : "Performance across your campaigns, from verified post data."}
      />
      <Tiles
        tiles={
          hasData
            ? kpis.slice(0, 5).map((k) => ({ n: k.value, l: k.sub ? `${k.label} · ${k.sub}` : k.label }))
            : ["Reel views", "Feed impressions", "TikTok views", "Combined audience"].map((l) => ({ n: "—", l }))
        }
      />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card title="By quarter" sub={m?.bestQuarter ? `Best quarter: ${m.bestQuarter.label}` : undefined}>
          {m && m.quarters.length ? (
            <div className="grid gap-2">
              {m.quarters.slice(-6).map((q) => (
                <div key={q.label} className="grid grid-cols-[70px_minmax(0,1fr)_80px] items-center gap-2.5 text-[13px]">
                  <span className="text-stone-500">{q.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <span className="block h-full rounded-full bg-stone-800" style={{ width: `${Math.round((q.reelViews / maxQ) * 100)}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-stone-900">{compact(q.reelViews)}</span>
                </div>
              ))}
              <div className="text-[12px] text-stone-500">Reel views per quarter.</div>
            </div>
          ) : (
            <div className="text-[13px] text-stone-500">Fills in once posts are tracked.</div>
          )}
        </Card>
        <Card title="Top posts" pad={false}>
          {m && m.topAthletes.length ? (
            m.topAthletes.slice(0, 8).map((a) => (
              <div key={a.athleteId + (a.postUrl ?? "")} className="flex items-center gap-2.5 border-t border-stone-100 px-4 py-2.5 text-[13px] first:border-t-0">
                <Avatar name={a.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-stone-900">{a.name}</div>
                  <div className="truncate text-[12px] text-stone-500">{[a.school, a.campaignName].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="shrink-0 tabular-nums text-stone-900">{compact(a.views)}</span>
                {a.postUrl && (
                  <a href={a.postUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] font-medium text-[#D73F09] hover:underline">
                    Open
                  </a>
                )}
              </div>
            ))
          ) : (
            <div className="px-4 py-4 text-[13px] text-stone-500">Fills in once posts are tracked.</div>
          )}
        </Card>
      </div>
      <div className="px-1 pt-3 text-[12px] text-stone-500">
        {hasData ? "Numbers come from the portal reporting views." : "Awaiting verified data: this brand's posts aren't tracked yet."}
      </div>
    </div>
  );
}
