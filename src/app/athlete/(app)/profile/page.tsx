// ============================================================
// Profile view (mockup screen 14)
//
// Shows the athlete's identity + social handles + payout status, with
// links to edit the profile and (Phase 5) manage payouts.
// ============================================================

import Link from "next/link";
import { requireAthlete } from "@/lib/athlete-auth";
import SignOutButton from "@/components/athlete/SignOutButton";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="a-muted" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, color: value ? "var(--a-off)" : "rgba(250,248,245,0.4)" }}>{value || "Not set"}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const profile = await requireAthlete();
  const name = profile.full_name || profile.display_name || "Athlete";
  const initial = name.charAt(0).toUpperCase();
  const ig = profile.ig_handle ? `@${profile.ig_handle}` : null;
  const tiktok = profile.tiktok_handle ? `@${profile.tiktok_handle}` : null;

  return (
    <div style={{ padding: "10px 18px 0" }}>
      <div className="a-d" style={{ fontSize: 26, padding: "4px 0 16px" }}>PROFILE</div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", background: "var(--a-orange)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="a-d" style={{ fontSize: 38, color: "#fff" }}>{initial}</span>
          )}
        </div>
        <div className="a-d" style={{ fontSize: 24, textTransform: "uppercase" }}>{name}</div>
        {(profile.school || profile.sport) && (
          <div className="a-muted" style={{ fontSize: 13, marginTop: 3 }}>
            {[profile.sport, profile.school].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      <div className="a-card" style={{ padding: "2px 15px", marginBottom: 14 }}>
        <Row label="Email" value={profile.email} />
        <Row label="Instagram" value={ig} />
        <Row label="TikTok" value={tiktok} />
        <Row label="School" value={profile.school} />
        <Row label="Sport" value={profile.sport} />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0" }}>
          <span className="a-muted" style={{ fontSize: 13 }}>Payouts</span>
          <span className={`a-pill ${profile.paypal_linked ? "a-pill-ok" : "a-pill-due"}`}>
            {profile.paypal_linked ? "PayPal linked" : "Not set up"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link href="/athlete/onboarding" className="a-cta" style={{ textDecoration: "none" }}>
          <span className="a-d" style={{ fontSize: 17 }}>EDIT PROFILE</span>
        </Link>
        <Link href="/athlete/earnings" className="a-ghost" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 13 }}>Manage payouts</span>
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
