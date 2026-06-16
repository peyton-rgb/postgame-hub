// ============================================================
// Deals home (mockup screen 1)
//
// Phase 1: profile header + empty state. Phase 2 replaces the empty state
// with live deal cards read from optin_campaigns.
// ============================================================

import { requireAthlete } from "@/lib/athlete-auth";

export default async function AthleteHomePage() {
  const profile = await requireAthlete();
  const name = profile.full_name || profile.display_name || "Athlete";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div style={{ padding: "8px 18px 0" }}>
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0 16px" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "var(--a-orange)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="a-d" style={{ fontSize: 17, color: "#fff" }}>{initial}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="a-muted" style={{ fontSize: 11 }}>Welcome back</div>
          <div className="a-d" style={{ fontSize: 21, textTransform: "uppercase" }}>{name}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 12px" }}>
        <div className="a-muted" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>Available deals</div>
      </div>

      {/* Empty state — Phase 2 fills this with live deal cards */}
      <div className="a-card" style={{ textAlign: "center", padding: "34px 18px" }}>
        <div className="a-d" style={{ fontSize: 20 }}>NO DEALS YET</div>
        <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
          When a brand deal opens up for you, it shows up right here. We&rsquo;ll send you a notification
          the moment it drops.
        </p>
      </div>
    </div>
  );
}
