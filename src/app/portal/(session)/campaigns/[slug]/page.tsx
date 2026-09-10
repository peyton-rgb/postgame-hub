import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadCampaignDetail } from "@/lib/portal/pages-data";
import CampaignDetail from "./CampaignDetail";

// Campaign detail (Phase 3b). The slug is looked up SCOPED TO THE RESOLVED
// BRAND, so a brand user cannot reach another brand's campaign by guessing a
// slug — the query carries brand_id and returns nothing otherwise.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Campaign — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview, chrome } = await resolveSessionPortal(searchParams.brand);
  const [icon, campaign] = await Promise.all([
    getPostgameIcon(),
    loadCampaignDetail(brand.id, params.slug),
  ]);

  if (!campaign) notFound();

  return (
    <PortalShell
      active="campaigns"
      postgameIcon={icon}
      preview={preview}
      brand={brand}
      accountLabel={chrome.personLabel}
      /* The campaign is named in the hero, which is its h1. The header
         carried the same words directly above it. */
      title={null}
      subtitle={
        [campaign.quarter, campaign.campaignType].filter(Boolean).join(" · ") || null
      }
    >
      <CampaignDetail campaign={campaign} initialTab={searchParams.tab} />
    </PortalShell>
  );
}
