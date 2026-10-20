// ============================================================
// /admin/view-as/athlete — no athlete chosen: open the first app user
// (profiles.access_level = 'athlete'), or say there are none yet.
// ============================================================

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadAthleteOptions, loadBrandOptions } from "@/lib/admin/view-as/queries";
import ViewAsSwitch from "@/components/admin/view-as/ViewAsSwitch";
import { PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

export default async function ViewAsAthleteIndex() {
  await requireAdmin("staff");
  const athletes = await loadAthleteOptions();
  if (athletes.length) redirect(`/admin/view-as/athlete/${athletes[0].id}`);
  const brands = await loadBrandOptions();
  return (
    <div>
      <div className="mb-3.5 rounded-[10px] bg-[#F1F2F4] px-3 py-2">
        <ViewAsSwitch mode="athlete" brands={brands} athletes={[]} />
      </div>
      <PreviewHead title="Athlete view" sub="No app users yet: athletes appear here once they sign up in the Postgame app." />
    </div>
  );
}
