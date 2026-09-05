// ============================================================
// GET /api/cron/health-check — the weekly Hub health email.
//
// Monday 8am ET. One message to the address below, six sections:
//   1. agent_runs cost by agent — last 7 days, and month-to-date against the
//      cap in agent_budgets
//   2. failed runs in the last 7 days, grouped by agent
//   3. delivered campaigns from the last 90 days, as "ready for recap"
//   4. public tables with RLS switched off
//   5. agent_jobs that are 'reported' or 'blocked' — "waiting on Peyton"
//   6. recap readiness totals, from the daily sweep's own verdicts
//
// Plus Vercel runtime errors when a Vercel API token is configured. When it is
// not, the section says so rather than the route failing — a missing optional
// integration must not cost you the other six sections.
//
// Guarded by CRON_SECRET exactly as the other crons are. Fails CLOSED in
// production so a missing secret cannot leave the endpoint open.
//
// Manual run:
//   /api/cron/health-check?dry_run=1   → returns the body, sends nothing
//
// This one ALWAYS emails when it runs. It is a weekly digest whose value is
// partly that it arrives — silence from a weekly report is indistinguishable
// from the cron being broken. That is the opposite of the daily readiness
// sweep, which is noisy by nature and so only mails on change.
// ============================================================

import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { sendMail } from "@/lib/mail";
import { siteUrl } from "@/lib/site-url";
import { startRun, finishRun, failRun } from "@/lib/agents/run-log";
import { readinessTotals } from "@/lib/recap-readiness";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPORT_TO = process.env.AGENT_ALERT_EMAIL ?? "peyton@pstgm.com";
const TZ = "America/New_York";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** ISO instant N days back. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/** ET month start, offset measured at the boundary so DST cannot shift it. */
function monthStartIso(): string {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  const wall = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const asTz = new Date(wall.toLocaleString("en-US", { timeZone: TZ }));
  const asUtc = new Date(wall.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(wall.getTime() + (asUtc.getTime() - asTz.getTime())).toISOString();
}

type Runs = Array<{ agent_name: string; cost_usd: number | string | null; status: string; created_at: string }>;

/**
 * Vercel runtime errors for the last 7 days.
 *
 * Entirely optional. Returns a line explaining itself when no token is set, so
 * the section is always present and always honest about why it is empty.
 */
async function vercelErrors(): Promise<string[]> {
  const token = process.env.VERCEL_API_TOKEN ?? process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token) {
    return ["  not checked — no VERCEL_API_TOKEN in env"];
  }
  if (!projectId) {
    return ["  not checked — VERCEL_API_TOKEN is set but VERCEL_PROJECT_ID is not"];
  }
  try {
    const url = new URL("https://api.vercel.com/v1/projects/" + projectId + "/logs");
    url.searchParams.set("since", String(Date.now() - 7 * 86_400_000));
    url.searchParams.set("level", "error");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [`  could not be read — Vercel API returned ${res.status}`];
    const body = (await res.json()) as { logs?: unknown[] };
    const n = body.logs?.length ?? 0;
    return [`  ${n} runtime error${n === 1 ? "" : "s"} in the last 7 days`];
  } catch (e) {
    return [`  could not be read — ${e instanceof Error ? e.message : String(e)}`];
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";
  const supabase = createServiceSupabase();
  const startedAt = Date.now();

  const runId = dryRun
    ? null
    : await startRun(supabase, {
        agentName: "health_check",
        model: "none",
        triggerSource: "cron",
        input: {},
      });

  try {
    const weekAgo = daysAgo(7);
    const monthStart = monthStartIso();
    const ninetyDays = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

    const [runsRes, budgetsRes, deliveredRes, rlsRes, jobsRes, readiness, vercel] = await Promise.all([
      supabase
        .from("agent_runs")
        .select("agent_name, cost_usd, status, created_at")
        .gte("created_at", monthStart < weekAgo ? monthStart : weekAgo),
      supabase.from("agent_budgets").select("agent_name, monthly_cap_usd, enabled"),
      supabase
        .from("campaign_recaps")
        .select("id, name, client_name, admin_created_on")
        .eq("lifecycle_status", "delivered")
        .gte("admin_created_on", ninetyDays)
        .order("admin_created_on", { ascending: false }),
      supabase.rpc("tables_without_rls"),
      supabase
        .from("agent_jobs")
        .select("seq, title, status, blocked_on")
        .in("status", ["reported", "blocked"])
        .order("seq", { ascending: true }),
      readinessTotals(supabase, 120),
      vercelErrors(),
    ]);

    const runs = ((runsRes.data as Runs | null) ?? []).map((r) => ({
      ...r,
      cost: Number(r.cost_usd ?? 0),
    }));
    const budgets = new Map(
      ((budgetsRes.data as Array<{ agent_name: string; monthly_cap_usd: number | string; enabled: boolean }> | null) ?? [])
        .map((b) => [b.agent_name, { cap: Number(b.monthly_cap_usd), enabled: b.enabled }]),
    );

    const today = new Date().toLocaleDateString("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const L: string[] = [`Hub health — ${today}`, ""];

    // ---- 1. cost by agent -------------------------------------------------
    L.push("AGENT SPEND (7 days / month-to-date vs cap)");
    // Array.from rather than spreading the Map/Set: this tsconfig targets below
    // es2015 downlevelIteration, so `[...map.keys()]` does not compile.
    const agents = Array.from(
      new Set(runs.map((r) => r.agent_name).concat(Array.from(budgets.keys()))),
    ).sort();
    const spendRows = agents
      .map((a) => {
        const week = runs.filter((r) => r.agent_name === a && r.created_at >= weekAgo);
        const mtd = runs.filter((r) => r.agent_name === a && r.created_at >= monthStart);
        const b = budgets.get(a);
        return {
          a,
          week: week.reduce((s, r) => s + r.cost, 0),
          mtd: mtd.reduce((s, r) => s + r.cost, 0),
          runs: week.length,
          cap: b?.cap ?? null,
          enabled: b?.enabled ?? true,
        };
      })
      .filter((r) => r.runs > 0 || r.mtd > 0 || r.cap != null);

    if (spendRows.length === 0) {
      L.push("  no agents configured or run");
    } else {
      for (const r of spendRows.sort((x, y) => y.mtd - x.mtd || x.a.localeCompare(y.a))) {
        const cap = r.cap == null ? "no cap" : `${money(r.mtd)} of ${money(r.cap)}`;
        const over = r.cap != null && r.enabled && r.mtd >= r.cap ? "  ** AT CAP **" : "";
        const off = r.cap != null && !r.enabled ? "  (cap disabled)" : "";
        L.push(`  ${r.a}: ${money(r.week)} this week · ${cap} MTD · ${r.runs} run${r.runs === 1 ? "" : "s"}${over}${off}`);
      }
    }

    // ---- 2. failures ------------------------------------------------------
    const failed = runs.filter((r) => r.status === "failed" && r.created_at >= weekAgo);
    L.push("", `FAILED RUNS, LAST 7 DAYS (${failed.length})`);
    if (failed.length === 0) {
      L.push("  none");
    } else {
      const byAgent = new Map<string, number>();
      for (const f of failed) byAgent.set(f.agent_name, (byAgent.get(f.agent_name) ?? 0) + 1);
      for (const [a, n] of Array.from(byAgent).sort((x, y) => y[1] - x[1])) L.push(`  ${a}: ${n}`);
    }

    // ---- 3. delivered, last 90 days --------------------------------------
    const delivered = (deliveredRes.data as Array<{ id: string; name: string; client_name: string }> | null) ?? [];
    L.push("", `READY FOR RECAP — delivered in the last 90 days (${delivered.length})`);
    if (delivered.length === 0) {
      L.push("  none");
    } else {
      for (const d of delivered) L.push(`  ${d.client_name} · ${d.name}`);
    }

    // ---- 4. RLS -----------------------------------------------------------
    const noRls = ((rlsRes.data as Array<{ table_name: string }> | null) ?? []).map((r) => r.table_name);
    L.push("", `PUBLIC TABLES WITHOUT RLS (${rlsRes.error ? "unavailable" : noRls.length})`);
    if (rlsRes.error) L.push(`  could not be read — ${rlsRes.error.message}`);
    else if (noRls.length === 0) L.push("  none — every public table has RLS on");
    else for (const t of noRls) L.push(`  ${t}`);

    // ---- 5. waiting on Peyton --------------------------------------------
    const jobs = (jobsRes.data as Array<{ seq: number; title: string; status: string; blocked_on: string | null }> | null) ?? [];
    L.push("", `WAITING ON PEYTON (${jobs.length})`);
    if (jobs.length === 0) {
      L.push("  none");
    } else {
      for (const j of jobs) {
        L.push(`  #${j.seq} [${j.status}] ${j.title}${j.blocked_on ? ` — blocked on: ${j.blocked_on}` : ""}`);
      }
    }

    // ---- 6. recap readiness ----------------------------------------------
    L.push("", "RECAP READINESS (delivered, last 120 days)");
    L.push(`  ${readiness.ready} ready · ${readiness.notReady} not ready · ${readiness.total} total`);
    if (readiness.total > 0 && readiness.ready === 0) {
      L.push("  (the daily sweep records these; it emails only when one changes)");
    }

    // ---- runtime errors ---------------------------------------------------
    L.push("", "VERCEL RUNTIME ERRORS");
    L.push(...vercel);

    L.push("", siteUrl());

    const subject = `Hub health — ${today}`;
    const text = L.join("\n");

    if (dryRun) return NextResponse.json({ ok: true, dryRun: true, subject, text });

    const sent = await sendMail({ to: REPORT_TO, subject, text });
    if (!sent.sent) console.error(`[health] report not sent: ${sent.error}`);

    await finishRun(supabase, runId, {
      model: "none",
      output: {
        agents: spendRows.length,
        failed: failed.length,
        delivered: delivered.length,
        tables_without_rls: noRls.length,
        waiting_on_peyton: jobs.length,
        readiness,
        emailed: sent.sent,
      },
      startedAt,
    });

    return NextResponse.json({ ok: true, emailed: sent.sent });
  } catch (e) {
    await failRun(supabase, runId, { model: "none", error: e, startedAt });
    console.error("[health] check failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "health check failed" }, { status: 500 });
  }
}
