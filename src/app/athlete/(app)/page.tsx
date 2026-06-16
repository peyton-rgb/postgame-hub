// ============================================================
// Deals home (mockup screen 1)
//
// Profile header + live deal cards read from optin_campaigns. Live deals
// are tappable into the opt-in flow; drafts show as "coming soon".
// ============================================================

import { requireAthlete } from "@/lib/athlete-auth";
import { getVisibleDeals, getMyOptinsMap } from "@/lib/athlete-deals";
import DealCard from "@/components/athlete/DealCard";
import NotificationBell from "@/components/athlete/NotificationBell";

export const dynamic = "force-dynamic";

export default async function AthleteHomePage() {
  const profile = await requireAthlete();
  const name = profile.full_name || profile.display_name || "Athlete";
  const initial = name.charAt(0).toUpperCase();

  const [deals, optins] = await Promise.all([
    getVisibleDeals(),
    getMyOptinsMap(profile.id),
  ]);
  const liveCount = deals.filter((d) => d.status === "live").length;

  return (
    <div style={{ padding: "8px 18px 0" }}>
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0 16px" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "var(--a-orange)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="a-d" style={{ fontSize: 17, color: "#fff" }}>{initial}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="a-muted" style={{ fontSize: 11 }}>Welcome back</div>
          <div className="a-d" style={{ fontSize: 21, textTransform: "uppercase" }}>{name}</div>
        </div>
        <NotificationBell athleteId={profile.id} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 12px" }}>
        <div className="a-muted" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>Available deals</div>
        <div className="a-muted" style={{ fontSize: 11 }}>{liveCount} active</div>
      </div>

      {deals.length === 0 ? (
        <div className="a-card" style={{ textAlign: "center", padding: "34px 18px" }}>
          <div className="a-d" style={{ fontSize: 20 }}>NO DEALS YET</div>
          <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
            When a brand deal opens up, it shows up right here. We&rsquo;ll send you a notification the
            moment it drops.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} optin={optins[deal.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
