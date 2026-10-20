// ============================================================
// /admin/rosters — Rosters (the prototype's S.rosters): the athlete
// list updates itself; staff step in only when a school needs a look.
// Brings together ColdFusion's Upload Profiles, Profile Errors and
// Profile Queue.
//
// Real today: colleges (and athletes per college from `people`),
// athletes with no Instagram. The bot side (runs, changes, issues,
// hand uploads, settings) lives in migration 091 tables; until 091
// is applied — and until the bots write to them — those parts say so
// instead of showing invented numbers.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange, safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { TablePending } from "@/components/admin/ops-bits";
import { CardFoot, LinkBtn, Note, TabStrip, Tiles, Toolbar, fmtCount } from "@/components/admin/people/bits";
import { applyAthleteBase } from "@/lib/admin/athletes";
import { fmtDay } from "@/lib/admin/athlete-detail";
import { resolveRosterIssue } from "./actions";

export const dynamic = "force-dynamic";

type Tab = "look" | "transfers" | "colleges" | "log" | "uploads";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "look", label: "Needs a look" },
  { key: "transfers", label: "Transfers" },
  { key: "colleges", label: "All colleges" },
  { key: "log", label: "Change log" },
  { key: "uploads", label: "Hand uploads" },
];

const ISSUE_TEXT: Record<string, string> = {
  site_changed: "The school's site changed, so the bot couldn't read it",
  blocked: "Site blocked the bot",
  too_few: "Fewer than half last season's athletes found. Held back so nobody gets archived by mistake",
  missing_handles: "Roster found, but some athletes have no Instagram handle",
  duplicate_ig: "Same Instagram on 2 athlete records (likely a transfer added twice)",
  other: "Needs a look",
};
const CHANGE_TEXT: Record<string, string> = {
  added: "Added",
  transfer: "Transfer",
  left: "Left the roster",
  handle_added: "New Instagram",
  updated: "Details refreshed",
  archived: "Archived",
  restored: "Back on a roster",
};
const RESULT: Record<string, string> = {
  pending: "That needs the roster tables (migration 091, written, not applied). Nothing was changed.",
  error: "That didn't save. Nothing was changed.",
  resolved: "Marked as handled.",
  ignored: "Ignored.",
};

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  schools_checked: number;
  added: number;
  transfers: number;
  left_roster: number;
  new_handles: number;
}

