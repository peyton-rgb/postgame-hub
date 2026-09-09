"use client";

// Auto editor results for one athlete + deal (mockup: the curator). Run button
// scores the deal's uploaded content; renders top picks first (score + why),
// compliance flags prominently, and an "others" section. Server data (with
// thumbnails) is the source of truth; Run triggers a refresh.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Sug = {
  id: string;
  kind: string;
  summary: string;
  detail: string | null;
  severity: "info" | "recommended" | "required";
  status: "proposed" | "approved" | "dismissed";
};
export type Job = { id: string; type: string; status: string };

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
  suggestions: Sug[];
  jobs: Job[];
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
            <span style={{ fontSize: 10, width: 78, color: "var(--ink-4)" }}>{c.label}</span>
            <div style={{ flex: 1, height: 4, background: "var(--hairline)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${v}%`, height: "100%", background: v >= 70 ? "var(--ink-3)" : v >= 45 ? "var(--accent)" : "var(--accent)" }} />
            </div>
            <span style={{ fontSize: 10, width: 22, textAlign: "right", color: "var(--ink-3)" }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function Flags({ flags }: { flags: string[] }) {
  if (!flags?.length) return null;
  return (
    <div style={{ marginTop: 8, background: "var(--accent-dim)", border: "1px solid var(--accent-dim)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>⚠ Compliance — must fix</div>
      {flags.map((f, i) => (
        <div key={i} style={{ fontSize: 12, color: "var(--ink-2)" }}>• {f}</div>
      ))}
    </div>
  );
}

const SEV_COLOR: Record<string, string> = { required: "var(--accent)", recommended: "var(--accent)", info: "var(--ink-4)" };

function SuggestionsBlock({ e }: { e: Evl }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function suggest() {
    setErr(""); setBusy("gen");
    try {
      const res = await fetch("/api/staff/auto-editor/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliverableId: e.deliverable_id }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed.");
      router.refresh();
    } catch (x: any) { setErr(x?.message || "Failed."); } finally { setBusy(null); }
  }
  async function act(suggestionId: string, action: "approve" | "dismiss") {
    setErr(""); setBusy(suggestionId + action);
    try {
      const res = await fetch("/api/staff/auto-editor/suggestion-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggestionId, action }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed.");
      router.refresh();
    } catch (x: any) { setErr(x?.message || "Failed."); } finally { setBusy(null); }
  }

  const visible = e.suggestions.filter((s) => s.status !== "dismissed");
  return (
    <div style={{ marginTop: 10, borderTop: "1px solid var(--surface-card)", paddingTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>Edit suggestions</span>
        <button onClick={suggest} disabled={!!busy} style={{ marginLeft: "auto", border: "1px solid var(--hairline)", background: "transparent", borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "var(--ink-2)", cursor: "pointer" }}>
          {busy === "gen" ? "Thinking…" : visible.length ? "Re-suggest" : "Suggest edits"}
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 6 }}>{err}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {visible.map((s) => (
          <div key={s.id} style={{ background: "var(--surface-card)", border: "1px solid var(--surface-raised)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: SEV_COLOR[s.severity] }}>{s.severity}</span>
              <span style={{ fontSize: 12, color: "var(--ink-1)" }}>{s.summary}</span>
              {s.status === "approved" && <span style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: "auto" }}>✓ queued</span>}
            </div>
            {s.detail && <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 3 }}>{s.detail}</div>}
            {s.status === "proposed" && (
              <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                <button onClick={() => act(s.id, "approve")} disabled={!!busy} style={{ background: "var(--accent)", border: "none", borderRadius: 7, padding: "5px 11px", fontSize: 11, color: "var(--ink-1)", fontWeight: 700, cursor: "pointer" }}>
                  {busy === s.id + "approve" ? "…" : "Approve & auto-edit"}
                </button>
                <button onClick={() => act(s.id, "dismiss")} disabled={!!busy} style={{ background: "transparent", border: "1px solid var(--hairline)", borderRadius: 7, padding: "5px 11px", fontSize: 11, color: "var(--ink-3)", cursor: "pointer" }}>
                  {busy === s.id + "dismiss" ? "…" : "Dismiss"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {e.jobs.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {e.jobs.map((j) => (
            <span key={j.id} style={{ fontSize: 10, color: "var(--ink-3)", background: "var(--surface-card)", borderRadius: 6, padding: "3px 8px" }}>
              {j.type} · {j.status === "queued" ? "queued for the Edit Engine" : j.status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ e }: { e: Evl }) {
  const isVideo = e.media_type === "video";
  return (
    <div style={{ background: "var(--surface-card)", border: `1px solid ${e.is_top_pick ? "var(--surface-raised)" : "var(--surface-raised)"}`, borderRadius: 10, padding: 12, display: "flex", gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", flex: "none", background: "var(--surface-raised)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {e.file_url && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.file_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "var(--ink-1)" }}><path d="M8 5v14l11-7z" /></svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--ink-1)", textTransform: "capitalize" }}>{e.slot}</span>
          {e.is_top_pick && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", background: "var(--surface-raised)", borderRadius: 6, padding: "2px 7px" }}>TOP PICK{e.rank ? ` #${e.rank}` : ""}</span>}
          {e.is_preliminary && <span style={{ fontSize: 10, color: "var(--accent)", background: "var(--accent-dim)", borderRadius: 6, padding: "2px 7px" }}>PRELIMINARY · video</span>}
          {!e.compliance_pass && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--accent-dim)", borderRadius: 6, padding: "2px 7px" }}>BLOCKED</span>}
          <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 700, color: "var(--ink-1)" }}>{e.overall_score ?? "—"}</span>
        </div>
        {e.rationale && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{e.rationale}</div>}
        <Bars s={e.scores} />
        <Flags flags={e.compliance_flags} />
        {(e.is_top_pick || !e.compliance_pass || e.suggestions.length > 0) && <SuggestionsBlock e={e} />}
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
    <div style={{ borderTop: "1px solid var(--surface-card)", marginTop: 10, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-4)" }}>Auto editor</div>
        <button onClick={run} disabled={loading}
          style={{ marginLeft: "auto", background: "var(--accent)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "var(--ink-1)", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Scoring…" : initial.length ? "Re-run auto editor" : "Run auto editor"}
        </button>
      </div>
      {note && <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>{note}</div>}
      {error && <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 6 }}>{error}</div>}

      {initial.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {topPicks.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "var(--ink-4)" }}>Top picks</div>
              {topPicks.map((e) => <Card key={e.deliverable_id} e={e} />)}
            </>
          )}
          {others.length > 0 && (
            <>
              <button onClick={() => setShowOthers((v) => !v)} style={{ background: "transparent", border: "none", color: "var(--ink-3)", fontSize: 12, textAlign: "left", cursor: "pointer", padding: "2px 0" }}>
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
