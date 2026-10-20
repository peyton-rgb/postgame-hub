// ============================================================
// /admin/instagram — Instagram stats (prototype
// S["instagram-stats"]): the engine that keeps follower counts
// fresh. Tiles + three bookmarkable tabs:
//   default        — the refresh queue (instagram_refresh_queue)
//   ?tab=spiders   — the scheduled rules (instagram_spiders)
//   ?tab=history   — recent stat snapshots (instagram_stats_history)
// All three tables arrive with migration 083; until then each part
// says so. Read-only: "Requeue stuck" is not wired yet.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { CardFoot, TablePending, Tiles, timeAgo } from "@/components/admin/ops-bits";
import { Pill, type Tone } from "@/components/admin/campaign/bits";
import { Dim, SimpleTable, TabbedCard, btnDisabledCls } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

const STUCK_MIN = 30;

interface QueueRow {
  id: string;
  instagram_username: string;
  source: string | null;
  status: string;
  requested_at: string | null;
  started_at: string | null;
  last_error: string | null;
}
interface SpiderRow {
  id: string;
  name: string;
  rule_type: string;
  cron_schedule: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_run_enqueued_count: number | null;
  last_run_error: string | null;
}
interface HistRow {
  id: string;
  instagram_username: string | null;
  followers: number | null;
  engagement_rate: number | null;
  recorded_at: string;
}

const SOURCE_LABEL: Record<string, string> = { campaign: "Active campaign", spider: "Spider", manual: "Manual" };

function isStuck(r: QueueRow) {
  return r.status === "processing" && r.started_at != null && Date.now() - new Date(r.started_at).getTime() > STUCK_MIN * 60000;
}
function statusPill(r: QueueRow) {
  if (isStuck(r)) return <Pill tone="warn">Stuck</Pill>;
  const map: Record<string, [string, Tone]> = {
    pending: ["Pending", "muted"],
    processing: ["Processing", "info"],
    completed: ["Done", "ok"],
    failed: ["Failed", "bad"],
    skipped: ["Skipped", "muted"],
  };
  const [l, t] = map[r.status] ?? [r.status, "muted"];
  return <Pill tone={t}>{l}</Pill>;
}

