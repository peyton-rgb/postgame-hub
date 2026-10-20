// ============================================================
// /admin/view-as/brand/[brandId] — the brand portal, as one of the
// brand's employees sees it, rendered inside the admin shell (the
// prototype's MODE = "brand": same shell, brand-only left nav).
//
// Read-only preview. The live public /portal routes are untouched;
// the screens below reuse the portal's own loaders so this shows what
// the brand's portal reads. Nothing here writes — see the actor
// attribution note in src/lib/portal/preview.ts.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadAthleteOptions, loadBrandOptions, loadPreviewBrand, loadReviewQueue } from "@/lib/admin/view-as/queries";
import PreviewFrame from "@/components/admin/view-as/PreviewFrame";

export const dynamic = "force-dynamic";

export default async function BrandPreviewLayout({
  params,
  children,
}: {
  params: { brandId: string };
  children: React.ReactNode;
}) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();

  const [brands, athletes, queue] = await Promise.all([
    loadBrandOptions(),
    loadAthleteOptions(),
    loadReviewQueue(brand.id),
  ]);
  const waiting = queue.pieces.filter((p) => p.status === "Needs approval").length;
  const base = `/admin/view-as/brand/${brand.id}`;
  const options = brands.some((b) => b.id === brand.id) ? brands : [{ id: brand.id, label: brand.name }, ...brands];

  return (
    <PreviewFrame
      mode="brand"
      brands={options}
      athletes={athletes}
      brandId={brand.id}
      note={<>Preview of {brand.name}&rsquo;s portal. Read-only: buttons are off while you view as a brand.</>}
      nav={{
        who: brand.name,
        sub: "Brand portal · Confidential",
        logo: brand.logoOnDark,
        items: [
          { href: base, label: "Dashboard", icon: "home", exact: true },
          { href: `${base}/campaigns`, label: "Campaigns", icon: "mega" },
          { href: `${base}/review`, label: "Review & approve", icon: "checkbox", badge: waiting },
          { href: `${base}/assets`, label: "Assets", icon: "image" },
          { href: `${base}/reports`, label: "Reports", icon: "chart" },
          { href: `${base}/invoices`, label: "Invoices", icon: "receipt" },
          { href: `${base}/team`, label: "Your team", icon: "users" },
        ],
        settings: { href: `${base}/settings`, label: "Settings", icon: "cog" },
        footLine: `Viewing as ${brand.name} · Brand`,
      }}
    >
      {children}
    </PreviewFrame>
  );
}
