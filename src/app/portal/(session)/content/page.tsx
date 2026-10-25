import type { Metadata } from "next";
import PortalShell, { TileEmpty } from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadContentGallery } from "@/lib/portal/pages-data";
import MediaGrid from "@/components/portal/pages/MediaGrid";

// Content gallery (Phase 3b): all of the brand's media across campaigns,
// newest first. Lives at /portal/content; the older /portal/library route is
// left in place but is no longer linked from the rail.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Content — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview, chrome } = await resolveSessionPortal(searchParams.brand);
  const [icon, data] = await Promise.all([getPostgameIcon(), loadContentGallery(brand.id)]);

  return (
    <PortalShell
      active="content"
      postgameIcon={icon}
      preview={preview}
      brand={brand}
      accountLabel={chrome.personLabel}
      title="Content"
      subtitle={data.items.length > 0 ? `${data.items.length} files` : null}
    >
      <div className="pgd-page">
        {data.items.length === 0 ? (
          <div className="pgd-panel">
            <TileEmpty
              line="No content yet"
              note="Photos and video land here as campaigns deliver."
            />
          </div>
        ) : (
          <MediaGrid
            items={data.items}
            showCampaign
            campaigns={data.campaigns}
            athletes={data.athletes}
            schools={data.schools}
          />
        )}
      </div>
    </PortalShell>
  );
}
