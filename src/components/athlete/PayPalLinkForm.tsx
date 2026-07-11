"use client";

// Shared PayPal-link form used by both Earnings and the Profile → Payment
// settings sheet. Writes go through the service-role route /api/athlete/paypal
// (paypal_email + paypal_linked are frozen against direct client UPDATE by a
// DB protect trigger, so a plain profiles.update won't work here).

import { useState } from "react";
import { useRouter } from "next/navigation";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function PayPalLinkForm({
  initialEmail,
  onSuccess,
}: {
  initialEmail?: string | null;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid PayPal email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/athlete/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't link PayPal — try again.");
      onSuccess?.();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Couldn't link PayPal — try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div>
        <label className="a-label">PayPal email</label>
        <input
          className="a-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
        />
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(250,248,245,0.5)", lineHeight: 1.5 }}>
        Payouts go straight to this PayPal. Postgame never sees your bank details.
      </div>
      {error && <div className="a-err">{error}</div>}
      <button className="a-cta" onClick={submit} disabled={loading}>
        <span className="a-anton" style={{ fontSize: 15 }}>{loading ? "LINKING…" : "LINK PAYPAL"}</span>
      </button>
    </div>
  );
}
