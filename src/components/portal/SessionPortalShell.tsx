// ============================================================
// The signed-in door's shell: resolve the brand from the session, wrap
// the shared body in the shared frame.
//
// Deliberately NOT a Next layout. A layout cannot read searchParams, and
// the brand switcher lives in ?brand= — so a layout could never know
// which brand's chrome to draw. Each session route renders this instead,
// which costs a few lines per file and keeps the switcher honest.
// ============================================================

import "@/components/portal/portal-mobile.css";
import { pickBrandLogo } from "@/lib/portal";
import { getPostgameMark, getPendingReviewCount, type PortalBrand } from "@/lib/portal-data";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import PortalFrame from "@/components/portal/PortalFrame";
import { loadPostgameTeam, PostgameTeamBlock } from "@/components/PostgameTeam";

export default async function SessionPortalShell({
  searchParams,
  Body,
}: {
  searchParams: Record<string, string | undefined>;
  Body: React.ComponentType<{ brand: PortalBrand; basePath: string }>;
}) {
  const { brand, chrome } = await resolveSessionPortal(searchParams.brand);

  const [postgameMark, reviewCount, team] = await Promise.all([
    getPostgameMark(),
    getPendingReviewCount(brand.id),
    // Session-only: a token visitor is anonymous, so we cannot tell them
    // who "their" team is. A signed-in client can be told.
    loadPostgameTeam({ brandId: brand.id }),
  ]);

  return (
    <PortalFrame
      brand={brand}
      brandLogo={pickBrandLogo(brand)}
      postgameMark={postgameMark}
      basePath="/portal"
      reviewCount={reviewCount}
      session={chrome}
    >
      {/* @ts-expect-error async server component passed as a prop */}
      <Body brand={brand} basePath="/portal" />

      {/* Who to actually contact. Sits at the foot of every signed-in
          portal surface, below the numbered sections. */}
      <div className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24 pt-14 md:pt-[72px] pb-16">
        <div style={{ maxWidth: 460 }}>
          <PostgameTeamBlock tone="dark" members={team} />
        </div>
      </div>
    </PortalFrame>
  );
}
