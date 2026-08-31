// ============================================================
// POST /api/sync/asana-managers — map each Asana campaign task's assignee onto
// the matching campaign_recaps row as the campaign manager.
//
// Read-only in one direction: Asana → Hub. Nothing is written back to Asana.
//
// Two callers, one route:
//   • the daily Vercel cron (vercel.json), authenticated by CRON_SECRET
//   • the "Sync Asana" button on the campaign dashboard, authenticated by a
//     logged-in staff session (getStaffUser, same gate as /api/admin-sync)
//
// The join key is the campaignID inside the task's "Campaign Link" custom
// field, compared against campaign_recaps.admin_campaign_id as TEXT.
//
// admin_campaign_id is NOT unique (there are known duplicate pairs), so every
// matching row is updated and the row count comes from the update result —
// never from an assumption that one id means one row.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import {
  AsanaError,
  asanaConfigured,
  campaignLinkValue,
  getCampaignTasks,
  parseCampaignId,
  type AsanaTask,
} from "@/lib/asana";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One Asana task that carries a usable campaignID. */
interface Mapping {
  campaignId: string;
  taskGid: string;
  taskName: string;
  managerEmail: string | null;
  managerName: string | null;
}

interface BadLink {
  taskGid: string;
  taskName: string;
  link: string;
}

interface DuplicateLink {
  campaignId: string;
  taskGids: string[];
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/** Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically once the var
 *  exists. Same shape as the recap-intake cron, deliberately: one pattern. */
function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  // No secret configured: local dev only. Fail CLOSED in production so a missing
  // CRON_SECRET can never leave this write-capable endpoint open.
  return process.env.NODE_ENV !== "production";
}

// ── Run logging ───────────────────────────────────────────────────────────────

/**
 * agent_runs.triggered_by is NOT NULL and a foreign key to auth.users, so a cron
 * run — which has no session — still needs a real user to attribute to. Rather
 * than invent a service account or a new env var, cron runs are attributed to
 * the SLACK_FALLBACK_EMAIL profile: that address is already the configured owner
 * of this automation's fallout. If it can't be resolved the run is logged to the
 * console only; audit logging must never be the reason a sync fails.
 */
