// ============================================================
// View as brand · Review & approve (prototype S["bp-review"], last
// definition): a visual queue grouped by campaign with status tabs.
// Pieces are athlete_deliverables the Postgame team has sent to the
// brand (sent_to_brand_at set) on this brand's optin_campaigns.
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadPreviewBrand, loadReviewQueue } from "@/lib/admin/view-as/queries";
import { deliverableLabel, relDay, type ReviewStatus } from "@/lib/admin/view-as/types";
import { CardFoot, CardTabs, Toolbar } from "@/components/admin/ops-bits";
import { ErrorNote } from "@/components/admin/ui";
import { Pill } from "@/components/admin/campaign/bits";
import { PreviewHead } from "@/components/admin/view-as/bits";
import { RvThumb, rvTone } from "@/components/admin/view-as/brand";

export const dynamic = "force-dynamic";

const TABS: (ReviewStatus | "All")[] = ["Needs approval", "Changes requested", "Approved", "All"];
const KEY: Record<string, ReviewStatus | "All"> = { needs: "Needs approval", changes: "Changes requested", approved: "Approved", all: "All" };
const KEY_OF = (t: ReviewStatus | "All") => Object.keys(KEY).find((k) => KEY[k] === t)!;

export default async function BrandReviewPreview({
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
  const tab = KEY[searchParams.tab ?? "needs"] ?? "Needs approval";
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const { pieces, error } = await loadReviewQueue(brand.id);
  const count = (t: ReviewStatus | "All") => pieces.filter((p) => t === "All" || p.status === t).length;
  const shown = pieces
    .filter((p) => tab === "All" || p.status === tab)
    .filter((p) => !q || p.athleteName.toLowerCase().includes(q) || (p.igHandle ?? "").toLowerCase().includes(q));
  const groups = new Map<string, typeof shown>();
  for (const p of shown) groups.set(p.campaign, [...(groups.get(p.campaign) ?? []), p]);

  return (
    <div>
      <PreviewHead
        title="Review & approve"
        sub="Content your Postgame team has sent for your OK. Open a piece to watch it, leave notes, and approve it for posting."
        actions={<span className="text-[12px] text-stone-500">{count("Needs approval")} waiting</span>}
      />
      {error && <ErrorNote message={`Could not load the review queue: ${error}`} />}
      <section className="min-w-0 rounded-xl border border-stone-200 bg-white">
        <CardTabs tabs={TABS.map((t) => ({ href: `${base}/review?tab=${KEY_OF(t)}`, label: t, count: count(t), active: tab === t }))} />
        <Toolbar action={`${base}/review`} placeholder="Search athletes" q={searchParams.q} hidden={{ tab: KEY_OF(tab) }} />
        <div className="px-4 py-4">
          {shown.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-stone-500">
              {pieces.length === 0 ? "Nothing has been sent to this brand for approval yet." : "Nothing here right now."}
            </div>
          ) : (
            Array.from(groups.entries()).map(([camp, list]) => (
              <div key={camp} className="mb-5 last:mb-0">
                <div className="mb-2.5 flex justify-between text-[13px]">
                  <span className="font-medium text-stone-900">{camp}</span>
                  <span className="text-stone-500">
                    {list.length} piece{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5">
                  {list.map((p) => (
                    <Link
                      key={p.id}
                      href={`${base}/review/${p.id}?tab=${KEY_OF(tab)}`}
                      className="relative block overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:-translate-y-px hover:shadow-md"
                    >
                      <RvThumb p={p} />
                      <div className="grid gap-0.5 px-3 pb-3 pt-2.5 text-[13px]">
                        <div className="flex justify-between gap-1.5 font-medium text-stone-900">
                          <span className="truncate">{p.athleteName}</span>
                          <Pill tone={rvTone(p.status)}>{p.status === "Needs approval" ? "New" : p.status}</Pill>
                        </div>
                        <div className="truncate text-[12px] text-stone-500">
                          {deliverableLabel(p.slot, p.slotIndex)}
                          {p.igHandle ? ` · ${p.igHandle}` : ""}
                        </div>
                        <div className="text-[12px] text-stone-500">Sent {relDay(p.sentAt)}</div>
                      </div>
                      <span className="absolute right-2 top-2 rounded-md border border-stone-300 bg-white px-2 py-0.5 text-[12px] font-medium text-stone-700">View</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <CardFoot>
          <span>Pieces appear here when the Postgame team sends a deliverable to the brand. Approved pieces go to the athlete with posting instructions.</span>
        </CardFoot>
      </section>
    </div>
  );
}
