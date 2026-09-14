"use client";

import { useEffect, useRef, useState } from "react";

export default function AnimateIn({ children, className = "anim-fade-up", as: Tag = "div", style, ...props }: {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  style?: React.CSSProperties;
  [key: string]: any;
}) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
      // Was rootMargin -40px, which DELAYED the reveal until the element was
      // 40px inside the viewport, on top of a 550ms transition. Now it fires
      // slightly early so content is up within 300ms of arriving.
    }, { threshold: 0.1, rootMargin: "0px 0px 15% 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    // @ts-expect-error dynamic tag
    <Tag ref={ref} className={className + (inView ? " in-view" : "")} style={style} {...props}>
      {children}
    </Tag>
  );
}
