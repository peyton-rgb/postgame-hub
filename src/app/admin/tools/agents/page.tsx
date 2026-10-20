// ============================================================
// /admin/tools/agents — Agents & tasks (prototype
// S["agents-tasks"]): AI agent runs and the team task board.
// Tiles are live counts; the card has three bookmarkable tabs:
//   default      — recent agent_runs (filter by agent)
//   ?tab=jobs    — agent_jobs (the build/report queue)
//   ?tab=board   — board_tasks
// agent_runs.agent_name is a Postgres enum: the filter options are
// read from the rows themselves, never hard-coded.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { CardFoot, Tiles, timeAgo } from "@/components/admin/ops-bits";
import AutoSubmitSelect from "@/components/admin/AutoSubmitSelect";
import { Pill, type Tone } from "@/components/admin/campaign/bits";
import { Dim, HubNote, SimpleTable, TabbedCard } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

interface RunRow {
  id: string;
  agent_name: string;
  status: string;
  model: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  error_message: string | null;
  trigger_source: string | null;
  created_at: string;
}
interface JobRow {
  id: string;
  seq: number | null;
  title: string | null;
  status: string | null;
  priority: number | null;
  blocked_on: string | null;
  created_at: string | null;
  reported_at: string | null;
}
interface BoardRow {
  id: string;
  title: string | null;
  lane: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  is_agent: boolean | null;
}

const human = (s: string | null | undefined) => (s ? (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, " ") : "—");

const RUN_TONE: Record<string, Tone> = { complete: "ok", failed: "bad", running: "info" };
const JOB_TONE: Record<string, Tone> = { reported: "info", blocked: "warn", rejected: "muted", done: "ok", approved: "ok" };
const BOARD_TONE: Record<string, Tone> = { done: "ok", in_progress: "info", blocked: "bad", waiting_on_me: "warn", to_do: "muted" };

