// ============================================================
// Link PayPal (mockup screen 11)
// ============================================================

import Link from "next/link";
import { requireAthlete } from "@/lib/athlete-auth";
import LinkPayPalForm from "@/components/athlete/LinkPayPalForm";

export const dynamic = "force-dynamic";

export default async function LinkPayPalPage() {
  const profile = await requireAthlete();
  return (
    <div style={{ padding: "10px 18px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Link href="/athlete/earnings" style={{ display: "flex", color: "rgba(250,248,245,0.7)" }}>
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: "currentColor", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <div className="a-d" style={{ fontSize: 24 }}>CONNECT PAYPAL</div>
      </div>

      <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
        Add the PayPal email where you want to get paid. Payouts are sent there about{" "}
        <b style={{ color: "var(--a-off)" }}>30 days</b> after your post is verified.
      </p>

      <LinkPayPalForm initialEmail={profile.paypal_email} />

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/athlete/earnings/terms" style={{ fontSize: 12, color: "rgba(250,248,245,0.5)" }}>See full payment terms →</Link>
      </div>
    </div>
  );
}
