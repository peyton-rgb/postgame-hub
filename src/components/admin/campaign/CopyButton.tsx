// ============================================================
// Copy-to-clipboard text button ("Copy" on links and paths).
// ============================================================

"use client";

import { useState } from "react";

export default function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={"text-[13px] font-medium text-[#D73F09] hover:underline " + className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Copy this:", value);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
