// ============================================================
// Earnings / get paid (mockup screen 6)
//
// Payout summary, a "connect PayPal" prompt (gates the first payout), and the
// list of scheduled/paid payouts. Amounts shown come from the deal's payout
// label — we don't fabricate dollar figures.
// ============================================================

import Link from "next/link";
import { requireAthlete } from "@/lib/athlete-auth";
import { getEarnings, formatMoney } from "@/lib/payouts";

export const dynamic = "force-dynamic";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function EarningsPage() {
  const profile = await requireAthlete();
  const { payouts, paidCount, pendingCount, paidCents, pendingCents } = await getEarnings(profile.id);

  return (
    <div style={{ padding: "10px 18px 0" }}>
      <div className="a-d" style={{ fontSize: 26, padding: "4px 0 16px" }}>EARNINGS</div>

      {/* summary */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 13 }}>
          <div className="a-muted" style={{ fontSize: 11 }}>Paid</div>
          <div className="a-d" style={{ fontSize: 28, color: "var(--a-off)", marginTop: 3 }}>
            {paidCents > 0 ? formatMoney(paidCents) : paidCount}
          </div>
          <div className="a-muted" style={{ fontSize: 11 }}>{paidCents > 0 ? `${paidCount} deals` : "deals paid"}</div>
        </div>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 13 }}>
          <div className="a-muted" style={{ fontSize: 11 }}>Pending</div>
          <div className="a-d" style={{ fontSize: 28, color: "var(--a-orange-soft)", marginTop: 3 }}>
            {pendingCents > 0 ? formatMoney(pendingCents) : pendingCount}
          </div>
          <div className="a-muted" style={{ fontSize: 11 }}>{pendingCents > 0 ? `${pendingCount} deals` : "scheduled"}</div>
        </div>
      </div>

      {/* PayPal status */}
      {profile.paypal_linked ? (
        <div className="a-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: "var(--a-green)", strokeWidth: 2, fill: "none", flex: "none" }}>
            <circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--a-off)" }}>PayPal linked</div>
            <div className="a-muted" style={{ fontSize: 11 }}>{profile.paypal_email}</div>
          </div>
          <Link href="/athlete/earnings/link" style={{ fontSize: 12, color: "var(--a-orange)" }}>Change</Link>
        </div>
      ) : (
        <div className="a-card" style={{ borderColor: "rgba(215,63,9,0.4)", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "var(--a-orange)", strokeWidth: 2, fill: "none", flex: "none" }}>
              <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1.2" />
            </svg>
            <div style={{ flex: 1 }}>
              <div className="a-d" style={{ fontSize: 16 }}>SET UP PAYOUTS</div>
              <div style={{ fontSize: 12, color: "rgba(250,248,245,0.65)", lineHeight: 1.45, marginTop: 3 }}>
                Add the PayPal email where you want to get paid. Payouts go straight to your PayPal — Postgame never sees your bank details.
              </div>
            </div>
          </div>
          <Link href="/athlete/earnings/link" className="a-cta" style={{ marginTop: 12, padding: 11, textDecoration: "none", display: "block" }}>
            <span className="a-d" style={{ fontSize: 16 }}>CONNECT PAYPAL</span>
          </Link>
        </div>
      )}

      {/* payouts list */}
      <div className="a-muted" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", margin: "4px 2px 8px" }}>Recent</div>
      {payouts.length === 0 ? (
        <div className="a-card" style={{ textAlign: "center", padding: "26px 18px" }}>
          <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            No payouts yet. Finish a deal — post your content and get it verified — and your payout shows up here.
          </p>
        </div>
      ) : (
        <div>
          {payouts.map((p) => {
            const isPaid = p.status === "paid";
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {p.brandLogo ? (
                  <div style={{ background: "rgba(255,255,255,0.94)", borderRadius: 6, padding: "4px 7px", display: "flex" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.brandLogo} alt="" style={{ height: 12 }} />
                  </div>
                ) : (
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.1)" }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--a-off)" }}>{p.brandName} · {p.campaignTitle}</div>
                  <div className="a-muted" style={{ fontSize: 11 }}>
                    {isPaid ? `Paid ${p.paid_at ? fmtDate(p.paid_at) : ""}` : `Pays around ${fmtDate(p.scheduled_for)}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="a-d" style={{ fontSize: 15, color: isPaid ? "var(--a-green)" : "var(--a-orange-soft)" }}>
                    {p.amount_cents != null ? formatMoney(p.amount_cents, p.currency) : p.amount_label || "TBD"}
                  </div>
                  <div className="a-muted" style={{ fontSize: 10 }}>{isPaid ? "Paid" : "Pending"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/athlete/earnings/terms" style={{ fontSize: 12, color: "rgba(250,248,245,0.5)" }}>How payouts work →</Link>
      </div>
    </div>
  );
}
