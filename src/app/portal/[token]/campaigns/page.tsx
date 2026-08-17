import type { Metadata } from "next";
import { getPortalBrand } from "@/lib/portal-data";
import CampaignsBody from "@/components/portal/CampaignsBody";

// Token door onto the portal's Campaigns tab. The surface itself is shared
// with the signed-in door at /portal/campaigns; this file is only the gate.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return {
    title: `${brand.name} — Campaigns`,
    description: `Campaigns for ${brand.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function CampaignsBodyRoute({ params }: Props) {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return <CampaignsBody brand={brand} basePath={`/portal/${token}`} />;
}
