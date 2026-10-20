// ============================================================
// View as brand · Assets (prototype S["bp-assets"]): delivered photos
// and video grouped by campaign. Media come from the live portal's
// content-gallery loader (media.campaign_id on this brand's campaigns).
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadContentGallery } from "@/lib/portal/pages-data";
import { loadPreviewBrand } from "@/lib/admin/view-as/queries";
import { CardFoot, Toolbar } from "@/components/admin/ops-bits";
import { PreviewBtn, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

const PER_GROUP = 12;

export default async function BrandAssetsPreview({
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
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const kind = searchParams.kind === "video" ? "video" : searchParams.kind === "image" ? "image" : "all";

  const gallery = await loadContentGallery(brand.id);
  const items = gallery.items
    .filter((m) => (kind === "video" ? m.isVideo : kind === "image" ? !m.isVideo : true))
    .filter((m) => !q || m.haystack.includes(q));
  const groups = new Map<string, typeof items>();
  for (const m of items) {
    const k = m.campaignName ?? "Other";
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }

  return (
    <div>
      <PreviewHead
        title="Assets"
        sub={`${gallery.items.length.toLocaleString("en-US")} delivered files, grouped by campaign.`}
        actions={<PreviewBtn primary>Download all</PreviewBtn>}
      />
      <section className="min-w-0 rounded-xl border border-stone-200 bg-white">
        <Toolbar
          action={`${base}/assets`}
          placeholder="Search athletes, schools, campaigns"
          q={searchParams.q}
          selects={[
            {
              name: "kind",
              label: "Type",
              value: kind,
              options: [
                { value: "all", label: "Everything" },
                { value: "image", label: "Photos" },
                { value: "video", label: "Video" },
              ],
            },
          ]}
        />
        <div className="px-4 py-4">
          {items.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-stone-500">
              {gallery.items.length ? "No files match." : "Assets appear here as each campaign's finals are delivered."}
            </div>
          ) : (
            Array.from(groups.entries()).map(([camp, list]) => (
              <div key={camp} className="mb-5 last:mb-0">
                <div className="mb-2 text-[14px] font-medium text-stone-900">
                  {camp} <span className="font-normal text-stone-500">· {list.length.toLocaleString("en-US")} files</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                  {list.slice(0, PER_GROUP).map((m) => (
                    <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-stone-200" title={[m.athleteName, m.school].filter(Boolean).join(" · ")}>
                      {m.isVideo && !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(m.thumbUrl) ? (
                        <span className="grid h-full w-full place-items-center bg-[#17171B] text-[14px] text-white">▶</span>
                      ) : (
                        <img src={m.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                      {m.isVideo && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-1.5 text-[10px] font-semibold text-white">Video</span>}
                    </a>
                  ))}
                </div>
                {list.length > PER_GROUP && <div className="mt-1.5 text-[12px] text-stone-500">+ {(list.length - PER_GROUP).toLocaleString("en-US")} more</div>}
              </div>
            ))
          )}
        </div>
        <CardFoot>
          <span>Real files from the media library for {brand.name}&rsquo;s campaigns.</span>
          <span className="tabular-nums">{items.length.toLocaleString("en-US")} shown</span>
        </CardFoot>
      </section>
    </div>
  );
}