async function resolveActor(
  supabase: ReturnType<typeof createLiveServiceSupabase>,
  staffId: string | null,
): Promise<string | null> {
  if (staffId) return staffId;

  const email = process.env.SLACK_FALLBACK_EMAIL;
  if (!email) return null;

  const { data } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Log to agent_runs.
 *
 * agent_name is an enum that has no 'asana-manager-sync' member, and adding one
 * is a schema change this build was not asked to make — 'admin_sync' is the
 * existing member that describes this work (an external system reconciled into
 * campaign_recaps). `source` in the payload distinguishes it from the CF admin
 * sync that shares the label. `model` is NOT NULL but no model is called here,
 * so it records 'none' rather than letting the column default imply one.
 */
async function logRun(
  supabase: ReturnType<typeof createLiveServiceSupabase>,
  actorId: string | null,
  inputPayload: Record<string, unknown>,
  outputPayload: Record<string, unknown> | null,
  status: "complete" | "failed",
  startedAt: number,
  errorMessage?: string,
): Promise<void> {
  if (!actorId) {
    console.warn("[asana-sync] no actor to attribute the run to — skipping agent_runs insert");
    return;
  }
  const { error } = await supabase.from("agent_runs").insert({
    agent_name: "admin_sync",
    triggered_by: actorId,
    input_payload: inputPayload,
    output_payload: outputPayload,
    model: "none",
    status,
    duration_ms: Date.now() - startedAt,
    error_message: errorMessage ?? null,
  });
  // Never let logging failure mask the real result.
  if (error) console.error("[asana-sync] agent_runs insert failed:", error.message);
}

// ── Task → mapping ────────────────────────────────────────────────────────────

/** Split the board into usable mappings and the three reportable problems. */
function classifyTasks(tasks: AsanaTask[]) {
  const mappings: Mapping[] = [];
  const badLinks: BadLink[] = [];
  const noAssignee: Array<{ campaignId: string; taskGid: string; taskName: string }> = [];
  let skippedNoLink = 0;

  for (const task of tasks) {
    const link = campaignLinkValue(task);
    if (!link) {
      // An empty Campaign Link is the normal state for a note or a task that
      // isn't a campaign — silent by design, counted only.
      skippedNoLink++;
      continue;
    }

    const taskName = (task.name ?? "").trim();
    const campaignId = parseCampaignId(link);
    if (!campaignId) {
      // Filled in, but pointing at the wrong CF page. Reported, because it looks
      // correct to whoever pasted it and only a report will get it fixed.
      badLinks.push({ taskGid: task.gid, taskName, link });
      continue;
    }

    const managerEmail = (task.assignee?.email ?? "").trim() || null;
    const managerName = (task.assignee?.name ?? "").trim() || null;
    if (!managerEmail && !managerName) {
      noAssignee.push({ campaignId, taskGid: task.gid, taskName });
      continue;
    }

    mappings.push({ campaignId, taskGid: task.gid, taskName, managerEmail, managerName });
  }

  return { mappings, badLinks, noAssignee, skippedNoLink };
}

/** Two tasks pointing at one campaign. Last write wins, but it is reported —
 *  a campaign with two managers in Asana is a human problem, not a data one. */
function findDuplicates(mappings: Mapping[]): DuplicateLink[] {
  // A plain object rather than a Map: this tsconfig targets below es2015, so
  // iterating a Map's entries needs downlevelIteration.
  const byCampaign: Record<string, string[]> = {};
  for (const m of mappings) {
    (byCampaign[m.campaignId] ??= []).push(m.taskGid);
  }
  return Object.keys(byCampaign)
    .filter((campaignId) => byCampaign[campaignId].length > 1)
    .map((campaignId) => ({ campaignId, taskGids: byCampaign[campaignId] }));
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * GET and POST are the same run.
 *
 * GET exists because that is the only method Vercel cron issues — a route that
 * exports POST alone answers its own schedule with 405 and never runs. POST
 * stays for the staff button.
 *
 * Neither method reads a request body, so delegating is exact rather than
 * approximate.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const supabase = createLiveServiceSupabase();

  // Either gate is enough. The session lookup runs second so a cron request
  // never pays for one it doesn't need.
  const viaCron = cronAuthorized(req);
  const staff = viaCron ? null : await getStaffUser();
  if (!viaCron && !staff) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const actorId = await resolveActor(supabase, staff?.id ?? null);
  const inputPayload = { source: "asana-manager-sync", via: viaCron ? "cron" : "staff" };

  // Stub-safe: an unconfigured token is a deployment state, not a crash.
  if (!asanaConfigured()) {
    const message = "ASANA_ACCESS_TOKEN is not set — Asana sync is unavailable.";
    await logRun(supabase, actorId, inputPayload, null, "failed", startedAt, message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 503 });
  }

  try {
    const tasks = await getCampaignTasks();
    const { mappings, badLinks, noAssignee, skippedNoLink } = classifyTasks(tasks);
    const duplicateLinks = findDuplicates(mappings);

    const notInHub: string[] = [];
    let synced = 0;

    // Sequential on purpose. The board is a few hundred tasks and this runs once
    // a day; a fan-out would buy seconds and risk hammering the pooler.
    for (const m of mappings) {
      const { data, error } = await supabase
        .from("campaign_recaps")
        .update({
          manager_email: m.managerEmail,
          manager_name: m.managerName,
          asana_task_gid: m.taskGid,
          asana_synced_at: new Date().toISOString(),
        })
        // admin_campaign_id is text on both sides — never cast to a number.
        .eq("admin_campaign_id", m.campaignId)
        .select("id");

      if (error) {
        console.error(`[asana-sync] update failed for campaign ${m.campaignId}:`, error.message);
        continue;
      }

      // The row count is the update's own result, because one id can legitimately
      // match more than one Hub row.
      const rows = data?.length ?? 0;
      if (rows === 0) {
        // Expected for a brand-new deal that hasn't synced from the CF admin yet.
        if (!notInHub.includes(m.campaignId)) notInHub.push(m.campaignId);
      } else {
        synced += rows;
      }
    }

    const report = {
      synced,
      skipped_no_link: skippedNoLink,
      bad_links: badLinks,
      not_in_hub: notInHub,
      no_assignee: noAssignee,
      duplicate_links: duplicateLinks,
    };

    await logRun(
      supabase,
      actorId,
      inputPayload,
      { ...report, tasks_scanned: tasks.length, campaigns_mapped: mappings.length },
      "complete",
      startedAt,
    ).catch(() => {});

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[asana-sync] run failed:", message);
    await logRun(supabase, actorId, inputPayload, null, "failed", startedAt, message).catch(() => {});

    // An Asana-side problem is an upstream failure, not ours.
    const status = err instanceof AsanaError ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
