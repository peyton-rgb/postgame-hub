// src/app/api/slack/recap/resume/route.ts
// ─────────────────────────────────────────────────────────────
// Restart recap builds that have gone quiet.
//
// The build worker finishes a big recap in ~3-minute chunks, each one handing
// off to the next by calling itself. Vercel blocks long self-call chains with
// a 508 ("loop detected"), which strands the build mid-way. This sweeper finds
// any request still "building" whose heartbeat is older than STALE_MS and
// kicks the content phase again. A cron call starts a fresh chain, so Vercel
// allows it; the worker carries on from content_tried (nothing is redone).
//
//   Cron:   every 2 minutes (vercel.json), Authorization: Bearer CRON_SECRET
//   Manual: open /api/slack/recap/resume in a browser while logged in to the
//           Hub as staff (add ?force=1 to skip the staleness wait)
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { getHubStaff } from "@/lib/staff-auth";
import { workerAuthorized } from "@/lib/slack-recap/api";
import { kickWorker } from "@/lib/slack-recap/worker";

export const dynamic = "force-dynamic";
// Never serve this route's database reads from Next's data cache: a cached
// "still building" answer made the sweeper restart the same recap forever.
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** A healthy chunk saves progress at least every ~4 minutes. */
const STALE_MS = 6 * 60 * 1000;

export async function GET(req: Request) {
  const fromCron = !!process.env.CRON_SECRET && workerAuthorized(req);
  if (!fromCron) {
    const staff = await getHubStaff();
    if (!staff.ok) return text("Log in to the Hub as staff first, then open this link again.", 401);
  }
  const force = new URL(req.url).searchParams.get("force") === "1";

  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("campaign_recaps")
    .select("id, name, settings")
    .eq("settings->recap_request->>status", "building");

  const now = Date.now();
  const resumed: string[] = [];
  const skipped: string[] = [];
  for (const row of (data as { id: string; name: string; settings: any }[]) || []) {
    const state = row.settings?.recap_request || {};
    if (state.status !== "building") continue; // belt and braces on the query filter
    // The data phase (tracker import) hasn't finished yet — it runs in the
    // first chunk and is never handed off, so leave it alone.
    if (!Array.isArray(state.content_tried)) {
      skipped.push(`${row.name} (still importing the tracker)`);
      continue;
    }
    const last = Date.parse(state.heartbeat_at || state.requested_at || "") || 0;
    if (!force && now - last < STALE_MS) {
      skipped.push(`${row.name} (still running)`);
      continue;
    }
    const ok = await kickWorker({ recapId: row.id, phase: "content" });
    (ok ? resumed : skipped).push(ok ? row.name : `${row.name} (worker refused)`);
  }

  if (resumed.length) console.log("[slack-recap/resume] resumed:", resumed.join(", "));
  return text(
    resumed.length || skipped.length
      ? `Resumed: ${resumed.join(", ") || "none"}\nSkipped: ${skipped.join(", ") || "none"}`
      : "No recap builds in progress.",
  );
}

function text(msg: string, status = 200) {
  return new NextResponse(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
