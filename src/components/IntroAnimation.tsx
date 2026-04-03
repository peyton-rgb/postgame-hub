"use client";
import { useEffect, useState } from "react";

// Orange plus icon - matches your brand asset
const PLUS_ICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23D73F09'/><rect x='42' y='18' width='16' height='64' rx='4' fill='white'/><rect x='18' y='42' width='64' height='16' rx='4' fill='white'/></svg>`;

export default function IntroAnimation() {
  const [phase, setPhase] = useState<"in"|"hold"|"exit"|"done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("exit"), 2200);
    const t3 = setTimeout(() => setPhase("done"), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === "done") return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 32,
      opacity: phase === "exit" ? 0 : 1,
      transition: phase === "exit" ? "opacity 0.8s ease" : "none",
      pointerEvents: "none",
    }}>
      <style>{`
        @keyframes iconIn {
          0%   { opacity: 0; transform: scale(0.3) rotate(-30deg); }
          60%  { opacity: 1; transform: scale(1.1) rotate(6deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.6); }
        }
        @keyframes ringExpand {
          0%   { transform: scale(0.9); opacity: 0.8; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        @keyframes logoIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lightSweep {
          0%   { transform: translateX(-200%) skewX(-15deg); }
          100% { transform: translateX(200%) skewX(-15deg); }
        }
        .intro-icon-wrap { animation: iconIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.15s both; }
        .intro-pulse {
          position: absolute; inset: -15%; border-radius: 50%;
          background: radial-gradient(circle, rgba(215,63,9,0.6) 0%, transparent 70%);
          animation: pulseGlow 1.4s ease 0.8s infinite;
          pointer-events: none;
        }
        .intro-ring {
          position: absolute; inset: -5%; border-radius: 50%;
          border: 2px solid rgba(215,63,9,0.7);
          animation: ringExpand 1.1s ease 0.75s infinite;
          pointer-events: none;
        }
        .intro-ring-2 {
          position: absolute; inset: -5%; border-radius: 50%;
          border: 1.5px solid rgba(255,100,30,0.4);
          animation: ringExpand 1.1s ease 1.05s infinite;
          pointer-events: none;
        }
        .intro-logo-wrap { position: relative; overflow: hidden; animation: logoIn 0.55s ease 0.9s both; }
        .intro-sweep {
          position: absolute; top: -50%; bottom: -50%; left: -50%; right: -50%;
          background: linear-gradient(105deg, transparent 30%, rgba(215,63,9,0) 38%, rgba(215,63,9,0.85) 50%, rgba(255,120,40,0.5) 57%, transparent 66%);
          mix-blend-mode: screen;
          animation: lightSweep 0.75s ease 1.15s both;
          pointer-events: none;
        }
      `}</style>

      <div className="intro-icon-wrap" style={{ position: "relative", width: 96, height: 96 }}>
        <div className="intro-pulse" />
        <div className="intro-ring" />
        <div className="intro-ring-2" />
        <img src={PLUS_ICON} alt="" style={{ width: 96, height: 96, display: "block", position: "relative", zIndex: 1, borderRadius: "50%" }} />
      </div>

      <div className="intro-logo-wrap">
        <img src="/postgame-logo.png" alt="Postgame" style={{ height: 38, width: "auto", display: "block" }} />
        <div className="intro-sweep" />
      </div>
    </div>
  );
}
