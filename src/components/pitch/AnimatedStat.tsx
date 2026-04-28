"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated count-up + fade-in for a stat value like "30K+", "100+", "8.6M".
 *
 * Behavior:
 *  - Parses the leading number from the string and keeps any non-numeric
 *    suffix appended (the "K+", "+", "M", etc.).
 *  - When the element scrolls into view (40% threshold), it fades + rises
 *    in over 700ms AND counts the number up from 0 to the target over
 *    `durationMs`. Easing is ease-out quart so the count slows smoothly
 *    into its final value.
 *  - Falls back to rendering the raw value if no leading number is found.
 */
export default function AnimatedStat({
  value,
  durationMs = 2500,
}: {
  value: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const startedRef = useRef(false);
  const [display, setDisplay] = useState<string>("");
  const [visible, setVisible] = useState(false);

  // Parse: leading digits / decimals / commas, then anything else.
  const match = value.match(/^([\d.,]+)(.*)$/);
  const targetNum = match ? parseFloat(match[1].replace(/,/g, "")) : NaN;
  const suffix = match ? match[2] : "";
  const decimals =
    match && /\./.test(match[1]) ? match[1].split(".")[1].length : 0;

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
            setVisible(true);          // triggers fade-in via CSS transition
            animate();                 // simultaneously starts count-up
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
        // Ease-out quart — smoother landing than cubic; the number
        // slows gracefully into its final value.
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = targetNum * eased;
        setDisplay(formatNumber(current, decimals) + suffix);
        if (progress < 1) requestAnimationFrame(tick);
        else setDisplay(formatNumber(targetNum, decimals) + suffix);
      };
      requestAnimationFrame(tick);
    }

    return () => observer.disconnect();
  }, [targetNum, suffix, decimals, durationMs]);

  // No numeric prefix → render the raw value, no animation.
  if (!Number.isFinite(targetNum)) return <span>{value}</span>;

  return (
    <span
      ref={ref}
      style={{
        display: "inline-block",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition:
          "opacity 700ms ease-out, transform 700ms ease-out",
        willChange: "opacity, transform",
      }}
    >
      {display || value}
    </span>
  );
}

function formatNumber(n: number, decimals: number): string {
  if (decimals > 0) return n.toFixed(decimals);
  return Math.floor(n).toLocaleString("en-US");
}
