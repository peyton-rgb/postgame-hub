// ============================================================
// Deals feed (postgame-app.html — dealshome)
//
// Sticky app header (logo + bell), a lower-third greeting lockup, the LIVE
// DEALS label, then the live opt-in campaigns as story cards. Only LIVE
// campaigns are fetched — drafts never surface here.
// ============================================================

import { requireAthlete } from "@/lib/athlete-auth";
import { getVisibleDeals, getMyOptinsMap } from "@/lib/athlete-deals";
import DealCard from "@/components/athlete/DealCard";
import NotificationBell from "@/components/athlete/NotificationBell";

export const dynamic = "force-dynamic";

export default async function AthleteHomePage() {
  const profile = await requireAthlete();
  const fullName = profile.full_name || profile.display_name || "Athlete";
  const firstName = fullName.split(" ")[0].toUpperCase();

  const [deals, optins] = await Promise.all([
    getVisibleDeals(),
    getMyOptinsMap(profile.id),
  ]);

  return (
    <div>
      {/* Sticky app header */}
      <div className="a-apphead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="a-logo" src="/postgame-logo-white.png" alt="Postgame" />
        <NotificationBell athleteId={profile.id} />
      </div>

      <div style={{ padding: "0 18px" }}>
        {/* Greeting lockup */}
        <div className="a-lockup">
          <div className="a-eyebrow">Welcome back</div>
          <div className="a-greet">
            WHAT&rsquo;S UP, <span className="o">{firstName}.</span>
          </div>
          <div className="a-bar" />
        </div>

        {/* Live deals */}
        <div className="a-livelabel">
          <span className="a-livedot" />
          <span className="a-livetext">LIVE DEALS</span>
        </div>

        {deals.length === 0 ? (
          <div className="a-card" style={{ textAlign: "center", padding: "34px 18px" }}>
            <div className="a-d" style={{ fontSize: 20 }}>NO LIVE DEALS YET</div>
            <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
              When a brand deal goes live, it shows up right here. We&rsquo;ll send you a
              notification the moment it drops.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} optin={optins[deal.id]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
