// ============================================================
// /admin/content/media — Media library.
// Matches prototype S.media: search (athlete, school, sport, brand)
// plus brand / campaign / type filters over a thumbnail grid.
// Source: media (ownership columns media.campaign_id / athlete_id —
// not the media_campaigns curation table), labelled from athletes and
// campaign_recaps. 48 per page.
//
// Not built yet: the prototype's "stage" filter (01 Submitted / 02
// Edits / 03 Final) and "Run tag backfill" — media rows carry no stage
// or tags today; those arrive with the LucidLink library. The Hub's
// per-campaign media manager stays at /media-library.
// ============================================================

/* eslint-disable @next/next/no-img-element */

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { sanitizeFilterValue } from "@/lib/admin/db";
import { MEDIA_PAGE, loadMedia } from "@/lib/admin/content/queries";
import { EmptyRows, ErrorNote, PageHeader, Paginator } from "@/components/admin/ui";
import { Toolbar } from "@/components/admin/ops-bits";
import { BtnLink, Card, TableWrap, Td, Th } from "@/components/admin/content/bits";
import { cookies } from "next/headers";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView, listViewCookie, type ListView } from "@/lib/admin/list-view";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** This list was a grid before the Rows / Cards toggle: keep Cards as its default until someone picks. */
function viewDefaultCards(listKey: string, sp: Record<string, string | undefined>): ListView {
  if (sp.view === "rows" || sp.view === "cards") return sp.view;
  let saved: string | undefined;
  try {
    saved = cookies().get(listViewCookie(listKey))?.value;
  } catch {
    /* outside a request */
  }
  return saved === "rows" || saved === "cards" ? getListView(listKey, sp) : "cards";
}

/** Supabase Storage public URLs get the resize endpoint; anything else is used as-is. */
function thumbUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.includes("/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=360&quality=60";
  }
  return url;
}

export default async function MediaPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const brand = UUID.test(searchParams.brand ?? "") ? searchParams.brand : undefined;
  const campaign = UUID.test(searchParams.campaign ?? "") ? searchParams.campaign : undefined;
  const type = searchParams.type === "image" || searchParams.type === "video" ? searchParams.type : undefined;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const view = viewDefaultCards("content-media", searchParams);

  const res = await loadMedia(createServiceSupabase(), { q, brand, campaign, type, page });

  return (
    <div>
      <PageHeader
        title="Media library"
        subtitle="Every photo and video attached to a campaign."
        actions={<BtnLink href="/media-library">Manage by campaign</BtnLink>}
      />
      {res.error && (
        <div className="mb-4">
          <ErrorNote message={res.error} />
        </div>
      )}
      <Card>
        <Toolbar
          action="/admin/content/media"
          placeholder="Search athlete, school, sport, brand or campaign"
          q={q}
          selects={[
            {
              name: "brand",
              label: "Brand",
              value: brand ?? "",
              options: [{ value: "", label: "All brands" }, ...res.brands.map((b) => ({ value: b.id, label: b.name }))],
            },
            {
              name: "campaign",
              label: "Campaign",
              value: campaign ?? "",
              options: [{ value: "", label: "All campaigns" }, ...res.campaigns.map((c) => ({ value: c.id, label: c.name }))],
            },
            {
              name: "type",
              label: "Type",
              value: type ?? "",
              options: [
                { value: "", label: "Photos and videos" },
                { value: "image", label: "Photos" },
                { value: "video", label: "Videos" },
              ],
            },
          ]}
          hidden={{ view: searchParams.view }}
          right={<ViewToggle listKey="content-media" view={view} />}
        />
        {res.tiles.length === 0 ? (
          <EmptyRows label="No media matches these filters." />
        ) : view === "rows" ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Media</Th>
                <Th>Athlete</Th>
                <Th>Campaign</Th>
                <Th>Type</Th>
                <Th>Added</Th>
              </tr>
            </thead>
            <tbody>
              {res.tiles.map((t) => {
                const src = thumbUrl(t.thumb);
                return (
                  <tr key={t.id} className="hover:bg-stone-50/60">
                    <Td className="w-[72px] py-2">
                      <a href={t.fileUrl} target="_blank" rel="noreferrer" className="block h-[56px] w-[45px] overflow-hidden rounded-md bg-stone-800" title="Open file">
                        {src ? (
                          <img src={src} alt={t.athleteName ?? ""} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full place-items-center text-[11px] text-white/70">▶</span>
                        )}
                      </a>
                    </Td>
                    <Td>
                      <div className="truncate font-medium text-stone-900">{t.athleteName ?? "No athlete tagged"}</div>
                      {t.school && <div className="truncate text-[12px] text-stone-500">{t.school}</div>}
                    </Td>
                    <Td>
                      <div className="max-w-[260px] truncate text-stone-900">{t.campaignName ?? "—"}</div>
                      {t.brandName && <div className="truncate text-[12px] text-stone-500">{t.brandName}</div>}
                    </Td>
                    <Td className="text-stone-700">{t.type === "video" ? "Video" : "Photo"}</Td>
                    <Td className="whitespace-nowrap text-stone-700">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {res.tiles.map((t) => {
              const src = thumbUrl(t.thumb);
              return (
                <a key={t.id} href={t.fileUrl} target="_blank" rel="noreferrer" className="group block min-w-0">
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-stone-800">
                    {src ? (
                      <img src={src} alt={t.athleteName ?? ""} loading="lazy" className="h-full w-full object-cover transition group-hover:opacity-90" />
                    ) : (
                      <span className="grid h-full place-items-center text-[12px] text-white/70">▶ Video</span>
                    )}
                    {t.type === "video" && src && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] font-medium text-white">Video</span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-[12px] font-medium text-stone-900">{t.athleteName ?? "No athlete tagged"}</span>
                  <span className="block truncate text-[11px] text-stone-500">
                    {[t.brandName, t.campaignName].filter(Boolean).join(" · ") || "—"}
                  </span>
                </a>
              );
            })}
          </div>
        )}
        <div className="border-t border-stone-200 px-3">
          <Paginator
            page={page}
            total={res.total}
            pageSize={MEDIA_PAGE}
            basePath="/admin/content/media"
            params={{ q: q || undefined, brand, campaign, type, view: searchParams.view }}
          />
        </div>
      </Card>
    </div>
  );
}