export default async function RostersPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const db = supabase as any; // 091 tables are not in the generated types yet
  const tab: Tab = (TABS.find((t) => t.key === searchParams.tab)?.key ?? "look") as Tab;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const { from, to } = pageRange(page);

  const head = () => supabase.from("people").select("id", { count: "exact", head: true });
  const [collegesCount, noIg, lastRun, openIssues, transfers, settings] = await Promise.all([
    supabase.from("colleges").select("id", { count: "exact", head: true }),
    applyAthleteBase(head()).or("instagram_handle.is.null,instagram_handle.eq."),
    safeQuery<RunRow[]>(() => db.from("roster_runs").select("*").order("started_at", { ascending: false }).limit(1)),
    safeQuery<null>(() => db.from("roster_issues").select("id", { count: "exact", head: true }).eq("status", "open")),
    safeQuery<null>(() => db.from("roster_changes").select("id", { count: "exact", head: true }).eq("kind", "transfer")),
    safeQuery<Array<{ cadence: string }>>(() => db.from("roster_settings").select("cadence").limit(1)),
  ]);
  // safeQuery drops `count`; re-read the counts where the tables exist.
  const countOf = async (table: string, apply: (q: any) => any) => {
    const { count, error } = await apply(db.from(table).select("id", { count: "exact", head: true }));
    return error ? null : count ?? 0;
  };
  const botsPending = lastRun.pending;
  const [openIssueCount, transferCount] = botsPending
    ? [null, null]
    : await Promise.all([
        openIssues.error ? null : countOf("roster_issues", (x) => x.eq("status", "open")),
        transfers.error ? null : countOf("roster_changes", (x) => x.eq("kind", "transfer")),
      ]);
  const run = (lastRun.data ?? [])[0] ?? null;

  // ---------------- tab bodies ----------------
  let body: React.ReactNode = null;
  let total = 0;

  if (tab === "colleges") {
    let cq: any = supabase.from("colleges").select("id, name, state, ncaa_division, is_active", { count: "exact" });
    if (q) cq = cq.ilike("name", `%${q}%`);
    const { data, count } = await cq.order("name").range(from, to);
    total = count ?? 0;
    const rows = (data ?? []) as Array<{ id: number; name: string; state: string | null; ncaa_division: string | null; is_active: boolean | null }>;
    const counts = await Promise.all(rows.map((r) => applyAthleteBase(head()).eq("college_id", r.id)));
    const athletes = new Map(rows.map((r, i) => [r.id, counts[i]?.error ? null : counts[i]?.count ?? 0]));
    body = (
      <AdminTable<(typeof rows)[number]>
        rows={rows}
        rowKey={(r) => String(r.id)}
        emptyLabel="No colleges match."
        columns={[
          {
            key: "n",
            header: "College",
            render: (r) => (
              <Link href={`/admin/athletes?level=college&school=${encodeURIComponent(r.name)}`} className="font-medium text-stone-900 hover:underline">
                {r.name}
              </Link>
            ),
          },
          { key: "s", header: "State", render: (r) => r.state ?? <span className="text-stone-400">—</span> },
          { key: "d", header: "Division", secondary: true, render: (r) => r.ncaa_division ?? <span className="text-stone-400">—</span> },
          { key: "a", header: "Athletes", align: "right", render: (r) => fmtCount(athletes.get(r.id)) },
          { key: "u", header: "Last update", render: () => <span className="text-stone-400">—</span> },
          {
            key: "x",
            header: "",
            align: "right",
            render: () => (
              <LinkBtn href="/admin/profiles/upload" small>
                Upload by hand
              </LinkBtn>
            ),
          },
        ]}
        mobile={{
          title: (r) => r.name,
          href: (r) => `/admin/athletes?level=college&school=${encodeURIComponent(r.name)}`,
          subtitle: (r) => [r.state, r.ncaa_division].filter(Boolean).join(" · "),
          figure: (r) => fmtCount(athletes.get(r.id)),
        }}
      />
    );
  } else if (botsPending) {
    body = (
      <TablePending
        table={tab === "look" ? "roster_issues" : tab === "uploads" ? "roster_uploads" : "roster_changes"}
        feature={TABS.find((t) => t.key === tab)!.label}
        migration="091"
      />
    );
  } else if (tab === "look") {
    const { data, count } = await db
      .from("roster_issues")
      .select("id, kind, detail, athletes_count, last_good_at, created_at, colleges(name)", { count: "exact" })
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .range(from, to);
    total = count ?? 0;
    body = (
      <AdminTable<any>
        rows={data ?? []}
        rowKey={(r) => r.id}
        emptyLabel="Nothing needs a look. Every school updated on its own."
        columns={[
          { key: "c", header: "College", render: (r) => <span className="font-medium text-stone-900">{r.colleges?.name ?? "—"}</span> },
          { key: "w", header: "What happened", render: (r) => r.detail ?? ISSUE_TEXT[r.kind] ?? r.kind },
          { key: "d", header: "Last good update", render: (r) => fmtDay(r.last_good_at) },
          { key: "a", header: "Athletes", align: "right", render: (r) => fmtCount(r.athletes_count) },
          {
            key: "x",
            header: "",
            align: "right",
            render: (r) => (
              <div className="flex justify-end gap-1.5 whitespace-nowrap">
                <LinkBtn href="/admin/profiles/upload" small>
                  Upload by hand
                </LinkBtn>
                <form action={resolveRosterIssue}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 hover:border-stone-400">
                    Mark handled
                  </button>
                </form>
              </div>
            ),
          },
        ]}
        mobile={{
          title: (r) => r.colleges?.name ?? "—",
          subtitle: (r) => r.detail ?? ISSUE_TEXT[r.kind] ?? r.kind,
          figure: (r) => fmtCount(r.athletes_count),
        }}
      />
    );
  } else if (tab === "uploads") {
    const { data, count } = await db
      .from("roster_uploads")
      .select("id, file_name, row_count, applied_at, created_at, colleges(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    total = count ?? 0;
    body = (
      <AdminTable<any>
        rows={data ?? []}
        rowKey={(r) => r.id}
        emptyLabel="No hand uploads yet."
        columns={[
          { key: "d", header: "Uploaded", render: (r) => fmtDay(r.created_at) },
          { key: "c", header: "College", render: (r) => r.colleges?.name ?? "—" },
          { key: "f", header: "File", render: (r) => r.file_name ?? "—" },
          { key: "n", header: "Rows", align: "right", render: (r) => fmtCount(r.row_count) },
          { key: "a", header: "Applied", render: (r) => (r.applied_at ? <Pill tone="ok">Applied {fmtDay(r.applied_at)}</Pill> : <Pill tone="warn">Not applied</Pill>) },
        ]}
        mobile={{ title: (r) => r.colleges?.name ?? r.file_name ?? "Upload", subtitle: (r) => fmtDay(r.created_at), figure: (r) => fmtCount(r.row_count) }}
      />
    );
  } else {
    let cq = db
      .from("roster_changes")
      .select("id, kind, created_at, detail, person:people(id, first_name, last_name, instagram_handle), from_college:colleges!from_college_id(name), to_college:colleges!to_college_id(name)", { count: "exact" });
    if (tab === "transfers") cq = cq.eq("kind", "transfer");
    const { data, count } = await cq.order("created_at", { ascending: false }).range(from, to);
    total = count ?? 0;
    const nm = (r: any) => [r.person?.first_name, r.person?.last_name].filter(Boolean).join(" ") || "—";
    body = (
      <AdminTable<any>
        rows={data ?? []}
        rowKey={(r) => r.id}
        emptyLabel={tab === "transfers" ? "No transfers tracked yet." : "No roster changes yet."}
        columns={[
          { key: "d", header: "Date", render: (r) => <span className="text-stone-500">{fmtDay(r.created_at)}</span> },
          {
            key: "p",
            header: "Athlete",
            render: (r) =>
              r.person ? (
                <Link href={`/admin/athletes/${r.person.id}`} className="font-medium text-stone-900 hover:underline">
                  {nm(r)}
                </Link>
              ) : (
                "—"
              ),
          },
          { key: "k", header: "Change", render: (r) => <Pill tone={r.kind === "transfer" ? "info" : r.kind === "left" || r.kind === "archived" ? "warn" : "muted"}>{CHANGE_TEXT[r.kind] ?? r.kind}</Pill> },
          { key: "f", header: "From", render: (r) => r.from_college?.name ?? <span className="text-stone-400">—</span> },
          { key: "t", header: "To", render: (r) => r.to_college?.name ?? <span className="text-stone-400">—</span> },
        ]}
        mobile={{
          title: (r) => nm(r),
          href: (r) => (r.person ? `/admin/athletes/${r.person.id}` : null),
          subtitle: (r) => [CHANGE_TEXT[r.kind] ?? r.kind, r.from_college?.name, r.to_college?.name].filter(Boolean).join(" · "),
        }}
      />
    );
  }

  const tabCount = (k: Tab): string | null =>
    k === "colleges" ? fmtCount(collegesCount.count) : k === "look" ? fmtCount(openIssueCount) : k === "transfers" ? fmtCount(transferCount) : null;
  const result = searchParams.result ? RESULT[searchParams.result] : null;

  return (
    <div>
      <PageHeader
        title="Rosters"
        subtitle="The athlete list updates itself. Bots check every school's athletics site on a schedule and apply the changes. You only step in when a school needs a look."
        actions={<LinkBtn href="/admin/profiles/upload">Upload a roster by hand</LinkBtn>}
      />

      {result && <div className="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-[13px] text-stone-700">{result}</div>}

      <section className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 md:px-5">
        {run ? (
          <Pill tone={run.status === "failed" ? "bad" : "ok"}>{run.status === "failed" ? "● Last run failed" : "● Running automatically"}</Pill>
        ) : (
          <Pill tone="warn">● Not running yet</Pill>
        )}
        <div>
          <div className="text-[12px] text-stone-500">Last run</div>
          <div className="text-[13px] font-medium text-stone-900">
            {run ? `${fmtDay(run.started_at)} · ${run.schools_checked.toLocaleString()} schools checked` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[12px] text-stone-500">Schedule</div>
          <div className="text-[13px] font-medium text-stone-900">
            {settings.data?.[0]?.cadence ? { weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Every month" }[settings.data[0].cadence] ?? "—" : "Not set"}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] text-stone-500">Last run changed</div>
          <div className="text-[13px] font-medium text-stone-900">
            {run
              ? `+${run.added.toLocaleString()} new athletes · ${run.transfers.toLocaleString()} transfers moved · ${run.left_roster.toLocaleString()} left a roster · ${run.new_handles.toLocaleString()} new Instagram handles`
              : "—"}
          </div>
        </div>
        <div className="sm:ml-auto">
          <LinkBtn href="/admin/rosters/settings" small>
            Schedule &amp; rules
          </LinkBtn>
        </div>
      </section>

      <Tiles
        items={[
          { n: fmtCount(collegesCount.count), l: "Colleges tracked", href: "/admin/rosters?tab=colleges" },
          { n: botsPending ? "—" : run ? fmtCount(run.schools_checked) : "0", l: "Updated automatically" },
          { n: fmtCount(openIssueCount), l: "Need a look", flag: (openIssueCount ?? 0) > 0, href: "/admin/rosters" },
          { n: fmtCount(transferCount), l: "Transfers tracked", href: "/admin/rosters?tab=transfers" },
          { n: fmtCount(noIg.count), l: "Athletes with no Instagram yet" },
        ]}
      />

      <Card pad={false}>
        <TabStrip
          current={tab}
          tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "look" ? "/admin/rosters" : `/admin/rosters?tab=${t.key}`, count: tabCount(t.key) }))}
        />
        {tab === "colleges" && <Toolbar action="/admin/rosters" placeholder="Search colleges" q={q} hidden={{ tab }} />}
        <div className="p-3 md:p-4">{body}</div>
        <CardFoot>
          <span>Brings together ColdFusion&apos;s Upload Profiles, Profile Errors and Profile Queue.</span>
          {tab === "colleges" && <span>Athletes = people on the roster at that college (linked college only)</span>}
        </CardFoot>
      </Card>

      {total > PAGE_SIZE && (
        <Paginator page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/rosters" params={{ tab: tab === "look" ? undefined : tab, q: q || undefined }} />
      )}

      <Card title="How the bots know who's who" sub="Instagram is the athlete's ID. Schools change, the Instagram account doesn't." className="mt-4">
        <ol className="grid list-decimal gap-1.5 py-1 pl-5 text-[13px] text-stone-700">
          <li>
            <b>Same Instagram, new school:</b> it&apos;s a transfer. The bot moves the athlete to the new school and keeps the old one as
            &quot;last college&quot;. Their campaign history, app account and payments stay attached.
          </li>
          <li>
            <b>Same Instagram, same school:</b> nothing new. The bot just refreshes sport, class year and other details.
          </li>
          <li>
            <b>New Instagram:</b> a new athlete is added.
          </li>
          <li>
            <b>No Instagram on the roster page:</b> the bot matches on name + sport + school, then looks for their Instagram. If it
            can&apos;t be sure, the athlete goes to &quot;Needs a look&quot; instead of being guessed.
          </li>
          <li>
            <b>Gone from every roster:</b> archived (or flagged, if they have the app). If their Instagram shows up on a new roster
            later, they come right back.
          </li>
        </ol>
      </Card>

      <Note>
        Today the bots&apos; results come in as CSV files that one staff member uploads by hand. In the Hub, results are applied on
        their own: new athletes are added, Instagram handles are filled in, and athletes who left are archived. Uploading by hand
        stays as a backup. {botsPending && "The run, change and issue tables arrive with migration 091 (written, not applied)."}
      </Note>
    </div>
  );
}
