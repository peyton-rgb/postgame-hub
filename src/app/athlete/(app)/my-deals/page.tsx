// ============================================================
// My deals (postgame-app.html — mydeals)
//
// Sticky header + lockup, then every deal the athlete opted into as a quiet
// glass card with a progress rail and, when content is actually due, an
// orange ACTION NEEDED block.
// ============================================================

import { requireAthlete } from "@/lib/athlete-auth";
import { getMyDeals } from "@/lib/athlete-deliverables";
import DealTrackerCard from "@/components/athlete/DealTrackerCard";
import NotificationBell from "@/components/athlete/NotificationBell";

export const dynamic = "force-dynamic";

export default async function MyDealsPage() {
  const profile = await requireAthlete();
  const deals = await getMyDeals(profile.id);

  return (
    <div>
      {/* Sticky app header */}
      <div className="a-apphead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="a-logo" src="/postgame-logo-white.png" alt="Postgame" />
        <NotificationBell athleteId={profile.id} />
      </div>

      <div style={{ padding: "0 18px" }}>
        <div className="a-lockup">
          <div className="a-eyebrow">Your active campaigns</div>
          <div className="a-greet">
            MY <span className="o">DEALS.</span>
          </div>
          <div className="a-bar" />
        </div>

        {deals.length === 0 ? (
          <div className="a-card" style={{ textAlign: "center", padding: "34px 18px" }}>
            <div className="a-d" style={{ fontSize: 20 }}>NOTHING HERE YET</div>
            <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
              Opt into a deal from the Deals tab and it&rsquo;ll show up here so you can track every
              step — upload, approval, posting and payout.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {deals.map((d) => (
                <DealTrackerCard
                  key={d.optinId}
                  optinId={d.optinId}
                  brandName={d.brandName}
                  brandLogo={d.brandLogo}
                  title={d.title}
                  stage={d.stage}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: "rgba(250,248,245,0.4)", textAlign: "center", marginTop: 14 }}>
              Tap a deal to upload content or see the brief.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
