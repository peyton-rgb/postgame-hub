import type { Metadata } from "next";
import PortalShell, { TileEmpty } from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadReports } from "@/lib/portal/pages-data";
import ReportsLibrary from "./ReportsLibrary";

// Reports (Phase 3b): the recap library, grouped by quarter.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Reports — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview } = await resolveSessionPortal(searchParams.brand);
  const [icon, data] = await Promise.all([getPostgameIcon(), loadReports(brand.id)]);

  return (
    <PortalShell
      active="reports"
      postgameIcon={icon}
      preview={preview}
      title="Reports"
      subtitle={data.total > 0 ? `${data.total} wrapped campaigns` : null}
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
          <ReportsLibrary groups={data.groups} />
        )}
      </div>
    </PortalShell>
  );
}
