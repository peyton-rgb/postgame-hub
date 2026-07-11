// ============================================================
// Earnings wallet (postgame-app.html — earnings, Phase 2R)
//
// Sticky header + lockup, then the interactive wallet. Real data from the
// athlete's own `payouts` rows; renders honestly when empty.
// ============================================================

import { requireAthlete } from "@/lib/athlete-auth";
import { getEarnings } from "@/lib/payouts";
import NotificationBell from "@/components/athlete/NotificationBell";
import EarningsWallet, { type WalletPayout } from "@/components/athlete/EarningsWallet";

export const dynamic = "force-dynamic";

// No payout status currently means "withdrawable" — the lifecycle is
// pending → paid, with real withdrawals deferred (see PR Deferred list). So
// available resolves to $0 until such a state exists; upcoming/previous carry
// the real seeded rows.
const WITHDRAWABLE = new Set(["available", "ready", "withdrawable"]);

export default async function EarningsPage() {
  const profile = await requireAthlete();
  const earnings = await getEarnings(profile.id);

  const toWallet = (p: (typeof earnings.payouts)[number]): WalletPayout => ({
    id: p.id,
    brandName: p.brandName,
    brandLogo: p.brandLogo,
    campaignTitle: p.campaignTitle,
    amount_cents: p.amount_cents,
    amount_label: p.amount_label,
    currency: p.currency,
    status: p.status,
    scheduled_for: p.scheduled_for,
    paid_at: p.paid_at,
  });

  const upcoming = earnings.payouts.filter((p) => p.status !== "paid").map(toWallet);
  const previous = earnings.payouts.filter((p) => p.status === "paid").map(toWallet);
  const availableCents = earnings.payouts
    .filter((p) => WITHDRAWABLE.has(p.status))
    .reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  return (
    <div>
      <div className="a-apphead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="a-logo" src="/postgame-logo-white.png" alt="Postgame" />
        <NotificationBell athleteId={profile.id} />
      </div>

      <div style={{ padding: "0 18px" }}>
        <div className="a-lockup">
          <div className="a-eyebrow">Your money</div>
          <div className="a-greet">
            EARN<span className="o">INGS.</span>
          </div>
          <div className="a-bar" />
        </div>
      </div>

      <EarningsWallet
        availableCents={availableCents}
        currency="USD"
        paypalLinked={!!profile.paypal_linked}
        paypalEmail={profile.paypal_email}
        upcoming={upcoming}
        previous={previous}
      />
    </div>
  );
}
