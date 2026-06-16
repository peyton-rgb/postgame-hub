"use client";

// Link PayPal (mockup screen 11). Saves the destination email via the
// server route (the flag is server-only). No PayPal login / credentials —
// just the email that receives payouts.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LinkPayPalForm({ initialEmail }: { initialEmail?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/athlete/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't save your PayPal email.");
      router.push("/athlete/earnings");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Couldn't save your PayPal email.");
      setLoading(false);
    }
  }

  return (
    <div>
      <label className="a-label">PayPal email</label>
      <input className="a-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
      {error && <div className="a-err" style={{ marginTop: 10 }}>{error}</div>}
      <button className="a-cta" onClick={save} disabled={loading || !email.trim()} style={{ marginTop: 12 }}>
        <span className="a-d" style={{ fontSize: 18 }}>{loading ? "SAVING…" : "SAVE PAYPAL EMAIL"}</span>
      </button>
      <div style={{ fontSize: 11, color: "rgba(250,248,245,0.4)", textAlign: "center", marginTop: 8 }}>
        Postgame only stores this email — never your PayPal password or bank details.
      </div>
    </div>
  );
}
