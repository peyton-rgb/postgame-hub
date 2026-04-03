"use client";
import { useEffect, useState } from "react";

export default function IntroAnimation() {
  const [phase, setPhase] = useState<"in"|"hold"|"exit"|"done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);   // icon in
    const t2 = setTimeout(() => setPhase("exit"), 2000);  // start exit
    const t3 = setTimeout(() => setPhase("done"), 2800);  // unmount
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
          0%   { opacity: 0; transform: scale(0.4) rotate(-20deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes iconPulse {
          0%, 100% { box-shadow: 0 0 0px 0px rgba(215,63,9,0); }
          50%       { box-shadow: 0 0 80px 40px rgba(215,63,9,0.35); }
        }
        @keyframes glowRing {
          0%   { transform: scale(0.8); opacity: 0; }
          40%  { opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes logoIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes panLight {
          0%   { transform: translateX(-180%) skewX(-12deg); }
          100% { transform: translateX(180%) skewX(-12deg); }
        }
        .intro-icon-wrap {
          animation: iconIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;
        }
        .intro-icon-img {
          animation: iconPulse 1.2s ease 0.7s infinite;
          border-radius: 50%;
        }
        .intro-glow-ring {
          position: absolute;
          inset: -10%;
          border-radius: 50%;
          border: 2px solid rgba(215,63,9,0.5);
          animation: glowRing 1.0s ease 0.65s infinite;
        }
        .intro-glow-ring-2 {
          position: absolute;
          inset: -10%;
          border-radius: 50%;
          border: 1px solid rgba(215,63,9,0.3);
          animation: glowRing 1.0s ease 0.95s infinite;
        }
        .intro-logo-wrap {
          animation: logoIn 0.5s ease 0.85s both;
          position: relative;
          overflow: hidden;
        }
        .intro-light-sweep {
          position: absolute;
          inset: "-40% -30%";
          top: -40%; bottom: -40%; left: -30%; right: -30%;
          background: linear-gradient(105deg, transparent 30%, rgba(215,63,9,0.0) 40%, rgba(215,63,9,0.7) 50%, rgba(255,100,20,0.4) 57%, transparent 68%);
          animation: panLight 0.8s ease 1.1s both;
          mix-blend-mode: screen;
        }
      `}</style>

      {/* Icon */}
      <div className="intro-icon-wrap" style={{ position: "relative", width: 80, height: 80 }}>
        <div className="intro-glow-ring" />
        <div className="intro-glow-ring-2" />
        <img
          src="/plus.png"
          alt=""
          className="intro-icon-img"
          style={{ width: 80, height: 80, display: "block", position: "relative", zIndex: 1 }}
        />
      </div>

      {/* Logo */}
      <div className="intro-logo-wrap">
        <img src="/postgame-logo.png" alt="Postgame" style={{ height: 36, width: "auto", display: "block" }} />
        <div className="intro-light-sweep" />
      </div>
    </div>
  );
}
