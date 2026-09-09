import type { Metadata } from "next";
import BrandDashboard from "@/components/portal/dashboard/BrandDashboard";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { loadBrandDashboard } from "@/lib/portal/dashboard-data";
import { getPostgameIcon } from "@/lib/portal-data";

// SIGNED-IN door onto the brand dashboard (/portal).
//
// Phase 3a replaced the body here. It no longer renders PortalDashboardBody
// through SessionPortalShell, because the reference design carries its own
// 72px icon rail and pill nav and PortalFrame's utility strip plus sticky
// lockup header would stack a second navigation on top of it.
//
// WHAT DID NOT CHANGE, deliberately:
//   · resolveSessionPortal() still owns brand resolution, the entitlement
//     decision and the admin preview — every gate from Phase 1 is intact.
//   · SessionPortalShell is untouched and still serves /portal/campaigns,
//     /portal/library, /portal/review and /portal/reports.
//   · PortalDashboardBody is untouched. The PUBLIC token door at
//     /portal/[token] renders it, so it is live client-facing code and
//     nothing here goes near it.
//
// (session) is a route group, so it does not appear in the URL and does NOT
// wrap /portal/[token], /portal/signup or /portal/denied.

export const dynamic = "force-dynamic";
// Access-deciding reads must never be answered from Next's Data Cache.
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Brand Portal — Postgame",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  // Redirects on its own for every case that is not an entitled viewer:
  // anonymous -> /login, athlete -> /athlete, brand with no reach ->
  // /portal/denied, admin with no brand chosen -> /portal/choose.
  const { brand, preview } = await resolveSessionPortal(searchParams.brand);

  const [postgameIcon, data] = await Promise.all([
    getPostgameIcon(),
    loadBrandDashboard(brand.id),
  ]);

  return (
    <BrandDashboard brand={brand} postgameIcon={postgameIcon} data={data} preview={preview} />
  );
}
