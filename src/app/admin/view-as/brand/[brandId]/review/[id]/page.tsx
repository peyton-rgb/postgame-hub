// ============================================================
// View as brand · one piece (prototype S["bp-review-item"], last
// definition): the review room — player on a dark stage, notes, and
// a Decision / Details side panel, with ‹ n of N › paging through the
// current tab. Read-only in preview: Approve / Request revisions are
// shown but disabled (an admin must never act as the client).
// ============================================================

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadPreviewBrand, loadReviewQueue } from "@/lib/admin/view-as/queries";
import { deliverableLabel, relDay, shortDate } from "@/lib/admin/view-as/types";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { Kv, PreviewBtn } from "@/components/admin/view-as/bits";
import { RvThumb, rvTone } from "@/components/admin/view-as/brand";

export const dynamic = "force-dynamic";

const KEY: Record<string, string> = { needs: "Needs approval", changes: "Changes requested", approved: "Approved", all: "All" };

export default async function BrandReviewItemPreview({
  params,
  searchParams,
}: {
  params: { brandId: string; id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();
  const base = `/admin/view-as/brand/${brand.id}`;
  const { pieces } = await loadReviewQueue(brand.id);
  const p = pieces.find((x) => x.id === params.id);
  if (!p) notFound();

  const tabKey = searchParams.tab && KEY[searchParams.tab] ? searchParams.tab : "needs";
  const tab = KEY[tabKey];
  const q0 = pieces.filter((x) => tab === "All" || x.status === tab);
  const q = q0.some((x) => x.id === p.id) ? q0 : pieces;
  const pos = Math.max(0, q.findIndex((x) => x.id === p.id));
  const prev = q[pos - 1];
  const next = q[pos + 1];
  const pager = (x: typeof p | undefined, label: string, glyph: string) =>
    x ? (
      <Link href={`${base}/review/${x.id}?tab=${tabKey}`} aria-label={label} className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 hover:border-stone-400">
        {glyph}
      </Link>
    ) : (
      <span aria-hidden className="rounded-md border border-stone-200 px-2.5 py-1 text-[12px] text-stone-300">
        {glyph}
      </span>
    );

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] text-stone-500">
            <Link href={`${base}/review?tab=${tabKey}`} className="hover:text-stone-900 hover:underline">
              Review &amp; approve
            </Link>{" "}
            › {p.campaign}
          </div>
          <h1 className="mt-0.5 text-xl font-semibold text-stone-900">
            {p.athleteName} <span className="font-normal text-stone-500">· {deliverableLabel(p.slot, p.slotIndex)}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={rvTone(p.status)}>{p.status}</Pill>
          {pager(prev, "Previous", "‹")}
          <span className="text-[12px] tabular-nums text-stone-500">
            {pos + 1} of {q.length}
          </span>
          {pager(next, "Next", "›")}
          <Link href={`${base}/review?tab=${tabKey}`} className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 hover:border-stone-400">
            Close
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)_300px]">
        {/* Player on the dark stage — review surfaces judge content against dark chrome */}
        <div className="rounded-2xl bg-[#17171B] p-3.5 text-[#ddd]">
          {p.fileUrl && p.isVideo ? (
            <video src={p.fileUrl} poster={p.thumbUrl ?? undefined} controls playsInline className="aspect-[9/16] max-h-[600px] w-full rounded-xl bg-black object-contain" />
          ) : p.fileUrl ? (
            <img src={p.fileUrl} alt="" className="max-h-[600px] w-full rounded-xl bg-black object-contain" />
          ) : (
            <RvThumb p={p} big />
          )}
          <div className="mt-2.5 flex items-center gap-2 text-[12px]">
            <span className="text-[#9a9aa2]">Version</span>
            <span className="rounded-full border border-white bg-white px-2.5 py-0.5 text-[#111]">Latest</span>
            <span className="flex-1" />
            {p.fileUrl && (
              <a href={p.fileUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[#3A3A40] px-2.5 py-0.5 text-[#ddd] hover:border-[#5a5a60]">
                Download
              </a>
            )}
          </div>
        </div>

        <section className="flex min-h-[420px] min-w-0 flex-col rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-[14px] font-semibold text-stone-900">Notes</h2>
            <div className="text-[12px] text-stone-500">Anything written here goes to the Postgame editor, not the athlete.</div>
          </div>
          <div className="grid flex-1 content-start gap-2.5 px-4 py-3">
            {p.note ? (
              <div className="rounded-[10px] border border-stone-200 bg-white px-3 py-2.5">
                <div className="mb-1 flex items-center gap-2 text-[12px]">
                  <span className="font-medium text-stone-900">Review note</span>
                </div>
                <p className="m-0 text-[13px] leading-relaxed text-stone-800">{p.note}</p>
              </div>
            ) : (
              <div className="py-3 text-[13px] text-stone-500">No notes yet.</div>
            )}
          </div>
          <div className="grid gap-2 border-t border-stone-200 px-4 pb-3.5 pt-3">
            <textarea disabled rows={3} placeholder="e.g. Show the product in the first 3 seconds" className="w-full cursor-not-allowed rounded-md border border-stone-300 bg-stone-50 px-2.5 py-2 text-[13px]" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-stone-500">Preview only.</span>
              <PreviewBtn>Add note</PreviewBtn>
            </div>
          </div>
        </section>

        <aside className="grid min-w-0 gap-3.5">
          <Card title="Decision">
            <div className="grid gap-2.5">
              <PreviewBtn primary full>
                Approve for posting
              </PreviewBtn>
              <PreviewBtn full>Request revisions</PreviewBtn>
              <div className="text-[12px] text-stone-500">
                Approve sends it to {p.athleteName.split(" ")[0]} with posting instructions. Revisions go to the Postgame editor with the brand&rsquo;s notes.
              </div>
            </div>
          </Card>
          <Card title="Details">
            <Kv
              rows={[
                ["Athlete", [p.athleteName, p.school].filter(Boolean).join(" · ")],
                ["Handle", p.igHandle ?? "—"],
                ["Deliverable", deliverableLabel(p.slot, p.slotIndex)],
                ["Sent", relDay(p.sentAt)],
                ["Approved", p.approvedAt ? shortDate(p.approvedAt) : "—"],
              ]}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
