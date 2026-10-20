// ============================================================
// PreviewFrame — wraps every View-as screen inside the admin shell:
// a strip with the View as switch and an honest "preview" line, then
// the brand portal / athlete app nav beside the page.
// Server component; the switch and nav are small client islands.
// ============================================================

import ViewAsSwitch from "./ViewAsSwitch";
import PortalModeToggle from "./PortalModeToggle";
import PortalNav, { type PortalNavItem } from "./PortalNav";
import type { PickOption, ViewMode } from "@/lib/admin/view-as/types";

export default function PreviewFrame({
  mode,
  brands,
  athletes,
  brandId,
  athleteId,
  note,
  nav,
  portalMode,
  staffPanel,
  children,
}: {
  mode: Exclude<ViewMode, "staff">;
  brands: PickOption[];
  athletes: PickOption[];
  brandId?: string;
  athleteId?: string;
  note: React.ReactNode;
  nav: {
    who: string;
    sub: string;
    logo: string | null;
    initials?: string;
    items: PortalNavItem[];
    settings: PortalNavItem;
    footLine: string;
  };
  /** brand previews only: "postgame" (admin shell + staff panel) or "brand" (full-screen, exactly what the brand sees) */
  portalMode?: "postgame" | "brand";
  /** Postgame-only tools shown above the portal in Postgame view */
  staffPanel?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (mode === "brand" && portalMode === "brand") {
    // Brand view: cover the admin chrome so only the portal shows, as the
    // brand's employees see it. The floating switch is the way back.
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#F4F5F7]">
        <div className="md:flex md:min-h-full md:items-stretch">
          <PortalNav {...nav} footLine={nav.who} full />
          <main className="min-w-0 flex-1 px-4 py-5 md:px-7 md:py-6">{children}</main>
        </div>
        <div className="fixed bottom-4 right-4 z-[90]">
          <PortalModeToggle mode="brand" floating />
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border-l-[3px] border-[#D73F09] bg-[#F1F2F4] px-3 py-2">
        <ViewAsSwitch mode={mode} brands={brands} athletes={athletes} brandId={brandId} athleteId={athleteId} />
        <span className="text-[12px] text-stone-500 sm:ml-auto">{note}</span>
        {mode === "brand" && portalMode && <PortalModeToggle mode={portalMode} />}
      </div>
      {mode === "brand" && staffPanel}
      <div className="md:flex md:items-start md:gap-5">
        <PortalNav {...nav} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
