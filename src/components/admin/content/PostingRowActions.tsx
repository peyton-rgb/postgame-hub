"use client";

// Copy link + Mark sent for one athlete on the posting roster.
// Mark sent flips that athlete's draft posts to 'sent' through the
// existing staff API (PATCH /api/posting-packages/[id]), which stamps
// sent_at the first time — the same call the Hub roster makes.

import { useState } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "@/components/admin/CopyButton";

const LINK = "whitespace-nowrap text-[12px] font-medium text-[#D73F09] hover:underline disabled:opacity-40";

export default function PostingRowActions({ link, draftIds }: { link: string; draftIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function markSent() {
    setBusy(true);
    setErr(null);
    let failed = 0;
    for (const id of draftIds) {
      const res = await fetch(`/api/posting-packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      }).catch(() => null);
      if (!res || !res.ok) failed++;
    }
    setBusy(false);
    if (failed) setErr(`${failed} post${failed === 1 ? "" : "s"} didn't save`);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <CopyButton value={link} label="Copy link" className={LINK} />
      {draftIds.length > 0 && (
        <button type="button" disabled={busy} onClick={markSent} className={LINK}>
          {busy ? "Saving…" : "Mark sent"}
        </button>
      )}
      {err && <span className="text-[11px] text-status-bad">{err}</span>}
    </div>
  );
}
