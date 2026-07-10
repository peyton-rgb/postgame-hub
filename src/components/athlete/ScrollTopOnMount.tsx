"use client";

import { useEffect } from "react";

// The athlete feed must always open at the very top with the sticky header
// (logo + bell) visible. On iOS Safari the login→feed redirect can land the
// view already scrolled just past the sticky header — the browser restores a
// scroll offset and/or the viewport-fit=cover safe-area padding is applied a
// beat after first paint. Force scroll-to-top on mount (immediately and on the
// next frame, to catch the late safe-area layout shift).
export default function ScrollTopOnMount() {
  useEffect(() => {
    const toTop = () => window.scrollTo(0, 0);
    toTop();
    const raf = requestAnimationFrame(toTop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
