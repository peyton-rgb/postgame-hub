// ============================================================
// View as athlete · Payments (prototype S["ath-payments"]): what the
// athlete has been paid and what's coming. Paid = deliverables with
// paid_at; the per-campaign pay is optin_campaigns.payout (text).
// Payout method and W-9 come from the athlete's profile.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getPostgameLogos } from "@/lib/signup/postgameLogo";
import { loadAthleteDeals, loadPreviewAthlete } from "@/lib/admin/view-as/queries";
import { shortDate } from "@/lib/admin/view-as/types";
import { ApList, ApScreen, ApTabs, ApTop, AthPhone, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

export default async function AthletePaymentsPreview({ params }: { params: { athleteId: string } }) {
  await requireAdmin("staff");
  const a = await loadPreviewAthlete(params.athleteId);
  if (!a) notFound();
  const [{ deals }, logos] = await Promise.all([loadAthleteDeals(a.id), getPostgameLogos()]);
  const paidDeals = deals.filter((d) => d.deliverables.some((x) => x.paidAt));

  const rows: [string, string, string][] = deals.map((d) => {
    const paid = d.deliverables.map((x) => x.paidAt).filter(Boolean).sort().pop() ?? null;
    return [
      `${d.brandName ? d.brandName + " · " : ""}${d.title}`,
      paid ? `Paid ${shortDate(paid)}` : "Pays after posting is verified",
      d.payout ?? "—",
    ];
  });
  rows.push(["W-9", "Tax form", a.w9Status ? a.w9Status.replace(/_/g, " ") : "Not on file"]);
  rows.push(["Payout method", "PayPal", a.paypalLinked ? "✓" : "Not linked"]);

  return (
    <div>
      <PreviewHead title="Payments" sub="What the athlete has been paid and what's coming." />
      <AthPhone note="Pay per campaign comes from its opt-in page; a deliverable counts as paid once staff mark it paid. Payouts are approved by staff on the Payments pages.">
        <ApScreen>
          <ApTop title="Payments" logo={logos.onDark} />
          <div className="px-4 pb-3 pt-1">
            <div className="rounded-lg bg-[#1B1B21] p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#AAAAB0]">Campaigns paid</div>
              <div className="font-['Poppins',sans-serif] text-[16px] font-bold">{paidDeals.length}</div>
            </div>
          </div>
          <ApList rows={rows} />
          <ApTabs on="Profile" />
        </ApScreen>
      </AthPhone>
    </div>
  );
}
