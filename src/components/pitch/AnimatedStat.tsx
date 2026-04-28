"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated count-up for a stat value like "30K+", "100+", "8.6M".
 *
 * Parses the leading number from the string, animates from 0 up to it
 * when the element scrolls into view, then keeps any non-numeric
 * suffix appended (the "K+", "+", "M", etc.).
 *
 * Falls back to rendering the raw value if no leading number is found.
 */
export default function AnimatedStat({
  value,
  durationMs = 1500,
}: {
  value: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState<string>("");
  const startedRef = useRef(false);

  // Parse: leading digits / decimals / commas, then anything else.
  const match = value.match(/^([\d.,]+)(.*)$/);
  const targetNum = match ? parseFloat(match[1].replace(/,/g, "")) : NaN;
  const suffix = match ? match[2] : "";
  const hasDecimal = match ? /\./.test(match[1]) : false;
  const decimals = hasDecimal ? (match![1].split(".")[1].length) : 0;

  // Initial display before animation starts.
  useEffect(() => {
    if (!Number.isFinite(targetNum)) return;
    setDisplay(`0${decimals ? "." + "0".repeat(decimals) : ""}${suffix}`);
  }, [targetNum, suffix, decimals]);

  useEffect(() => {
    if (!Number.isFinite(targetNum)) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            animate();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    function animate() {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / durationMs, 1);
        // Ease-out cubic — fast at first, slows toward the end.
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = targetNum * eased;
        setDisplay(formatNumber(current, decimals) + suffix);
        if (progress < 1) requestAnimationFrame(tick);
        else setDisplay(formatNumber(targetNum, decimals) + suffix);
      };
      requestAnimationFrame(tick);
    }

    return () => observer.disconnect();
  }, [targetNum, suffix, decimals, durationMs]);

  // No numeric prefix → just render the raw value.
  if (!Number.isFinite(targetNum)) return <span>{value}</span>;

  return <span ref={ref}>{display || value}</span>;
}

function formatNumber(n: number, decimals: number): string {
  if (decimals > 0) {
    return n.toFixed(decimals);
  }
  // Integer with thousands separator.
  return Math.floor(n).toLocaleString("en-US");
}