export default async function InstagramStatsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const tab = searchParams.tab === "spiders" ? "spiders" : searchParams.tab === "history" ? "history" : "queue";

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const countBy = (status: string, since?: string) =>
    safeQuery<null>(async () => {
      let q: any = supabase.from("instagram_refresh_queue").select("id", { count: "exact", head: true }).eq("status", status);
      if (since) q = q.gte("completed_at", since);
      const { count, error } = await q;
      return { data: (count ?? 0) as any, error };
    });
  const stuckCount = safeQuery<null>(async () => {
    const { count, error } = await supabase
      .from("instagram_refresh_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .lt("started_at", new Date(Date.now() - STUCK_MIN * 60000).toISOString());
    return { data: (count ?? 0) as any, error };
  });

  const [pending, processing, stuck, doneWeek, failedWeek, queueRes, spiderRes, histRes] = await Promise.all([
    countBy("pending"),
    countBy("processing"),
    stuckCount,
    countBy("completed", weekAgo),
    countBy("failed", weekAgo),
    tab === "queue"
      ? safeQuery<QueueRow[]>(() =>
          supabase
            .from("instagram_refresh_queue")
            .select("id, instagram_username, source, status, requested_at, started_at, last_error")
            .in("status", ["pending", "processing", "failed"])
            .order("requested_at", { ascending: false })
            .limit(100)
        )
      : Promise.resolve(null),
    tab === "spiders"
      ? safeQuery<SpiderRow[]>(() =>
          supabase
            .from("instagram_spiders")
            .select("id, name, rule_type, cron_schedule, enabled, last_run_at, last_run_enqueued_count, last_run_error")
            .order("name")
        )
      : Promise.resolve(null),
    tab === "history"
      ? safeQuery<HistRow[]>(() =>
          supabase
            .from("instagram_stats_history")
            .select("id, instagram_username, followers, engagement_rate, recorded_at")
            .order("recorded_at", { ascending: false })
            .limit(100)
        )
      : Promise.resolve(null),
  ]);

  const tableMissing = pending.pending;
  const n = (r: { data: unknown; pending: boolean }) => (r.pending ? "—" : Number(r.data ?? 0).toLocaleString());

  return (
    <div>
      <PageHeader
        title="Instagram stats"
        subtitle="The engine that keeps follower counts fresh. Check it when numbers look stale."
        actions={
          <span className={btnDisabledCls} title="Not wired yet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
            </svg>
            Requeue stuck
          </span>
        }
      />

      <Tiles
        tiles={[
          { n: n(pending), l: "Pending" },
          { n: n(processing), l: "Processing" },
          { n: n(stuck), l: "Stuck", flag: !stuck.pending && Number(stuck.data) > 0 },
          { n: n(doneWeek), l: "Done this week" },
          { n: n(failedWeek), l: "Failed this week" },
        ]}
      />

      <TabbedCard
        tabs={[
          { href: "/admin/instagram", label: "Queue", active: tab === "queue" },
          { href: "/admin/instagram?tab=spiders", label: "Spiders", active: tab === "spiders" },
          { href: "/admin/instagram?tab=history", label: "Stats history", active: tab === "history" },
        ]}
      >
        {tab === "queue" && queueRes &&
          (queueRes.pending || tableMissing ? (
            <TablePending table="instagram_refresh_queue" feature="Profiles waiting for a stats refresh" />
          ) : queueRes.error ? (
            <div className="p-4"><ErrorNote message={queueRes.error} /></div>
          ) : (
            <>
              <SimpleTable
                rows={queueRes.data ?? []}
                rowKey={(r) => r.id}
                empty="The queue is empty."
                cols={[
                  { h: "Handle", r: (r) => <span className="font-medium text-stone-900">@{r.instagram_username.replace(/^@/, "")}</span> },
                  { h: "Reason", r: (r) => SOURCE_LABEL[r.source ?? ""] ?? r.source ?? <Dim>—</Dim> },
                  { h: "Queued", r: (r) => timeAgo(r.requested_at) },
                  { h: "Status", r: statusPill },
                  { h: "Last error", r: (r) => (r.last_error ? <span className="text-[12px] text-stone-500">{r.last_error.slice(0, 80)}</span> : <Dim>—</Dim>) },
                ]}
              />
              <CardFoot>
                <span>Open items only (pending, processing, failed). Processing for more than {STUCK_MIN} minutes counts as stuck.</span>
              </CardFoot>
            </>
          ))}

        {tab === "spiders" && spiderRes &&
          (spiderRes.pending ? (
            <TablePending table="instagram_spiders" feature="Rules that queue profile refreshes on a schedule" />
          ) : spiderRes.error ? (
            <div className="p-4"><ErrorNote message={spiderRes.error} /></div>
          ) : (
            <SimpleTable
              rows={spiderRes.data ?? []}
              rowKey={(r) => r.id}
              empty="No spiders set up."
              cols={[
                { h: "Spider", r: (r) => <span className="font-medium text-stone-900">{r.name}</span> },
                { h: "Schedule", r: (r) => <code className="text-[12px] text-stone-500">{r.cron_schedule ?? "—"}</code> },
                { h: "Queued last run", num: true, r: (r) => r.last_run_enqueued_count ?? <Dim>—</Dim> },
                { h: "Ran", r: (r) => timeAgo(r.last_run_at) },
                { h: "On", r: (r) => (r.enabled ? <Pill tone="ok">On</Pill> : <Pill>Off</Pill>) },
              ]}
            />
          ))}

        {tab === "history" && histRes &&
          (histRes.pending ? (
            <TablePending table="instagram_stats_history" feature="Follower and engagement snapshots over time" />
          ) : histRes.error ? (
            <div className="p-4"><ErrorNote message={histRes.error} /></div>
          ) : (
            <SimpleTable
              rows={histRes.data ?? []}
              rowKey={(r) => r.id}
              empty="No snapshots recorded yet."
              cols={[
                { h: "Handle", r: (r) => (r.instagram_username ? `@${r.instagram_username.replace(/^@/, "")}` : <Dim>—</Dim>) },
                { h: "Followers", num: true, r: (r) => (r.followers != null ? r.followers.toLocaleString() : <Dim>—</Dim>) },
                { h: "Engagement", num: true, r: (r) => (r.engagement_rate != null ? `${Number(r.engagement_rate).toFixed(2)}%` : <Dim>—</Dim>) },
                { h: "Recorded", r: (r) => timeAgo(r.recorded_at) },
              ]}
            />
          ))}
      </TabbedCard>
    </div>
  );
}
