// ============================================================
// View as athlete · Submit content (prototype S["ath-submit"]): the
// upload list for campaigns the athlete is on — one row per
// deliverable slot from athlete_deliverables, with its status.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getPostgameLogos } from "@/lib/signup/postgameLogo";
import { loadAthleteDeals, loadPreviewAthlete } from "@/lib/admin/view-as/queries";
import { deliverableLabel } from "@/lib/admin/view-as/types";
import { Btn } from "@/components/admin/campaign/bits";
import { ApList, ApScreen, ApTabs, ApTop, AthPhone, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { to_upload: "Upload", in_review: "In review", approved: "Approved", posted: "Posted", paid: "Paid" };

export default async function AthleteSubmitPreview({ params }: { params: { athleteId: string } }) {
  await requireAdmin("staff");
  const a = await loadPreviewAthlete(params.athleteId);
  if (!a) notFound();
  const [{ deals }, logos] = await Promise.all([loadAthleteDeals(a.id), getPostgameLogos()]);
  const rows = deals.flatMap((d) =>
    d.deliverables.map((x, i) => [
      `${deliverableLabel(x.slot, null)} · ${d.title}`,
      d.brandName ?? "Campaign",
      STATUS[x.status ?? ""] ?? (x.status ? x.status.replace(/_/g, " ") : `#${i + 1}`),
    ] as [string, string, string])
  );

  return (
    <div>
      <PreviewHead
        title="Submit content"
        sub="The athlete's upload list for campaigns they're selected on."
        actions={<Btn href="/admin/content/submissions">Submission forms</Btn>}
      />
      <AthPhone note="Each slot is a deliverable on a campaign the athlete is on. Files go to the campaign's folder under the athlete's name; staff see them in Review & edit.">
        <ApScreen>
          <ApTop title="Submit content" logo={logos.onDark} />
          <ApList rows={rows} empty="Nothing to upload. Deliverables show here once you're selected for a campaign." />
          <ApTabs on="My deals" />
        </ApScreen>
      </AthPhone>
    </div>
  );
}
