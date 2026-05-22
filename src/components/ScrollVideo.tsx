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
  // Append `#t=0.1` if there is no fragment yet — this tells the browser
  // to seek to 0.1s and paint that frame as a still, so cards don't
  // render as solid-black rectangles before the video starts playing.
  const posterSrc = src.includes("#") ? src : `${src}#t=0.1`;
  return <video ref={ref} muted loop playsInline preload="metadata" src={posterSrc} style={style} />;
}
