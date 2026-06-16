// Earnings / get paid (mockup screen 6). Built out in Phase 5.

export default function EarningsPage() {
  return (
    <div style={{ padding: "10px 18px 0" }}>
      <div className="a-d" style={{ fontSize: 26, padding: "4px 0 16px" }}>EARNINGS</div>
      <div className="a-card" style={{ textAlign: "center", padding: "34px 18px" }}>
        <div className="a-d" style={{ fontSize: 20 }}>NO EARNINGS YET</div>
        <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
          Once you complete a deal, your payouts show up here. You&rsquo;ll link a PayPal email to get paid.
        </p>
      </div>
    </div>
  );
}
