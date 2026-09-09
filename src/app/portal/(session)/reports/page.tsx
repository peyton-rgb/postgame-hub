import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadReportsMetrics } from "@/lib/portal/pages-data";
import ReportsDashboard from "./ReportsDashboard";

// Reports: the metrics dashboard across every wrapped campaign.
//
// The recap-card library that used to live here is now /portal/recaps. Two
// different things were sharing one name — the shelf of recaps to open, and
// the numbers across them.
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
  const [icon, data] = await Promise.all([getPostgameIcon(), loadReportsMetrics(brand.id)]);

  return (
    <PortalShell
      active="reports"
      postgameIcon={icon}
      preview={preview}
      title="Reports"
      subtitle={
        data.rows.length > 0
          ? `${data.rows.length} wrapped ${data.rows.length === 1 ? "campaign" : "campaigns"}`
          : null
      }
    >
      <ReportsDashboard data={data} />
    </PortalShell>
  );
}
