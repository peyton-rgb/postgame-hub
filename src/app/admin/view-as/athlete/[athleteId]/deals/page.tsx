// ============================================================
// View as athlete · My deals (prototype S["ath-deals"]): campaigns this
// athlete opted into or was selected for — athlete_campaign_optins on
// the LIVE optin_campaigns spine, with their deliverables' progress.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getPostgameLogos } from "@/lib/signup/postgameLogo";
import { loadAthleteDeals, loadPreviewAthlete } from "@/lib/admin/view-as/queries";
import { shortDate } from "@/lib/admin/view-as/types";
import { ApList, ApScreen, ApTabs, ApTop, AthPhone, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

const cap = (s: string | null) => (s ? s.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase()) : "—");

export default async function AthleteDealsPreview({ params }: { params: { athleteId: string } }) {
  await requireAdmin("staff");
  const a = await loadPreviewAthlete(params.athleteId);
  if (!a) notFound();
  const [{ deals, error }, logos] = await Promise.all([loadAthleteDeals(a.id), getPostgameLogos()]);

  return (
    <div>
      <PreviewHead title="My deals" sub="Campaigns this athlete has opted into or been selected for." />
      <AthPhone
        note={
          error
            ? `Could not load opt-ins: ${error}`
            : `${deals.length} deal${deals.length === 1 ? "" : "s"} from the athlete's opt-ins. Each row opens the deal page with the contract, posting instructions and pay.`
        }
      >
        <ApScreen>
          <ApTop title="My deals" logo={logos.onDark} />
          <ApList
            empty="No deals yet. Opt in from a campaign card to get started."
            rows={deals.map((d) => {
              const done = d.deliverables.filter((x) => x.postedAt || x.paidAt).length;
              const sub = d.deliverables.length
                ? `${done} of ${d.deliverables.length} posted · opted in ${shortDate(d.createdAt)}`
                : `Opted in ${shortDate(d.createdAt)}`;
              return [`${d.brandName ? d.brandName + " · " : ""}${d.title}`, sub, cap(d.status)];
            })}
          />
          <ApTabs on="My deals" />
        </ApScreen>
      </AthPhone>
    </div>
  );
}
