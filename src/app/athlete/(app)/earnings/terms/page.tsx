// ============================================================
// Payment terms (mockup screen 12) — the 30-day payout terms
// ============================================================

import Link from "next/link";
import { requireAthlete } from "@/lib/athlete-auth";

export const dynamic = "force-dynamic";

function TermRow({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
      <div className="a-d" style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--a-orange)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flex: "none" }}>{n}</div>
      <div>
        <div style={{ fontSize: 14, color: "var(--a-off)" }}>{title}</div>
        <div className="a-muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>{body}</div>
      </div>
    </div>
  );
}

export default async function PaymentTermsPage() {
  await requireAthlete();
  return (
    <div style={{ padding: "10px 18px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Link href="/athlete/earnings" style={{ display: "flex", color: "rgba(250,248,245,0.7)" }}>
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: "currentColor", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <div className="a-d" style={{ fontSize: 24 }}>HOW PAYOUTS WORK</div>
      </div>

      <div className="a-card" style={{ marginBottom: 14 }}>
        <TermRow n={1} title="Post + paste your link" body="After your content is approved, post it live and paste the post link in the app." />
        <TermRow n={2} title="Postgame verifies it's live" body="A Postgame campaign manager checks the post is live and meets the brief." />
        <TermRow n={3} title="Paid 30 days later" body="Once verified, your payout is scheduled to your PayPal about 30 days after the post goes live." />
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div className="a-d" style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--a-orange)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flex: "none" }}>4</div>
          <div>
            <div style={{ fontSize: 14, color: "var(--a-off)" }}>Straight to PayPal</div>
            <div className="a-muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
              Payouts go to the PayPal email you link. Postgame never sees your PayPal password or bank details.
            </div>
          </div>
        </div>
      </div>

      <p className="a-muted" style={{ fontSize: 11, lineHeight: 1.5, textAlign: "center" }}>
        A deal pays out only after every deliverable for it is posted and verified.
      </p>
    </div>
  );
}
