// My deals tracker (mockup screen 4). Built out in Phase 3.

export default function MyDealsPage() {
  return (
    <div style={{ padding: "10px 18px 0" }}>
      <div className="a-d" style={{ fontSize: 26, padding: "4px 0 16px" }}>MY DEALS</div>
      <div className="a-card" style={{ textAlign: "center", padding: "34px 18px" }}>
        <div className="a-d" style={{ fontSize: 20 }}>NOTHING HERE YET</div>
        <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
          Deals you opt into show up here so you can track each step — upload, approval, posting and payout.
        </p>
      </div>
    </div>
  );
}
