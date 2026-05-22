"use client";
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
export default function ScrollVideo({ src, style, scrollTrigger = true }: { src: string; style?: CSSProperties; scrollTrigger?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (!scrollTrigger || !("IntersectionObserver" in window)) { v.play().catch(() => {}); return; }
    const io = new IntersectionObserver(([e]) => { e.isIntersecting ? v.play().catch(() => {}) : v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [scrollTrigger]);
  return <video ref={ref} muted loop playsInline preload="metadata" src={src} style={style} />;
}
