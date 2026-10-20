import type { Metadata } from "next";
import { getPortalBrand } from "@/lib/portal-data";
import LibraryBody from "@/components/portal/LibraryBody";

// Token door onto the portal's Assets tab. The surface itself is shared
// with the signed-in door at /portal/library; this file is only the gate.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return {
    title: `${brand.name} — Assets`,
    description: `Asset library for ${brand.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function LibraryBodyRoute({ params }: Props) {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return <LibraryBody brand={brand} basePath={`/portal/${token}`} />;
}
