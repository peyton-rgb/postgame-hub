// ============================================================
// PreviewFrame — wraps every View-as screen inside the admin shell:
// a strip with the View as switch and an honest "preview" line, then
// the brand portal / athlete app nav beside the page.
// Server component; the switch and nav are small client islands.
// ============================================================

import ViewAsSwitch from "./ViewAsSwitch";
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
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border-l-[3px] border-[#D73F09] bg-[#F1F2F4] px-3 py-2">
        <ViewAsSwitch mode={mode} brands={brands} athletes={athletes} brandId={brandId} athleteId={athleteId} />
        <span className="text-[12px] text-stone-500 sm:ml-auto">{note}</span>
      </div>
      <div className="md:flex md:items-start md:gap-5">
        <PortalNav {...nav} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
