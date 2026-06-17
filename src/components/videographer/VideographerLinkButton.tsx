"use client";

// Generates a videographer upload link and shows a copyable URL. Used by both
// the athlete app and the staff review card (different endpoints/bodies).
// Copy-to-clipboard only — nothing is sent anywhere.

import { useState } from "react";

export default function VideographerLinkButton({
  endpoint,
  body,
  variant = "athlete",
  label = "Get a videographer link",
}: {
  endpoint: string;
  body: Record<string, any>;
  variant?: "athlete" | "staff";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't create the link.");
      setUrl(`${window.location.origin}${json.path}`);
    } catch (err: any) {
      setError(err?.message || "Couldn't create the link.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; user can select manually */
    }
  }

  if (variant === "staff") {
    return (
      <div style={{ marginTop: 4 }}>
        {!url ? (
          <button onClick={generate} disabled={loading}
            style={{ border: "1px solid rgba(255,255,255,0.2)", background: "transparent", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "rgba(255,255,255,0.85)", cursor: "pointer" }}>
            {loading ? "Generating…" : "Generate videographer link"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
              style={{ flex: 1, minWidth: 220, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "7px 10px", color: "#fff", fontSize: 12 }} />
            <button onClick={copy} style={{ background: "#D73F09", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
        {error && <div style={{ fontSize: 11, color: "#ff6b6b", marginTop: 6 }}>{error}</div>}
      </div>
    );
  }

  // athlete variant
  return (
    <div>
      {!url ? (
        <button className="a-ghost" onClick={generate} disabled={loading} style={{ width: "100%" }}>
          <span style={{ fontSize: 13 }}>{loading ? "Generating…" : label}</span>
        </button>
      ) : (
        <div className="a-card" style={{ textAlign: "left" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(250,248,245,0.45)", marginBottom: 6 }}>Videographer link</div>
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="a-input" style={{ fontSize: 12 }} />
          <button className="a-cta" onClick={copy} style={{ marginTop: 9, padding: 11 }}>
            <span className="a-d" style={{ fontSize: 16 }}>{copied ? "COPIED!" : "COPY LINK"}</span>
          </button>
          <div style={{ fontSize: 11, color: "rgba(250,248,245,0.4)", textAlign: "center", marginTop: 7 }}>
            Send this to your videographer. Anything they upload comes to you for review.
          </div>
        </div>
      )}
      {error && <div className="a-err" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
