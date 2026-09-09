import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadSettings } from "@/lib/portal/pages-data";
import SettingsPanels from "./SettingsPanels";

// Settings (Phase 3b). Read-only this phase: team, logo, and three
// notification toggles rendered disabled. Sign out posts to the existing
// route rather than reimplementing sign-out. The body lives in
// SettingsPanels so the render harness cannot drift from it.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Settings — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview } = await resolveSessionPortal(searchParams.brand);
  const [icon, data] = await Promise.all([getPostgameIcon(), loadSettings(brand.id)]);

  return (
    <PortalShell
      active="settings"
      postgameIcon={icon}
      preview={preview}
      title="Settings"
      subtitle="Read-only for now"
    >
      <SettingsPanels data={data} />
    </PortalShell>
  );
}
