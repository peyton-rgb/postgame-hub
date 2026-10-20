"use client";

// ============================================================
// Athletes page: pick athletes → make an audience or download a CSV
// (the prototype's pick bar). The table's checkboxes are plain
// server-rendered inputs (class "pick", data-id, data-h); this bar
// listens for their change events, so the table stays server-rendered.
//
// "Select all" on the header box means everyone matching the current
// filters, not just this page: the CSV and the audience then carry
// the filters instead of a list of ids.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function PickAll() {
  return <input type="checkbox" id="pickAll" aria-label="Select all athletes" className="h-3.5 w-3.5 accent-[#D73F09]" />;
}

export function PickBox({ id, handle, name }: { id: string; handle: string | null; name: string }) {
  return (
    <input
      type="checkbox"
      className="pick h-3.5 w-3.5 accent-[#D73F09]"
      data-id={id}
      data-h={handle ?? ""}
      aria-label={`Select ${name}`}
    />
  );
}

export default function PickBar({
  total,
  exportBase,
  filterAudienceHref,
}: {
  /** athletes matching the current filters */
  total: number;
  /** /admin/athletes/export?<current filters> */
  exportBase: string;
  /** /admin/audiences/new?<filters mapped to audience params> */
  filterAudienceHref: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<{ ids: string[]; handles: string[]; all: boolean }>({ ids: [], handles: [], all: false });

  useEffect(() => {
    const read = () => {
      const boxes = Array.from(document.querySelectorAll<HTMLInputElement>("input.pick"));
      const on = boxes.filter((b) => b.checked);
      const allBox = document.getElementById("pickAll") as HTMLInputElement | null;
      setPicked({
        ids: on.map((b) => b.dataset.id ?? "").filter(Boolean),
        handles: on.map((b) => b.dataset.h ?? "").filter(Boolean),
        all: !!allBox?.checked && on.length === boxes.length && boxes.length > 0,
      });
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.id === "pickAll") {
        document.querySelectorAll<HTMLInputElement>("input.pick").forEach((b) => (b.checked = t.checked));
      } else if (t.classList?.contains("pick") && !t.checked) {
        const allBox = document.getElementById("pickAll") as HTMLInputElement | null;
        if (allBox) allBox.checked = false;
      } else if (!t.classList?.contains("pick")) return;
      read();
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  const clear = () => {
    document.querySelectorAll<HTMLInputElement>("input.pick, #pickAll").forEach((b) => (b.checked = false));
    setPicked({ ids: [], handles: [], all: false });
  };

  const n = picked.all ? total : picked.ids.length;
  if (n === 0) return null;

  const sep = exportBase.includes("?") ? "&" : "?";
  const csvHref = picked.all ? exportBase : `${exportBase}${sep}ids=${picked.ids.join(",")}`;
  const audHref = picked.all ? filterAudienceHref : `/admin/audiences/new?handles=${encodeURIComponent(picked.handles.join("|"))}&picked=${picked.ids.length}`;
  const missingHandles = picked.all ? 0 : picked.ids.length - picked.handles.length;

  return (
    <div
      role="region"
      aria-label="Selected athletes"
      className="fixed inset-x-3 bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-[13px] shadow-lg md:left-auto md:right-6 md:max-w-[640px]"
    >
      <span className="rounded-full bg-[#D73F09] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white">
        {n.toLocaleString("en-US")}
      </span>
      <span className="text-stone-700">
        {picked.all ? "athletes selected · everyone matching your filters" : n === 1 ? "athlete selected" : "athletes selected"}
        {missingHandles > 0 && <span className="text-stone-500"> · {missingHandles} without an Instagram can&apos;t go in an audience</span>}
      </span>
      <button type="button" onClick={clear} className="text-[12px] font-medium text-stone-500 hover:text-stone-800">
        Clear
      </button>
      <span className="ml-auto flex gap-2">
        <a href={csvHref} className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 hover:border-stone-400">
          Download CSV
        </a>
        <button
          type="button"
          onClick={() => router.push(audHref)}
          className="rounded-md bg-[#D73F09] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#B33407]"
        >
          + Make an audience
        </button>
      </span>
    </div>
  );
}
