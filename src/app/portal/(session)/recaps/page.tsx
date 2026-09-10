import type { Metadata } from "next";
import PortalShell, { TileEmpty } from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadReports } from "@/lib/portal/pages-data";
import RecapLibrary from "./RecapLibrary";

// Recaps: the recap-card library, grouped by quarter.
//
// This page WAS /portal/reports through 3b. It moved because the two things
// were sharing one name: a shelf of delivered recaps to open, and the numbers
// across them. /portal/reports is now the numbers, and this is the shelf.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Recaps — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview, chrome } = await resolveSessionPortal(searchParams.brand);
  const [icon, data] = await Promise.all([getPostgameIcon(), loadReports(brand.id)]);

  return (
    <PortalShell
      active="recaps"
      postgameIcon={icon}
      preview={preview}
      brand={brand}
      accountLabel={chrome.personLabel}
      title="Recaps"
      subtitle={data.total > 0 ? `${data.total} delivered` : null}
    >
      <div className="pgd-page">
        {data.total === 0 ? (
          <div className="pgd-panel">
            <TileEmpty
              line="No recaps yet"
              note="Wrapped campaigns and their recaps will be listed here."
            />
          </div>
        ) : (
          <RecapLibrary groups={data.groups} />
        )}
      </div>
    </PortalShell>
  );
}
