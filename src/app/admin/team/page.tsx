// ============================================================
// /admin/team — Team (prototype S.team). Postgame staff, their
// access level, and the open campaigns they run or direct.
//
// Staff and campaigns come from the same loaders the Workspace uses
// (src/lib/admin/workspace.ts), so the counts here always agree with
// what each person sees on their own Workspace. Director and stage
// columns are feature-detected: before they exist they show "—".
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadOpenCampaigns, loadPersonIdsForEmail, loadStaff, stageLabel } from "@/lib/admin/workspace";
import { PageHeader, ErrorNote, PendingMigration } from "@/components/admin/ui";
import { Avatar, CardFoot, Tiles } from "@/components/admin/ops-bits";
import { Pill } from "@/components/admin/campaign/bits";
import { Dim, HubNote, SimpleTable, btnCls } from "@/components/admin/tools/bits";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";

export const dynamic = "force-dynamic";

const LEVEL_TONE: Record<string, "ok" | "info" | "muted"> = { Exec: "ok", Admin: "info" };

export default async function TeamPage({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const view = getListView("team", searchParams);
  const supabase = createServiceSupabase();

  const [staffList, open] = await Promise.all([loadStaff(supabase), loadOpenCampaigns(supabase)]);
  const personIdsByStaff = await Promise.all(staffList.staff.map((s) => loadPersonIdsForEmail(supabase, s.email)));

  const rows = staffList.staff.map((s, i) => {
    const ids = new Set(personIdsByStaff[i]);
    const runs = open.rows.filter((r) => (r.manager && ids.has(r.manager.id)) || (r.assistant && ids.has(r.assistant.id)));
    const directs = open.hasDirector ? open.rows.filter((r) => r.director && ids.has(r.director.id)) : [];
    const stages = new Map<string, number>();
    for (const r of runs) stages.set(r.stage ?? "", (stages.get(r.stage ?? "") ?? 0) + 1);
    return { s, runs: runs.length, directs: directs.length, stages };
  });

  const noManager = open.rows.filter((r) => !r.manager).length;
  const noDirector = open.rows.filter((r) => !r.director).length;
  const noStage = open.rows.filter((r) => !r.stage).length;

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Postgame staff, their role, and the campaigns they run."
        actions={
          <>
            <ViewToggle listKey="team" view={view} />
            <Link href="/admin/access" className={btnCls}>
              Manage access
            </Link>
          </>
        }
      />

      <Tiles
        tiles={[
          { n: open.rows.length.toLocaleString(), l: "Open campaigns", href: "/admin/campaigns" },
          { n: staffList.staff.length.toLocaleString(), l: "Staff with Hub access" },
          { n: rows.filter((r) => r.runs > 0).length.toLocaleString(), l: "Running a campaign" },
          { n: noManager.toLocaleString(), l: "No manager set", flag: noManager > 0 },
          open.hasDirector
            ? { n: noDirector.toLocaleString(), l: "No director set", flag: noDirector > 0 }
            : open.hasStage
              ? { n: noStage.toLocaleString(), l: "No stage set", flag: noStage > 0 }
              : { n: "—", l: "Director field (not added yet)" },
        ]}
      />

      {staffList.pending && <PendingMigration migration="022_admin_access_levels" feature="The staff list" />}
      {open.error && <ErrorNote message={`Campaigns could not load: ${open.error}`} />}

      <section className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
        <SimpleTable
          rows={rows}
          rowKey={(r) => r.s.id}
          empty="No staff accounts found."
          view={view}
          card={(r) => ({
            icon: <Avatar name={r.s.label} />,
            title: r.s.label,
            subtitle: r.s.email,
            strip: <Pill tone={LEVEL_TONE[r.s.level] ?? "muted"}>{r.s.level}</Pill>,
            details: [
              { label: "Runs", value: r.runs ? r.runs : <Dim>—</Dim> },
              { label: "Directs", value: open.hasDirector && r.directs ? r.directs : <Dim>—</Dim> },
            ],
            foot:
              open.hasStage && r.runs > 0 ? (
                <span className="block truncate text-[12px] text-stone-500">
                  {Array.from(r.stages.entries())
                    .map(([k, v]) => `${v} ${k ? stageLabel(k).toLowerCase() : "no stage"}`)
                    .join(" · ")}
                </span>
              ) : (
                <span className="text-[12px] font-medium text-[#D73F09]">View their workspace</span>
              ),
            href: `/admin?as=${r.s.id}`,
          })}
          cols={[
            {
              h: "Name",
              r: (r) => (
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.s.label} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-900">{r.s.label}</div>
                    {r.s.email && <div className="truncate text-[12px] text-stone-500">{r.s.email}</div>}
                  </div>
                </div>
              ),
            },
            { h: "Access", r: (r) => <Pill tone={LEVEL_TONE[r.s.level] ?? "muted"}>{r.s.level}</Pill> },
            { h: "Runs", num: true, r: (r) => (r.runs ? r.runs : <Dim>—</Dim>) },
            { h: "Directs", num: true, r: (r) => (open.hasDirector && r.directs ? r.directs : <Dim>—</Dim>) },
            {
              h: "Stages of their campaigns",
              r: (r) =>
                !open.hasStage || r.runs === 0 ? (
                  <Dim>—</Dim>
                ) : (
                  <span className="text-[12px] text-stone-500">
                    {Array.from(r.stages.entries())
                      .map(([k, v]) => `${v} ${k ? stageLabel(k).toLowerCase() : "no stage"}`)
                      .join(" · ")}
                  </span>
                ),
            },
            {
              h: "",
              r: (r) => (
                <Link href={`/admin?as=${r.s.id}`} className="whitespace-nowrap text-[12px] font-medium text-[#D73F09] hover:underline">
                  View their workspace
                </Link>
              ),
            },
          ]}
        />
        <CardFoot>
          <span>Staff are the Hub logins with staff, admin or exec access. Runs counts open campaigns where they are the manager or assistant.</span>
        </CardFoot>
      </section>

      <div className="mt-4">
        <HubNote>
          Today the owner of a campaign mostly lives in Asana: the person whose section it sits in runs it, and the Director field
          names who oversees it. In the Hub the campaign itself carries its Director, Manager and Assistant, and that is what each
          person&apos;s Workspace is built from. Campaigns with no manager set don&apos;t show up on anyone&apos;s Workspace yet.
        </HubNote>
      </div>
    </div>
  );
}
