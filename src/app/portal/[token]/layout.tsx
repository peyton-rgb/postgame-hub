import { getPortalBrand, getPostgameMark, getPendingReviewCount } from "@/lib/portal-data";
import "@/components/portal/portal-mobile.css";
import { pickBrandLogo } from "@/lib/portal";
import PortalFrame from "@/components/portal/PortalFrame";

// Private frame for every /portal/[token] route. The chrome itself now
// lives in PortalFrame so the signed-in portal at /portal renders the
// identical thing — two doors, one room. This file's only job is the
// TOKEN door: resolve the brand from the token (no match -> 404) and
// hand the frame a token-shaped basePath.
//
// Unchanged for token visitors by design; retiring portal_token links is
// a later, Peyton-gated decision.

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  const [postgameMark, reviewCount] = await Promise.all([
    getPostgameMark(),
    getPendingReviewCount(brand.id),
  ]);

  return (
    <PortalFrame
      brand={brand}
      brandLogo={pickBrandLogo(brand)}
      postgameMark={postgameMark}
      basePath={`/portal/${token}`}
      reviewCount={reviewCount}
      // A token visitor is anonymous to us — no person, role or scope.
      session={null}
    >
      {children}
    </PortalFrame>
  );
}
