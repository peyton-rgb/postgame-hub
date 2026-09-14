"use client";

// Manager actions for an athlete deliverable: approve / request changes
// (content gate) or verify (post gate). Calls /api/staff/deliverables/action.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffDeliverableActions({
  deliverableId,
  mode,
}: {
  deliverableId: string;
  mode: "review" | "verify";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(action: "approve" | "reject" | "verify") {
    setError("");
    let note: string | undefined;
    if (action === "reject") {
      note = window.prompt("What needs to change? (the athlete will see this)") || undefined;
      if (note === undefined) return; // cancelled
    }
    setLoading(action);
    try {
      const res = await fetch("/api/staff/deliverables/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId, action, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Action failed.");
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {mode === "review" ? (
        <>
          <button
            onClick={() => act("reject")}
            disabled={!!loading}
            style={{ border: "1px solid var(--hairline)", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "var(--ink-2)", background: "transparent", cursor: "pointer" }}
          >
            {loading === "reject" ? "…" : "Request changes"}
          </button>
          <button
            onClick={() => act("approve")}
            disabled={!!loading}
            style={{ background: "var(--accent)", borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "rgb(var(--pg-off-white-rgb))", fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            {loading === "approve" ? "…" : "Approve"}
          </button>
        </>
      ) : (
        <button
          onClick={() => act("verify")}
          disabled={!!loading}
          style={{ background: "var(--accent)", borderRadius: 8, padding: "7px 16px", fontSize: 12, color: "rgb(var(--pg-off-white-rgb))", fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: "0.04em" }}
        >
          {loading === "verify" ? "…" : "VERIFY"}
        </button>
      )}
      {error && <span style={{ fontSize: 11, color: "var(--accent)" }}>{error}</span>}
    </div>
  );
}
