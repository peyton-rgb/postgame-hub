"use client";

// FTC acknowledgement + opt-in action (mockup screen 2 footer). Posts to
// /api/athlete/optin and, on success, sends the athlete to the "You're in"
// confirmation. athlete_id is resolved server-side from the session.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OptInForm({
  campaignId,
  slug,
  brandName,
}: {
  campaignId: string;
  slug: string;
  brandName: string;
}) {
  const router = useRouter();
  const [ack, setAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function optIn() {
    setError("");
    if (!ack) {
      setError("Please confirm the disclosure to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/athlete/optin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, ftcAck: ack }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      router.push(`/athlete/deals/${slug}/joined`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        onClick={() => setAck((v) => !v)}
        style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", padding: 2 }}
      >
        <div
          style={{
            width: 19,
            height: 19,
            borderRadius: 5,
            border: ack ? "2px solid var(--a-orange)" : "2px solid rgba(250,248,245,0.4)",
            background: ack ? "var(--a-orange)" : "transparent",
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {ack && (
            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: "#fff", strokeWidth: 3, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d="M5 12.5l4 4 9-10" />
            </svg>
          )}
        </div>
        <span style={{ fontSize: 12, lineHeight: 1.4, color: "rgba(250,248,245,0.6)" }}>
          I&rsquo;ll disclose this as an ad (#ad / paid partnership) per FTC rules.
        </span>
      </div>

      {error && <div className="a-err">{error}</div>}

      <button className="a-cta" onClick={optIn} disabled={loading}>
        <span className="a-d" style={{ fontSize: 19 }}>{loading ? "OPTING IN…" : "OPT IN TO THIS DEAL"}</span>
      </button>
      <div style={{ fontSize: 11, color: "rgba(250,248,245,0.4)", textAlign: "center" }}>
        Opting in confirms you to {brandName}. You can still ask questions after.
      </div>
    </div>
  );
}
