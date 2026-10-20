// ============================================================
// View as athlete · Campaigns (prototype S["ath-campaigns"]): the opt-in
// page the athlete opens from a card — their newest opt-in, else the
// newest published one. Reads the LIVE optin_campaigns spine (never the
// legacy campaign_optins). Brand mark = the brands row's light-ink logo.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOptinForAthlete, loadPreviewAthlete } from "@/lib/admin/view-as/queries";
import { shortDate } from "@/lib/admin/view-as/types";
import { Btn } from "@/components/admin/campaign/bits";
import { ApScreen, AthPhone, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

export default async function AthleteCampaignsPreview({ params }: { params: { athleteId: string } }) {
  await requireAdmin("staff");
  const a = await loadPreviewAthlete(params.athleteId);
  if (!a) notFound();
  const { campaign: c, brand, optedIn } = await loadOptinForAthlete(a.id);
  const reqs = (c?.requirements ?? "")
    .split(/\r?\n|•/)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);

  return (
    <div>
      <PreviewHead title="Campaigns" sub="An opt-in page, opened from a card." actions={<Btn href="/admin/campaigns">Campaigns</Btn>} />
      <AthPhone
        note={
          c
            ? `The campaign opt-in page${optedIn ? ` ${a.name} opted into` : " most recently published"}. The athlete reads the deal and taps Opt in; staff see them on the campaign's Opt-ins tab.`
            : "No opt-in pages are published yet. Once one is, the athlete opens it from its card in the feed."
        }
      >
        {c ? (
          <ApScreen>
            <div className="relative h-[230px] overflow-hidden bg-black">
              {c.heroUrl && <img src={c.heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
              {brand?.logoOnDark && (
                <div className="absolute inset-x-0 top-[92px] flex justify-center">
                  <img src={brand.logoOnDark} alt={`${brand.name} logo`} className="h-10 max-w-[60%] object-contain" />
                </div>
              )}
            </div>
            <div className="relative -mt-7 flex-1 rounded-t-[28px] bg-[#0C0C10] px-6 pb-28 pt-3">
              <div className="mx-auto mb-7 h-1 w-9 rounded-full bg-[#303036]" />
              <div className="mb-2 font-['Poppins',sans-serif] text-[11px] font-bold uppercase tracking-[1.3px] text-[#DF4A06]">{brand?.name ?? "Campaign"}</div>
              <div className="font-['Poppins',sans-serif] text-[25px] font-extrabold leading-tight tracking-tight">{c.headline || c.title}</div>
              <div className="mt-7 grid grid-cols-2 gap-2.5">
                {[
                  ["Pay", c.payout ?? "—"],
                  ["Opt in by", c.deadline ? shortDate(c.deadline) : "—"],
                ].map(([l, v]) => (
                  <div key={l} className="min-w-0 rounded-lg bg-[#1B1B21] p-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#AAAAB0]">{l}</div>
                    <div className="break-words font-['Poppins',sans-serif] text-[16px] font-bold">{v}</div>
                  </div>
                ))}
              </div>
              {c.goal && (
                <div className="mt-6 border-t border-[#303036] pt-6">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#AAAAB0]">The campaign</div>
                  <p className="m-0 text-[14px] leading-6">{c.goal}</p>
                </div>
              )}
              {reqs.length > 0 && (
                <div className="mt-6 border-t border-[#303036] pt-6">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#AAAAB0]">What you&rsquo;ll do</div>
                  <ul className="m-0 pl-5 text-[14px] leading-6">
                    {reqs.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-gradient-to-b from-transparent to-[#0C0C10] to-[32%] px-5 pb-4 pt-9">
              <div className="grid h-[54px] w-full place-items-center rounded-full bg-[#DF4A06] font-['Poppins',sans-serif] text-[14px] font-semibold uppercase tracking-[.84px]">
                {optedIn ? "You're in" : "Opt in"}
              </div>
            </div>
          </ApScreen>
        ) : (
          <ApScreen>
            <div className="px-4 pt-24 text-center text-[13px] text-[#AAAAB0]">No campaigns open right now.</div>
          </ApScreen>
        )}
      </AthPhone>
    </div>
  );
}
