// ============================================================
// /signup/done — where agents and coaches land after sign-up.
// Their account exists but access waits on a Postgame review; this page
// says what happens next instead of dropping them into an empty app.
// ============================================================

import Link from "next/link";

export const metadata = { title: "Join Postgame — What happens next" };

const STEPS: Array<[string, string]> = [
  ["Your account is created", "You can sign in, but there's nothing to see until Postgame switches you on."],
  ["Postgame reviews your request", "The team checks who you represent or coach. Usually within two business days."],
  ["You get access", "We email you when it's live. Agents can then invite their athletes; coaches see the campaigns open to their team."],
];

export default function SignupDonePage() {
  return (
    <div style={{ padding: "14px 0 40px" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div className="a-eyebrow">You&rsquo;re in the queue</div>
        <div className="a-d" style={{ fontSize: 30 }}>WHAT HAPPENS NEXT</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {STEPS.map(([h, p], i) => (
          <div className="a-card" key={h} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span
              className="a-anton"
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: "rgba(215,63,9,.18)",
                color: "var(--a-orange-soft)",
                display: "grid",
                placeItems: "center",
                fontSize: 13,
                flex: "none",
              }}
            >
              {i + 1}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{h}</div>
              <div className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 3 }}>{p}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="a-muted" style={{ textAlign: "center", fontSize: 13, lineHeight: 1.5, marginTop: 22 }}>
        Questions? Email <a href="mailto:support@pstgm.com" style={{ color: "var(--a-orange)" }}>support@pstgm.com</a>.
      </p>
      <Link href="/" className="a-ghost" style={{ display: "block", marginTop: 12, textDecoration: "none" }}>
        <span className="a-anton" style={{ fontSize: 13 }}>BACK TO POSTGAME</span>
      </Link>
    </div>
  );
}
