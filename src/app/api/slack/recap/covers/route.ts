// src/app/api/slack/recap/covers/route.ts
// ─────────────────────────────────────────────────────────────
// Re-pick the video covers of an already-built recap with the AI cover picker
// (src/lib/slack-recap/covers.ts). Only thumbnail_url changes.
//
//   GET /api/slack/recap/covers?campaign=930                 — every video
//   GET /api/slack/recap/covers?campaign=930&athlete=Skylar  — one athlete (smoke test)
//
// `campaign` is the admin campaign id; `recap` (the campaign_recaps uuid) also
// works. Open in a browser while logged in to the Hub as staff. The work runs
// in the background; Peyton gets a Slack DM when it's done.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { getHubStaff } from "@/lib/staff-auth";
import { writeRequestState } from "@/lib/slack-recap/build";
import { kickWorker } from "@/lib/slack-recap/worker";

export const dynamic = "force-dynamic";

const text = (msg: string, status = 200) =>
  new NextResponse(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const staff = await getHubStaff();
  if (!staff.ok) return text("Log in to the Hub as staff first, then open this link again.", 401);

  const url = new URL(req.url);
  const recapParam = url.searchParams.get("recap");
  const campaignParam = url.searchParams.get("campaign");
  const athleteParam = (url.searchParams.get("athlete") || "").trim().toLowerCase();

  const supabase = createServiceSupabase();
  let q = supabase.from("campaign_recaps").select("id, name");
  if (recapParam) q = q.eq("id", recapParam);
  else if (campaignParam) q = q.eq("admin_campaign_id", campaignParam);
  else return text("Add ?campaign=<admin campaign id> to the link.", 400);
  const { data: recap } = await q.maybeSingle();
  if (!recap) return text("No recap found for that campaign.", 404);

  const [{ data: media }, { data: athletes }] = await Promise.all([
    supabase.from("media").select("id, athlete_id").eq("campaign_id", recap.id).eq("type", "video"),
    supabase.from("athletes").select("id, name").eq("campaign_id", recap.id),
  ]);
  const videos = (media as { id: string; athlete_id: string | null }[]) || [];
  if (videos.length === 0) return text(`${recap.name} has no videos yet.`);

  // Marking every other video as already done limits the run to one athlete.
  let skip: string[] = [];
  let scope = `all ${videos.length} videos`;
  if (athleteParam) {
    const match = ((athletes as { id: string; name: string }[]) || []).filter((a) =>
      String(a.name || "").toLowerCase().includes(athleteParam),
    );
    const ids = new Set(match.map((a) => a.id));
    const mine = videos.filter((v) => v.athlete_id && ids.has(v.athlete_id));
    if (mine.length === 0) return text(`No video found for an athlete matching "${athleteParam}".`, 404);
    skip = videos.filter((v) => !mine.includes(v)).map((v) => v.id);
    scope = `${mine.length} video(s) for ${match.map((a) => a.name.trim()).join(", ")}`;
  }

  await writeRequestState(recap.id, { covers_done: skip });
  const accepted = await kickWorker({ recapId: recap.id, phase: "covers" });
  if (!accepted) return text("The background worker didn't start. Send this message to Claude.", 502);
  return text(`Re-picking covers for ${recap.name}: ${scope}. You'll get a Slack DM when it's done. You can close this tab.`);
}
