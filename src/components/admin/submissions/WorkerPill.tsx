// ============================================================
// WorkerPill — the office worker heartbeat indicator.
// Matches prototype workerPill():
//   ● Worker online (ok) / ● Worker offline (warn)
// ============================================================

import type { WorkerStatus } from "@/lib/admin/submissions/types";

export function WorkerPill({ worker }: { worker?: WorkerStatus }) {
  const isOnline = worker?.state === "online";
  const label = isOnline ? "● Worker online" : "● Worker offline";
  const title =
    "The office worker that moves files into LucidLink and makes review copies" +
    (worker?.lastSeen ? ` (last seen ${new Date(worker.lastSeen).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})` : "");

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium tracking-tight ${
        isOnline
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}
    >
      {label}
    </span>
  );
}
