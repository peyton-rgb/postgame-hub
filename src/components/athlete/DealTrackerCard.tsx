// Deal tracker card (mockup screen 4): brand header, status pill, and the
// 6-step progress rail. Presentational; links into the deal detail.

import Link from "next/link";
import { TRACKER_STEPS, type DealStage } from "@/lib/deliverable-status";

function pillStyle(kind: "due" | "ok" | "neutral"): React.CSSProperties {
  if (kind === "ok") return { background: "rgba(52,199,89,0.16)", color: "var(--a-green)" };
  if (kind === "due") return { background: "rgba(215,63,9,0.18)", color: "var(--a-orange-soft)" };
  return { background: "rgba(255,255,255,0.12)", color: "rgba(250,248,245,0.7)" };
}

export default function DealTrackerCard({
  optinId,
  brandName,
  brandLogo,
  title,
  stage,
}: {
  optinId: string;
  brandName: string | null;
  brandLogo: string | null;
  title: string;
  stage: DealStage;
}) {
  return (
    <Link href={`/athlete/my-deals/${optinId}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div className="a-card" style={{ textAlign: "left", padding: 15 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
          {brandLogo && (
            <div style={{ background: "rgba(255,255,255,0.94)", borderRadius: 7, padding: "5px 8px", display: "flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandLogo} alt={brandName || "brand"} style={{ height: 13 }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--a-off)" }}>{brandName}</div>
            <div style={{ fontSize: 11, color: "rgba(250,248,245,0.55)" }}>{title}</div>
          </div>
          <div className="a-pill" style={pillStyle(stage.pill.kind)}>{stage.pill.text}</div>
        </div>

        <div className="a-track">
          {TRACKER_STEPS.map((step, i) => {
            const done = i <= stage.doneThrough;
            const current = i === stage.currentStep && !done;
            const dotClass = done ? "done" : current ? "current" : "next";
            return (
              <div key={i} className={`a-step${done ? " done" : ""}`}>
                <div className={`a-dot ${dotClass}`}>
                  {done && (
                    <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: "#fff", strokeWidth: 3, fill: "none" }}>
                      <path d="M5 12.5l4 4 9-10" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: done || current ? "var(--a-off)" : "rgba(250,248,245,0.55)" }}>{step.label}</div>
                  <div style={{ fontSize: 11, color: current ? "var(--a-orange-soft)" : "rgba(250,248,245,0.5)" }}>{step.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
