/**
 * Recap intake cron — polls the Slack "Recap Queue List", validates each request
 * against the pstgm admin campaign cache, and for each one decides:
 *   CREATE  → draft campaign_recaps row (+ tracker import, zero-hero-off) + Slack confirm
 *   SKIP    → a recap already exists for this admin_campaign_id
 *   FLAG    → missing/unknown id, mis-filed name, dup, or nothing to build → Slack + skip
 *
 * Scheduled every 10 min via vercel.json. Guarded by CRON_SECRET.
 *
 * Manual runs:
 *   /api/cron/recap-intake?campaign_id=921&dry_run=1   → preview (writes nothing)
 *   /api/cron/recap-intake?dry_run=1                   → full disposition list, no writes
 *   /api/cron/recap-intake?campaign_id=921             → process that row for real
 */
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getRecapQueue, type RecapRequest } from "@/lib/slack-recap-queue";
import {
  buildRecapPlan,
  loadIntakeContext,
  commitRecap,
  postRecapConfirmation,
  postFlagOnce,
  type RecapPlan,
} from "@/lib/recap-intake";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Vercel cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  // No secret configured: allow in local dev only. Fail CLOSED in production so a
  // missing CRON_SECRET can never leave this write-capable endpoint open.
  return process.env.NODE_ENV !== "production";
}

function planPreview(plan: RecapPlan) {
  return {
    campaignId: plan.campaignId,
    slackName: plan.slackName,
    slackBrand: plan.slackBrand,
    disposition: plan.disposition,
    skipReason: plan.skipReason,
    flagReasons: plan.flagReasons,
    warnings: plan.warnings,
    admin: plan.admin,
    fuzzyExisting: plan.fuzzyExisting,
    name: plan.name,
    brand: plan.brand,
    slug: plan.slug,
    driveFolderId: plan.driveFolderId,
    tracker: plan.tracker
      ? { ok: plan.tracker.ok, reason: plan.tracker.reason, exportUrl: plan.tracker.exportUrl, gid: plan.tracker.gid, athleteCount: plan.athleteCount }
      : undefined,
    hiddenHeroes: plan.hiddenHeroes,
    heroValues: plan.heroValues,
    recapInsert: plan.recapInsert,
    athletesSample: plan.athletes?.slice(0, 5),
    athletesTotal: plan.athletes?.length,
  };
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const singleId = url.searchParams.get("campaign_id") || undefined;
  const supabase = createServiceSupabase();

  let queue: RecapRequest[];
  let ctx;
  try {
    const [{ requests }, loaded] = await Promise.all([getRecapQueue(), loadIntakeContext(supabase)]);
    queue = requests;
    ctx = loaded;
  } catch (e: any) {
    return NextResponse.json({ error: `queue/context load failed: ${String(e?.message || e)}` }, { status: 500 });
  }

  // ── Select candidates ──
  const completedSkips: { campaignId?: string; name: string }[] = [];
  let candidates: RecapRequest[];
  if (singleId) {
    const match = queue.find((r) => r.campaignId === singleId);
    if (!match) return NextResponse.json({ error: `campaign_id ${singleId} not found in the Recap Queue List` }, { status: 404 });
    candidates = [match];
  } else {
    candidates = [];
    for (const r of queue) {
      if (r.completed) { completedSkips.push({ campaignId: r.campaignId, name: r.campaignName }); continue; }
      candidates.push(r);
    }
  }

  // ── Dry run: assess + preview every candidate, write nothing ──
  if (dryRun) {
    const plans = [];
    for (const r of candidates) plans.push(planPreview(await buildRecapPlan(supabase, r, ctx, { forceBuild: true })));
    const tally = plans.reduce((acc: Record<string, number>, p) => { acc[p.disposition] = (acc[p.disposition] || 0) + 1; return acc; }, {});
    return NextResponse.json({
      dryRun: true,
      mode: singleId ? "single" : "cron",
      candidateCount: candidates.length,
      completedSkipped: singleId ? undefined : completedSkips.length,
      dispositionTally: tally,
      disposition: plans.map((p) => ({ campaignId: p.campaignId, name: p.name || p.slackName, disposition: p.disposition, reason: p.skipReason || p.flagReasons.join("; ") || "ok", warnings: p.warnings })),
      plans,
    });
  }

  // ── Live: create / skip / flag ──
  const created: any[] = [];
  const skipped: any[] = [];
  const flagged: any[] = [];
  const errors: any[] = [];

  for (const r of candidates) {
    try {
      const plan = await buildRecapPlan(supabase, r, ctx, {});
      if (plan.disposition === "skip") {
        skipped.push({ campaignId: r.campaignId, name: r.campaignName, reason: plan.skipReason });
        continue;
      }
      if (plan.disposition === "flag") {
        const slack = await postFlagOnce(supabase, plan);
        flagged.push({
          campaignId: r.campaignId,
          name: r.campaignName,
          reasons: plan.flagReasons,
          posted: slack.posted,
          alreadyFlagged: slack.alreadyFlagged,
          slackError: slack.error,
        });
        continue;
      }
      const commit = await commitRecap(supabase, plan);
      const slack = await postRecapConfirmation(plan, commit);
      created.push({
        campaignId: r.campaignId,
        name: plan.name,
        recapId: commit.recapId,
        editorUrl: commit.editorUrl,
        athletesInserted: commit.athletesInserted,
        hiddenHeroes: plan.hiddenHeroes,
        warnings: plan.warnings,
        slackPosted: slack.ok,
        slackError: slack.error,
      });
    } catch (e: any) {
      errors.push({ campaignId: r.campaignId, name: r.campaignName, error: String(e?.message || e) });
    }
  }

  return NextResponse.json({
    dryRun: false,
    mode: singleId ? "single" : "cron",
    createdCount: created.length,
    created,
    skipped: singleId ? skipped : { count: skipped.length, completed: completedSkips.length },
    flagged,
    errors,
  });
}
