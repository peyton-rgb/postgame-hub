"use client";

// ============================================================
// "Check readiness" — runs the recap readiness check for one campaign and
// shows the result inline.
//
// Calls POST /api/recap-readiness/[id], which runs the same checkRecap() the
// daily sweep runs and writes the same recap_readiness row. Pressing this is
// therefore not a preview: it is a recorded check, identical to the cron's.
//
// The Drive folder is read for its file list, so a press can take a second or
// two on a large folder. The button disables itself while in flight rather
// than letting a second press start a second Drive walk.
// ============================================================

import { useState } from "react";

interface Check {
  driveFileCount: number | null;
  hasTracker: boolean;
  hasBrief: boolean;
  mediaCount: number;
  tier3Count: number;
  ready: boolean;
  missing: string[];
  driveError: string | null;
}

export function ReadinessCheckButton({ recapId }: { recapId: string }) {
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/recap-readiness/${recapId}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `check failed (${res.status})`);
        setCheck(null);
        return;
      }
      setCheck(body.check as Check);
    } catch (e) {
      setError(e instanceof Error ? e.message : "check failed");
      setCheck(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="self-start rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Checking…" : "Check readiness"}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {check && (
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
          <p className={check.ready ? "font-semibold text-emerald-400" : "font-semibold text-amber-400"}>
            {check.ready ? "Ready for recap" : "Not ready"}
          </p>
          <ul className="mt-1.5 space-y-0.5 text-white/60">
            <li>
              Drive files:{" "}
              {check.driveFileCount == null
                ? check.driveError
                  ? "folder could not be read"
                  : "no folder linked"
                : check.driveFileCount}
            </li>
            <li>Media rows: {check.mediaCount}</li>
            <li>Athlete submissions: {check.tier3Count}</li>
            <li>Tracker sheet: {check.hasTracker ? "yes" : "no"}</li>
            <li>Brief doc: {check.hasBrief ? "yes" : "no"}</li>
          </ul>
          {!check.ready && check.missing.length > 0 && (
            <p className="mt-1.5 text-white/45">Missing: {check.missing.join("; ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
