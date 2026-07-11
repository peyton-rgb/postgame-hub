"use client";

// Reusable bottom sheet for the athlete app (matches postgame-app.html sheets:
// dark slide-up panel, grab handle, tap-scrim-to-dismiss). No such component
// existed, so this is the shared primitive for Profile/Earnings sheets.

import { useEffect } from "react";

export default function AthleteSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="a-sheetwrap" onClick={onClose}>
      <div className="a-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="a-sheet-grab" />
        {title && <div className="a-sheet-title">{title}</div>}
        {subtitle && <div className="a-sheet-sub">{subtitle}</div>}
        <div style={{ marginTop: title || subtitle ? 16 : 0 }}>{children}</div>
        <div className="a-sheet-cancel" onClick={onClose}>Close</div>
      </div>
    </div>
  );
}
