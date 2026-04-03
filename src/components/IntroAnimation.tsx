"use client";
import { useEffect, useState } from "react";

export default function IntroAnimation() {
  const [phase, setPhase] = useState<"intro"|"exit"|"done">("intro");

  useEffect(() => {
    // Pan light for 1.4s, then start exit
    const t1 = setTimeout(() => setPhase("exit"), 1400);
    // Remove from DOM after exit animation
    const t2 = setTimeout(() => setPhase("done"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "done") return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: phase === "exit" ? 0 : 1,
      transition: phase === "exit" ? "opacity 0.8s ease" : "none",
      pointerEvents: phase === "exit" ? "none" : "all",
    }}>
      <style>{`
        @keyframes panLight {
          0%   { transform: translateX(-140%) skewX(-15deg); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateX(140%) skewX(-15deg); opacity: 0; }
        }
        @keyframes logoFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .intro-logo {
          animation: logoFadeIn 0.5s ease 0.1s both;
        }
        .intro-light {
          animation: panLight 1.2s ease 0.2s both;
        }
      `}</style>

      {/* Logo container */}
      <div className="intro-logo" style={{ position: "relative", display: "inline-block" }}>
        <img
          src="/postgame-logo.png"
          alt="Postgame"
          style={{ height: 48, width: "auto", display: "block", filter: "brightness(1)" }}
        />

        {/* Orange light sweep */}
        <div className="intro-light" style={{
          position: "absolute",
          inset: "-60% -20%",
          background: "linear-gradient(105deg, transparent 30%, rgba(215,63,9,0.0) 38%, rgba(215,63,9,0.9) 50%, rgba(255,120,40,0.6) 55%, transparent 65%)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }} />

        {/* Subtle glow behind logo */}
        <div style={{
          position: "absolute",
          inset: "-100%",
          background: "radial-gradient(ellipse at center, rgba(215,63,9,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
          animation: "logoFadeIn 0.5s ease 0.1s both",
        }} />
      </div>
    </div>
  );
}
