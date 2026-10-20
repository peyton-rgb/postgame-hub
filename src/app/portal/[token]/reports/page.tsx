import type { Metadata } from "next";
import { getPortalBrand } from "@/lib/portal-data";
import ReportsBody from "@/components/portal/ReportsBody";

// Token door onto the portal's Reports tab. The surface itself is shared
// with the signed-in door at /portal/reports; this file is only the gate.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return {
    title: `${brand.name} — Reports`,
    description: `Campaign reporting for ${brand.name}`,
    robots: { index: false, follow: false },
  };
}

const PANELS: { title: string; sub: string; span: string }[] = [
  { title: "Total impressions", sub: "All campaigns", span: "lg:col-span-3" },
  { title: "Engagement rate", sub: "Weighted average", span: "lg:col-span-3" },
  { title: "Total posts", sub: "Feed and reel", span: "lg:col-span-3" },
  { title: "Total reach", sub: "Unique accounts", span: "lg:col-span-3" },
  { title: "Impressions by month", sub: "Trailing twelve months", span: "lg:col-span-7" },
  { title: "Split by content type", sub: "Photo vs video", span: "lg:col-span-5" },
  { title: "Top performing posts", sub: "Ranked by engagement", span: "lg:col-span-12" },
];

export default async function ReportsBodyRoute({ params }: Props) {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return <ReportsBody brand={brand} basePath={`/portal/${token}`} />;
}
