// ============================================================
// View as athlete · Profile (prototype S["ath-profile"]): name, school,
// sport and connected accounts, straight from the athlete's profile.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getPostgameLogos } from "@/lib/signup/postgameLogo";
import { loadPreviewAthlete } from "@/lib/admin/view-as/queries";
import { initialsOf } from "@/components/admin/ops-bits";
import { ApList, ApScreen, ApTabs, ApTop, AthPhone, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

export default async function AthleteProfilePreview({ params }: { params: { athleteId: string } }) {
  await requireAdmin("staff");
  const a = await loadPreviewAthlete(params.athleteId);
  if (!a) notFound();
  const logos = await getPostgameLogos();

  return (
    <div>
      <PreviewHead title="Profile" sub="Name, school, sport and connected accounts." />
      <AthPhone note="Real name, school, sport and handles from the athlete's profile. Connected accounts are what Instagram stats and posting checks read from.">
        <ApScreen>
          <ApTop title="Profile" logo={logos.onDark} />
          <div className="flex items-center gap-3 px-4 py-2">
            {a.avatarUrl ? (
              <img src={a.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#1B1B21] text-[14px] font-semibold">{initialsOf(a.name)}</span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[16px] font-bold">{a.name}</div>
              <div className="truncate text-[12px] text-[#AAAAB0]">{[a.school, a.sport, a.classYear].filter(Boolean).join(" · ") || "School not set"}</div>
            </div>
          </div>
          <ApList
            rows={[
              ["Instagram", a.igHandle ?? "Not connected", a.igHandle ? "Connected" : ""],
              ["TikTok", a.tiktokHandle ?? "Not connected", a.tiktokHandle ? "Connected" : ""],
              ["Payout method", "PayPal", a.paypalLinked ? "✓" : "Not linked"],
              ["W-9", a.w9Status ? a.w9Status.replace(/_/g, " ") : "Not on file", a.w9Status ? "✓" : ""],
              ["Reach", a.reachTotal != null ? a.reachTotal.toLocaleString("en-US") : "—", ""],
            ]}
          />
          <ApTabs on="Profile" />
        </ApScreen>
      </AthPhone>
    </div>
  );
}
