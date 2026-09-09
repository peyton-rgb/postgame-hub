import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadCampaignList } from "@/lib/portal/pages-data";
import CampaignsGrid from "./CampaignsGrid";

// Campaigns list (Phase 3b). Replaces the SessionPortalShell body that used to
// render here, so it shares the dashboard's rail and toolbar.
//
// Gating is unchanged: resolveSessionPortal() still decides who may see this
// and which brand they get.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Campaigns — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview } = await resolveSessionPortal(searchParams.brand);
  const [icon, data] = await Promise.all([getPostgameIcon(), loadCampaignList(brand.id)]);

  return (
    <PortalShell
      active="campaigns"
      postgameIcon={icon}
      preview={preview}
      title="Campaigns"
      subtitle={`${data.liveCount} live · ${data.wrappedCount} wrapped`}
    >
      <CampaignsGrid items={data.items} quarters={data.quarters} />
    </PortalShell>
  );
}
