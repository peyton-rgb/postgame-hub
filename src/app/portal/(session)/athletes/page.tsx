import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadAthleteDirectory } from "@/lib/portal/pages-data";
import AthletesGrid from "./AthletesGrid";

// Athletes directory (Phase 3b): every athlete who has appeared on any of the
// brand's campaigns, deduplicated in SQL (migration 049).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Athletes — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview, chrome } = await resolveSessionPortal(searchParams.brand);
  const [icon, data] = await Promise.all([getPostgameIcon(), loadAthleteDirectory(brand.id)]);

  return (
    <PortalShell
      active="athletes"
      postgameIcon={icon}
      preview={preview}
      brand={brand}
      accountLabel={chrome.personLabel}
      title="Athletes"
      subtitle={data.total > 0 ? `${data.total} athletes` : null}
    >
      <AthletesGrid athletes={data.athletes} schools={data.schools} sports={data.sports} />
    </PortalShell>
  );
}
