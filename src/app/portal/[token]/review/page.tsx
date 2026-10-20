import type { Metadata } from "next";
import { getPortalBrand } from "@/lib/portal-data";
import ReviewBody from "@/components/portal/ReviewBody";

// Token door onto the portal's Review tab. The surface itself is shared
// with the signed-in door at /portal/review; this file is only the gate.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return {
    title: `${brand.name} — Review`,
    description: `Asset review for ${brand.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function ReviewBodyRoute({ params }: Props) {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return <ReviewBody brand={brand} basePath={`/portal/${token}`} />;
}