export default async function AgentsTasksPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const tab = searchParams.tab === "jobs" ? "jobs" : searchParams.tab === "board" ? "board" : "runs";
  const agent = (searchParams.agent ?? "").replace(/[^a-z0-9_]/g, "");

  const head = (table: string, f?: (q: any) => any) => {
    let q: any = supabase.from(table).select("id", { count: "exact", head: true });
    if (f) q = f(q);
    return q as PromiseLike<{ count: number | null; error: { message: string } | null }>;
  };
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [runsN, failedN, jobsN, boardN, namesRes] = await Promise.all([
    head("agent_runs"),
    head("agent_runs", (q) => q.eq("status", "failed").gte("created_at", weekAgo)),
    head("agent_jobs"),
    head("board_tasks", (q) => q.neq("status", "done")),
    supabase.from("agent_runs").select("agent_name").order("created_at", { ascending: false }).limit(1000),
  ]);
  const agentNames = Array.from(new Set(((namesRes.data ?? []) as { agent_name: string }[]).map((r) => r.agent_name))).sort();

  let body: React.ReactNode = null;
  let foot: React.ReactNode = null;

  if (tab === "runs") {
    let q: any = supabase
      .from("agent_runs")
      .select("id, agent_name, status, model, cost_usd, duration_ms, error_message, trigger_source, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (agent && agentNames.includes(agent)) q = q.eq("agent_name", agent);
    const { data, error } = await q;
    const rows = (data ?? []) as RunRow[];
    body = error ? (
      <div className="p-4"><ErrorNote message={error.message} /></div>
    ) : (
      <>
        <form action="/admin/tools/agents" method="GET" className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2.5">
          <AutoSubmitSelect
            name="agent"
            label="Agent"
            value={agent}
            options={[{ value: "", label: "All agents" }, ...agentNames.map((n) => ({ value: n, label: human(n) }))]}
          />
          <noscript>
            <button type="submit" className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px]">Filter</button>
          </noscript>
        </form>
        <SimpleTable
          rows={rows}
          rowKey={(r) => r.id}
          empty="No runs."
          cols={[
            { h: "Agent", r: (r) => <span className="font-medium text-stone-900">{human(r.agent_name)}</span> },
            { h: "Status", r: (r) => <Pill tone={RUN_TONE[r.status] ?? "muted"}>{human(r.status)}</Pill> },
            { h: "Started by", r: (r) => (r.trigger_source ? human(r.trigger_source) : <Dim>—</Dim>) },
            { h: "Model", r: (r) => (r.model ? <span className="text-[12px] text-stone-500">{r.model}</span> : <Dim>—</Dim>) },
            { h: "Time", num: true, r: (r) => (r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : <Dim>—</Dim>) },
            { h: "Cost", num: true, r: (r) => (r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(3)}` : <Dim>—</Dim>) },
            { h: "When", r: (r) => timeAgo(r.created_at) },
            { h: "Error", r: (r) => (r.error_message ? <span className="text-[12px] text-status-bad">{r.error_message.slice(0, 70)}</span> : <Dim>—</Dim>) },
          ]}
        />
      </>
    );
    foot = <span>Newest 50 runs{agent ? ` of ${human(agent)}` : ""}</span>;
  } else if (tab === "jobs") {
    const { data, error } = await supabase
      .from("agent_jobs")
      .select("id, seq, title, status, priority, blocked_on, created_at, reported_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as JobRow[];
    body = error ? (
      <div className="p-4"><ErrorNote message={error.message} /></div>
    ) : (
      <SimpleTable
        rows={rows}
        rowKey={(r) => r.id}
        empty="No agent jobs."
        cols={[
          { h: "#", r: (r) => <Dim>{r.seq ?? "—"}</Dim> },
          { h: "Job", r: (r) => <span className="font-medium text-stone-900">{r.title ?? "Untitled"}</span> },
          { h: "Status", r: (r) => <Pill tone={JOB_TONE[r.status ?? ""] ?? "muted"}>{human(r.status)}</Pill> },
          { h: "Blocked on", r: (r) => (r.blocked_on ? <span className="text-[12px] text-stone-500">{r.blocked_on.slice(0, 70)}</span> : <Dim>—</Dim>) },
          { h: "Created", r: (r) => timeAgo(r.created_at) },
          { h: "Reported", r: (r) => timeAgo(r.reported_at) },
        ]}
      />
    );
    foot = <span>{rows.length} jobs</span>;
  } else {
    const { data, error } = await supabase
      .from("board_tasks")
      .select("id, title, lane, status, priority, due_date, is_agent")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .limit(200);
    const rows = (data ?? []) as BoardRow[];
    body = error ? (
      <div className="p-4"><ErrorNote message={error.message} /></div>
    ) : (
      <SimpleTable
        rows={rows}
        rowKey={(r) => r.id}
        empty="The board is empty."
        cols={[
          { h: "Task", r: (r) => <span className="font-medium text-stone-900">{r.title ?? "Untitled"}</span> },
          { h: "Lane", r: (r) => <Pill>{r.lane ?? "—"}</Pill> },
          { h: "Status", r: (r) => <Pill tone={BOARD_TONE[r.status ?? ""] ?? "muted"}>{human(r.status)}</Pill> },
          { h: "Priority", r: (r) => (r.priority ? human(r.priority) : <Dim>—</Dim>) },
          { h: "Due", r: (r) => (r.due_date ? new Date(r.due_date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : <Dim>—</Dim>) },
          { h: "Owner", r: (r) => (r.is_agent ? "Agent" : "Team") },
        ]}
      />
    );
    foot = <span>{rows.length} tasks</span>;
  }

  return (
    <div>
      <PageHeader title="Agents & tasks" subtitle="AI agents and the team task board." />
      <HubNote>This is an existing Hub tool. It moves into this menu as-is; only its look changes to match.</HubNote>
      <Tiles
        tiles={[
          { n: (runsN.count ?? 0).toLocaleString(), l: "Agent runs", href: "/admin/tools/agents" },
          { n: (failedN.count ?? 0).toLocaleString(), l: "Failed this week", flag: (failedN.count ?? 0) > 0 },
          { n: (jobsN.count ?? 0).toLocaleString(), l: "Agent jobs", href: "/admin/tools/agents?tab=jobs" },
          { n: (boardN.count ?? 0).toLocaleString(), l: "Open board tasks", href: "/admin/tools/agents?tab=board" },
        ]}
      />
      <TabbedCard
        tabs={[
          { href: "/admin/tools/agents", label: "Agent runs", active: tab === "runs" },
          { href: "/admin/tools/agents?tab=jobs", label: "Agent jobs", active: tab === "jobs" },
          { href: "/admin/tools/agents?tab=board", label: "Board tasks", active: tab === "board" },
        ]}
      >
        {body}
        {foot && <CardFoot>{foot}</CardFoot>}
      </TabbedCard>
    </div>
  );
}
