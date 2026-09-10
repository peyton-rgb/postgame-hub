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
  const { brand, preview, chrome } = await resolveSessionPortal(searchParams.brand);
  const [icon, data] = await Promise.all([getPostgameIcon(), loadSettings(brand.id)]);

  return (
    <PortalShell
      active="settings"
      postgameIcon={icon}
      preview={preview}
      brand={brand}
      accountLabel={chrome.personLabel}
      title="Settings"
      /* No "Read-only for now". It described the build, not the page: a brand
         reading it learns their settings are broken rather than that these are
         the details Postgame holds for them. Every panel already says who
         maintains it. */
      subtitle={null}
    >
      <SettingsPanels data={data} />
    </PortalShell>
  );
}
