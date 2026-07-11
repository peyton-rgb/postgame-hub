// ============================================================
// Profile v5 (postgame-app.html — profiletab, Phase 2R)
//
// Real identity + stats + campaign history + settings sheets. Server fetches
// the athlete's profile, opt-ins (deals/history) and earnings; the interactive
// screen + sheets live in ProfileScreen (client).
// ============================================================

import { requireAthlete } from "@/lib/athlete-auth";
import { getMyDeals } from "@/lib/athlete-deliverables";
import { getEarnings } from "@/lib/payouts";
import ProfileScreen, { type RailItem } from "@/components/athlete/ProfileScreen";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await requireAthlete();
  const [deals, earnings] = await Promise.all([getMyDeals(profile.id), getEarnings(profile.id)]);

  const name = profile.full_name || profile.display_name || "Athlete";
  const earnedCents = earnings.paidCents + earnings.pendingCents;

  const campaigns: RailItem[] = deals.map((d) => ({
    optinId: d.optinId,
    title: d.title,
    brandName: d.brandName,
    brandLogo: d.brandLogo,
    heroImage: d.heroImage,
    pill: d.stage.pill,
  }));

  return (
    <div style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}>
      <div style={{ padding: "0 18px 4px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/postgame-logo-white.png" alt="Postgame" style={{ width: 104, display: "block" }} />
      </div>
      <ProfileScreen
        profileId={profile.id}
        name={name}
        avatarUrl={profile.avatar_url}
        igHandle={profile.ig_handle}
        tiktokHandle={profile.tiktok_handle}
        school={profile.school}
        sport={profile.sport}
        paypalLinked={!!profile.paypal_linked}
        paypalEmail={profile.paypal_email}
        reach="—"
        dealsCount={deals.length}
        earnedCents={earnedCents}
        campaigns={campaigns}
      />
    </div>
  );
}
