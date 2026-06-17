"use client";

// Auto editor results for one athlete + deal (mockup: the curator). Run button
// scores the deal's uploaded content; renders top picks first (score + why),
// compliance flags prominently, and an "others" section. Server data (with
// thumbnails) is the source of truth; Run triggers a refresh.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Evl = {
  deliverable_id: string;
  slot: string;
  media_type: string | null;
  file_url: string | null;
  overall_score: number | null;
  scores: { authenticity?: number; compliance?: number; performance?: number; brand?: number; technical?: number } | null;
  compliance_pass: boolean;
  compliance_flags: string[];
  is_top_pick: boolean;
  rank: number | null;
  rationale: string | null;
  is_preliminary: boolean;
  model: string | null;
};

const CATS: { key: keyof NonNullable<Evl["scores"]>; label: string }[] = [
  { key: "authenticity", label: "Authenticity" },
  { key: "compliance", label: "Compliance" },
  { key: "performance", label: "Performance" },
  { key: "brand", label: "Brand" },
  { key: "technical", label: "Technical" },
];

function Bars({ s }: { s: Evl["scores"] }) {
  if (!s) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
      {CATS.map((c) => {
        const v = Math.max(0, Math.min(100, Number(s[c.key] ?? 0)));
        return (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, width: 78, color: "rgba(255,255,255,0.5)" }}>{c.label}</span>
            <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${v}%`, height: "100%", background: v >= 70 ? "#34C759" : v >= 45 ? "#ff8a5c" : "#ff6b6b" }} />
            </div>
            <span style={{ fontSize: 10, width: 22, textAlign: "right", color: "rgba(255,255,255,0.6)" }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function Flags({ flags }: { flags: string[] }) {
  if (!flags?.length) return null;
  return (
    <div style={{ marginTop: 8, background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#ff6b6b", marginBottom: 4 }}>⚠ Compliance — must fix</div>
      {flags.map((f, i) => (
        <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>• {f}</div>
      ))}
    </div>
  );
}

function Card({ e }: { e: Evl }) {
  const isVideo = e.media_type === "video";
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${e.is_top_pick ? "rgba(52,199,89,0.35)" : "rgba(255,255,255,0.09)"}`, borderRadius: 10, padding: 12, display: "flex", gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", flex: "none", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {e.file_url && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.file_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "#fff" }}><path d="M8 5v14l11-7z" /></svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#fff", textTransform: "capitalize" }}>{e.slot}</span>
          {e.is_top_pick && <span style={{ fontSize: 10, fontWeight: 700, color: "#34C759", background: "rgba(52,199,89,0.15)", borderRadius: 6, padding: "2px 7px" }}>TOP PICK{e.rank ? ` #${e.rank}` : ""}</span>}
          {e.is_preliminary && <span style={{ fontSize: 10, color: "#ff8a5c", background: "rgba(215,63,9,0.15)", borderRadius: 6, padding: "2px 7px" }}>PRELIMINARY · video</span>}
          {!e.compliance_pass && <span style={{ fontSize: 10, fontWeight: 700, color: "#ff6b6b", background: "rgba(255,107,107,0.12)", borderRadius: 6, padding: "2px 7px" }}>BLOCKED</span>}
          <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 700, color: "#fff" }}>{e.overall_score ?? "—"}</span>
        </div>
        {e.rationale && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{e.rationale}</div>}
        <Bars s={e.scores} />
        <Flags flags={e.compliance_flags} />
      </div>
    </div>
  );
}

export default function AutoEditorPanel({
  athleteId,
  campaignId,
  initial,
}: {
  athleteId: string;
  campaignId: string;
  initial: Evl[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [showOthers, setShowOthers] = useState(false);

  async function run() {
    setError("");
    setNote("");
    setLoading(true);
    try {
      const res = await fetch("/api/staff/auto-editor/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, campaignId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Auto editor failed.");
      setNote(`Scored ${json.count} item${json.count === 1 ? "" : "s"}${json.stubbed ? " (placeholder — no API key set)" : ` · ${json.model}`}.`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Auto editor failed.");
    } finally {
      setLoading(false);
    }
  }

  const topPicks = initial.filter((e) => e.is_top_pick).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const others = initial.filter((e) => !e.is_top_pick);

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 10, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Auto editor</div>
        <button onClick={run} disabled={loading}
          style={{ marginLeft: "auto", background: "#D73F09", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Scoring…" : initial.length ? "Re-run auto editor" : "Run auto editor"}
        </button>
      </div>
      {note && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>{note}</div>}
      {error && <div style={{ fontSize: 11, color: "#ff6b6b", marginTop: 6 }}>{error}</div>}

      {initial.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {topPicks.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Top picks</div>
              {topPicks.map((e) => <Card key={e.deliverable_id} e={e} />)}
            </>
          )}
          {others.length > 0 && (
            <>
              <button onClick={() => setShowOthers((v) => !v)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "left", cursor: "pointer", padding: "2px 0" }}>
                {showOthers ? "▾" : "▸"} Others ({others.length})
              </button>
              {showOthers && others.map((e) => <Card key={e.deliverable_id} e={e} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
