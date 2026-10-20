// ============================================================
// View as brand · one campaign (prototype S["bp-campaign"]).
// Stage, athletes, deliverables, and a details panel — read from the
// live portal's campaign loader (portal_campaigns by slug).
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { compact, loadCampaignDetail } from "@/lib/portal/pages-data";
import { loadPreviewBrand } from "@/lib/admin/view-as/queries";
import { Btn, Card } from "@/components/admin/campaign/bits";
import { Avatar } from "@/components/admin/ops-bits";
import { Kv, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

const STAGES = ["Brief", "Roster", "Shoot", "Review", "Live", "Recap"];

export default async function BrandCampaignPreview({ params }: { params: { brandId: string; slug: string } }) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();
  const base = `/admin/view-as/brand/${brand.id}`;
  const c = await loadCampaignDetail(brand.id, decodeURIComponent(params.slug));
  if (!c) notFound();
  const stageOn = c.live ? "Live" : "Recap";

  return (
    <div>
      <PreviewHead
        crumb={[{ href: `${base}/campaigns`, label: "Campaigns" }]}
        title={c.name}
        sub={[c.live ? "In flight" : "Wrapped", c.quarter, c.campaignType, c.platform].filter(Boolean).join(" · ")}
        actions={
          <>
            <Btn href={`${base}/review`}>Review content</Btn>
            <Btn href={`${base}/assets`} primary>
              Download assets
            </Btn>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-3.5">
          <Card title="Stage">
            <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-[#F1F2F4] p-[3px]">
              {STAGES.map((s) => (
                <span
                  key={s}
                  aria-current={s === stageOn ? "step" : undefined}
                  className={"rounded-md px-3 py-[5px] text-[13px] font-medium " + (s === stageOn ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")}
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[12px] text-stone-500">Live or wrapped comes from the campaign; the finer steps fill in from the campaign checklist.</div>
          </Card>

          {c.figures.length > 0 && (
            <Card title="Results" sub={c.figuresSource ?? "Campaign figures"}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {c.figures.map((f) => (
                  <div key={f.label}>
                    <div className="text-2xl font-semibold tabular-nums text-stone-900">{f.value}</div>
                    <div className="text-[12px] text-stone-500">{f.label}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Athletes" sub={`${c.athleteCount.toLocaleString("en-US")} athletes · ${c.schoolCount.toLocaleString("en-US")} schools`} pad={false}>
            {c.athletes.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-[14px]">
                  <tbody>
                    {c.athletes.slice(0, 25).map((a) => (
                      <tr key={a.id} className="border-t border-stone-100 first:border-t-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {a.headshotUrl ? <img src={a.headshotUrl} alt="" className="h-[30px] w-[30px] rounded-full object-cover" /> : <Avatar name={a.name} />}
                            <div className="min-w-0">
                              <div className="truncate font-medium text-stone-900">{a.name}</div>
                              <div className="truncate text-[12px] text-stone-500">{[a.school, a.sport].filter(Boolean).join(" · ") || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[12px] tabular-nums text-stone-500">
                          {a.followers != null ? `${compact(a.followers)} followers` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[12px] tabular-nums text-stone-500">{a.views != null ? `${compact(a.views)} views` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {c.athletes.length > 25 && <div className="border-t border-stone-100 px-4 py-2.5 text-[12px] text-stone-500">+ {c.athletes.length - 25} more</div>}
              </div>
            ) : (
              <div className="px-4 py-4 text-[13px] text-stone-500">The roster shows here once athletes are selected for this campaign.</div>
            )}
          </Card>

          <Card title="Deliverables">
            <div className="text-[13px] text-stone-500">
              {c.media.length
                ? `${c.media.length.toLocaleString("en-US")} delivered files (${c.media.filter((m) => m.isVideo).length} video). Posts, reels and stories per athlete show here once deliverables are tracked per campaign.`
                : "Posts, reels and stories per athlete, with status, once the campaign type is set."}
            </div>
          </Card>
        </div>

        <aside className="min-w-0">
          <Card>
            <Kv
              rows={[
                ["Brand", brand.name],
                ["Campaign manager", c.managerName ?? "—"],
                ["Quarter", c.quarter ?? "—"],
                ["Athletes", c.athleteCount.toLocaleString("en-US")],
                ["Assets", c.media.length ? c.media.length.toLocaleString("en-US") : "—"],
              ]}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
