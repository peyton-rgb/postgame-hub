"use client";

// ============================================================
// <VerticalHeroChoiceModal>
//
// Opens when an editor picks a VERTICAL video clip for a hero slot.
// Two-screen flow:
//
//   Screen 1 (choose):    "Keep vertical"  /  "Make widescreen"
//   Screen 2 (preview):   side-by-side Blur vs Mirror demo videos
//                          → click to pick → click Render → blocking spinner
//                          → fires onChoice({ source:"rendered", look, rendered_url })
//
// Demo videos live at /hero-look-previews/{blur,mirror}.mp4 (baked into /public).
// On confirm, calls requestHeroRender() — instant if cached, ~80s if fresh,
// but cold-starts can stretch to a few minutes (Fly machine wake-up).
// Backdrop click / Esc only cancels when NOT rendering (no half-saved state).
//
// Z-index 10100 sits above CampaignMediaPicker (10000).
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { requestHeroRender, type HeroLook } from "@/lib/hero-render";

export type VerticalHeroChoice =
  | { source: "original" }
  | { source: "rendered"; look: HeroLook; rendered_url: string };

export interface VerticalHeroChoiceModalProps {
  open: boolean;
  sourceUrl: string;
  /** media.id when available; undefined falls back to server-side hash(url). */
  mediaId?: string;
  /** Optional small label for context, e.g. "Ashley Ladner · STATsports". */
  clipLabel?: string;
  onCancel: () => void;
  onChoice: (choice: VerticalHeroChoice) => void;
}

type Screen = "choose" | "preview" | "rendering" | "error";

const C = {
  orange: "#D73F09",
  surface: "#1a1a1a",
  border: "rgba(255,255,255,0.1)",
  text: "#fff",
  text2: "rgba(255,255,255,0.7)",
  text3: "rgba(255,255,255,0.45)",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.82)",
  zIndex: 10100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial, sans-serif",
  padding: 24,
};

const card: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  maxWidth: 820,
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: 28,
  color: C.text,
  position: "relative",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 24px",
  background: C.orange,
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "12px 24px",
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text2,
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
};

const choiceCard = (active: boolean): React.CSSProperties => ({
  flex: 1,
  background: active ? "rgba(215,63,9,0.08)" : "#111",
  border: `2px solid ${active ? C.orange : "rgba(255,255,255,0.08)"}`,
  borderRadius: 12,
  padding: 16,
  cursor: "pointer",
  transition: "border-color 0.15s, background 0.15s",
  display: "flex",
  flexDirection: "column",
  gap: 10,
});

export default function VerticalHeroChoiceModal({
  open,
  sourceUrl,
  mediaId,
  clipLabel,
  onCancel,
  onChoice,
}: VerticalHeroChoiceModalProps) {
  const [screen, setScreen] = useState<Screen>("choose");
  const [selectedLook, setSelectedLook] = useState<HeroLook>("blur");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset every time the modal opens fresh.
  useEffect(() => {
    if (open) {
      setScreen("choose");
      setSelectedLook("blur");
      setErrorMsg(null);
    }
  }, [open]);

  // Esc to cancel — but ONLY when not rendering, to avoid losing in-flight work.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && screen !== "rendering") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, screen, onCancel]);

  const runRender = useCallback(async () => {
    setScreen("rendering");
    setErrorMsg(null);
    try {
      // mediaId is optional in the type, but the API requires _something_ for a cache key.
      // If we don't have one client-side, the server hashes the sourceUrl instead.
      const result = await requestHeroRender({
        mediaId: mediaId ?? "",
        sourceUrl,
        look: selectedLook,
      });
      onChoice({ source: "rendered", look: selectedLook, rendered_url: result.rendered_url });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setScreen("error");
    }
  }, [mediaId, sourceUrl, selectedLook, onChoice]);

  if (!open) return null;

  const handleBackdrop = () => {
    if (screen !== "rendering") onCancel();
  };

  return (
    <div style={overlay} onClick={handleBackdrop}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        {/* Screen 1 — choose source */}
        {screen === "choose" && (
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
              This is a vertical clip
            </h3>
            <p style={{ fontSize: 14, color: C.text2, margin: "0 0 4px" }}>
              Heroes are widescreen by default. Pick how this clip should play.
            </p>
            {clipLabel && (
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 18 }}>{clipLabel}</div>
            )}

            <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
              <button
                style={choiceCard(false)}
                onClick={() => onChoice({ source: "original" })}
              >
                <div style={{ fontSize: 15, fontWeight: 800 }}>Keep vertical</div>
                <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                  Plays as-is in the page&rsquo;s vertical hero layout. No rendering, instant.
                </div>
              </button>

              <button
                style={choiceCard(false)}
                onClick={() => setScreen("preview")}
              >
                <div style={{ fontSize: 15, fontWeight: 800 }}>Make widescreen</div>
                <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                  Re-render to 16:9 with a side-fill (blur or mirror). One-time render, then cached.
                </div>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <button style={secondaryBtn} onClick={onCancel}>Cancel</button>
            </div>
          </div>
        )}

        {/* Screen 2 — pick a look */}
        {screen === "preview" && (
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
              Pick a side-fill look
            </h3>
            <p style={{ fontSize: 13, color: C.text2, margin: "0 0 18px" }}>
              The center of the frame is always the untouched original. The sides differ.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {(["blur", "mirror"] as HeroLook[]).map((look) => {
                const active = selectedLook === look;
                return (
                  <button
                    key={look}
                    style={choiceCard(active)}
                    onClick={() => setSelectedLook(look)}
                  >
                    <video
                      src={`/hero-look-previews/${look}.mp4`}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      style={{
                        width: "100%",
                        aspectRatio: "16/9",
                        objectFit: "cover",
                        borderRadius: 8,
                        background: "#000",
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, textTransform: "capitalize" }}>{look}</span>
                      {active && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: C.orange, letterSpacing: "0.08em" }}>
                          SELECTED
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, gap: 10 }}>
              <button style={secondaryBtn} onClick={() => setScreen("choose")}>← Back</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={secondaryBtn} onClick={onCancel}>Cancel</button>
                <button style={primaryBtn} onClick={runRender}>
                  Render
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Screen 3 — rendering */}
        {screen === "rendering" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div
              aria-hidden
              style={{
                width: 48,
                height: 48,
                border: `3px solid rgba(255,255,255,0.12)`,
                borderTopColor: C.orange,
                borderRadius: "50%",
                margin: "0 auto 18px",
                animation: "pgHeroSpin 0.9s linear infinite",
              }}
            />
            <style>{`@keyframes pgHeroSpin { to { transform: rotate(360deg); } }`}</style>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>
              Rendering widescreen version
            </h3>
            <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
              This can take up to a few minutes if the renderer is waking up &mdash; don&rsquo;t close this window.
              The render uploads to Storage when it finishes.
            </p>
          </div>
        )}

        {/* Screen 4 — error */}
        {screen === "error" && (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px", color: "#ff6b6b" }}>
              Render failed
            </h3>
            <p
              style={{
                fontSize: 13,
                color: C.text2,
                background: "#111",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 12,
                margin: "0 0 18px",
                wordBreak: "break-word",
              }}
            >
              {errorMsg}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={secondaryBtn} onClick={onCancel}>Cancel</button>
              <button style={primaryBtn} onClick={runRender}>Try again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
