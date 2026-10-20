// ============================================================
// CopyButton — copies a URL to the clipboard. Given a site-relative
// path it prefixes the browser's origin at click time, so server
// components can hand it a path without knowing the host.
// Copy only — nothing is sent anywhere.
// ============================================================

"use client";

import { useState } from "react";

export default function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  /** Absolute URL, or a site-relative path starting with "/". */
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const text = value.startsWith("/") ? `${window.location.origin}${value}` : value;
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "rounded-md border border-stone-300 px-2.5 py-1 text-[12px] font-medium text-stone-700 hover:border-stone-400"
      }
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : label}
    </button>
  );
}
