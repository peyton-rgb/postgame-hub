import type { Metadata } from "next";
import { getPortalBrand } from "@/lib/portal-data";
import PortalDashboardBody from "@/components/portal/PortalDashboardBody";

// Token door onto the brand portal dashboard. The dashboard itself lives
// in PortalDashboardBody, shared with the signed-in door at /portal.
// This file's only job is the gate: token -> brand, or 404.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return {
    title: `${brand.name} — Brand Portal`,
    description: `Everything we've made with ${brand.name}`,
    // Private surface — keep it out of search indexes.
    robots: { index: false, follow: false },
  };
}

export default async function BrandPortalDashboard({ params }: Props) {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return <PortalDashboardBody brand={brand} basePath={`/portal/${token}`} />;
}
