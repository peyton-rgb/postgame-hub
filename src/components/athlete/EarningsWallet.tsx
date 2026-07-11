"use client";

// Earnings wallet (brief Phase 2R Screen 1, in the postgame-app.html visual
// language): AVAILABLE TO WITHDRAW balance, PayPal link / WITHDRAW (display
// only — no money moves), and an UPCOMING / PREVIOUS segmented toggle over the
// athlete's own payouts. All money is real data from `payouts`; empty renders
// honestly.

import { useState } from "react";
import Link from "next/link";
import AthleteSheet from "@/components/athlete/AthleteSheet";
import PayPalLinkForm from "@/components/athlete/PayPalLinkForm";
import { formatMoney, formatDate } from "@/lib/athlete-format";

export type WalletPayout = {
  id: string;
  brandName: string | null;
  brandLogo: string | null;
  campaignTitle: string | null;
  amount_cents: number | null;
  amount_label: string | null;
  currency: string;
  status: string;
  scheduled_for: string | null;
  paid_at: string | null;
};

function amountText(p: WalletPayout): string {
  if (p.amount_cents != null) return formatMoney(p.amount_cents, p.currency);
  if (p.amount_label) return p.amount_label;
  return "—";
}

function knownCents(list: WalletPayout[]): number {
  return list.reduce((s, p) => s + (p.amount_cents ?? 0), 0);
}

function Row({ p, tab }: { p: WalletPayout; tab: "upcoming" | "previous" }) {
  const sub =
    tab === "previous"
      ? `Paid ${formatDate(p.paid_at) || "—"}`
      : p.scheduled_for
      ? `Pays around ${formatDate(p.scheduled_for)}`
      : "Scheduled after verification";
  return (
    <div className="a-erow">
      <span className="ntile">
        {p.brandLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.brandLogo} alt={p.brandName || "brand"} />
        ) : null}
      </span>
      <div className="ebody">
        <b>{[p.brandName, p.campaignTitle].filter(Boolean).join(" · ") || "Deal"}</b>
        <span>{sub}</span>
      </div>
      <span className={`a-eamt ${tab === "previous" ? "green" : "pend"}`}>{amountText(p)}</span>
    </div>
  );
}

export default function EarningsWallet({
  availableCents,
  currency,
  paypalLinked,
  paypalEmail,
  w9Needed,
  upcoming,
  previous,
}: {
  availableCents: number;
  currency: string;
  paypalLinked: boolean;
  paypalEmail: string | null;
  w9Needed: boolean;
  upcoming: WalletPayout[];
  previous: WalletPayout[];
}) {
  const [tab, setTab] = useState<"upcoming" | "previous">("upcoming");
  const [linkOpen, setLinkOpen] = useState(false);
  const [withdrawRequested, setWithdrawRequested] = useState(false);

  const hasAnyPayout = upcoming.length + previous.length > 0;
  const balSub =
    availableCents > 0
      ? "Ready to withdraw to your linked PayPal."
      : hasAnyPayout
      ? "Nothing to withdraw yet — upcoming payouts appear below."
      : "No payouts yet — they land here after your content is verified.";

  const list = tab === "upcoming" ? upcoming : previous;
  const total = knownCents(list);

  return (
    <div style={{ padding: "0 18px" }}>
      {/* Balance */}
      <div className="a-balcard">
        <div className="a-bal-label">Available to withdraw</div>
        <div className="a-bal-amt">{formatMoney(availableCents, currency)}</div>
        <div className="a-bal-sub">{balSub}</div>
      </div>

      {/* W-9 alert — only while a W-9 is still needed (blocks getting paid) */}
      {w9Needed && (
        <div className="a-w9alert">
          <span className="w9ic">!</span>
          <div className="w9body">
            <div className="w9t">W-9 needed</div>
            <div className="w9s">Add your W-9 so Postgame can pay you. Takes a few taps in Payment settings.</div>
          </div>
          <Link href="/athlete/profile" className="a-w9update">Add W-9</Link>
        </div>
      )}

      {/* PayPal link / withdraw */}
      {!paypalLinked ? (
        <button className="a-cta" style={{ marginTop: 16 }} onClick={() => setLinkOpen(true)}>
          <span className="a-anton" style={{ fontSize: 15 }}>LINK PAYPAL TO WITHDRAW</span>
        </button>
      ) : withdrawRequested ? (
        <div className="a-card" style={{ marginTop: 16, borderColor: "rgba(9,215,63,0.3)" }}>
          <div className="a-anton" style={{ fontSize: 12, color: "var(--a-green)", letterSpacing: "0.14em" }}>
            WITHDRAWAL REQUESTED
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(250,248,245,0.7)", marginTop: 6, lineHeight: 1.5 }}>
            Your Postgame manager will confirm and release it to {paypalEmail || "your PayPal"}.
          </div>
        </div>
      ) : (
        <>
          <button
            className="a-cta"
            style={{ marginTop: 16, background: availableCents > 0 ? "var(--a-green)" : "rgba(9,215,63,0.4)", color: "#04160b" }}
            onClick={() => setWithdrawRequested(true)}
            disabled={availableCents <= 0}
          >
            <span className="a-anton" style={{ fontSize: 15 }}>WITHDRAW</span>
          </button>
          <div className="a-ppbar" style={{ cursor: "pointer" }} onClick={() => setLinkOpen(true)}>
            <span className="a-ppic">P</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: "bold" }}>PayPal linked</div>
              <div style={{ fontSize: 11, color: "rgba(250,248,245,0.4)" }}>{paypalEmail}</div>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--a-orange)", fontWeight: "bold" }}>Change</span>
          </div>
        </>
      )}

      {/* Segmented toggle */}
      <div className="a-segtoggle">
        <button className={tab === "upcoming" ? "on" : ""} onClick={() => setTab("upcoming")}>Upcoming</button>
        <button className={tab === "previous" ? "on" : ""} onClick={() => setTab("previous")}>Previous</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "14px 0 2px" }}>
        <span className="a-muted" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {list.length} {list.length === 1 ? "payout" : "payouts"}
        </span>
        {total > 0 && (
          <span className="a-d" style={{ fontSize: 18, color: tab === "previous" ? "var(--a-green)" : "var(--a-off)" }}>
            {formatMoney(total, currency)}
          </span>
        )}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="a-card" style={{ textAlign: "center", padding: "26px 18px", marginTop: 8 }}>
          <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {tab === "upcoming"
              ? "No upcoming payouts. Finish a deal and your verified payout shows up here."
              : "No payouts yet. Once a payout is released it moves here."}
          </p>
        </div>
      ) : (
        <div>
          {list.map((p) => (
            <Row key={p.id} p={p} tab={tab} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <div style={{ fontSize: 12.5, color: "rgba(250,248,245,0.55)" }}>
          Payment question? Talk to your Postgame manager.
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(250,248,245,0.35)", marginTop: 6 }}>
          PayPal fees may apply.
        </div>
      </div>

      <AthleteSheet
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={paypalLinked ? "Change PayPal" : "Link PayPal"}
        subtitle="Payouts land here automatically after your content is verified."
      >
        <PayPalLinkForm initialEmail={paypalEmail} onSuccess={() => setLinkOpen(false)} />
      </AthleteSheet>
    </div>
  );
}
