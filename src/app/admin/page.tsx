// ============================================================
// /admin — Workspace (the prototype's S.workspace, ws2.js): one plain
// table of open campaigns — Campaign / Stage / Next task / Open — with
// a "Viewing as <staff member>" select, scope tabs (My campaigns ·
// Everyone's), the View as Staff / Brand employee / Athlete switch,
// and a sort (Due date · Stage · Name).
//
// Data: campaigns (is_active) joined to brands and people. Stage, due
// date and director are optional columns, feature-detected; the
// checklist comes from campaign_checklist_steps when that table
// exists. Nothing is invented: a missing column is "—" and the footer
// says what isn't connected yet.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { sanitizeFilterValue } from "@/lib/admin/db";
import { brandLogo } from "@/lib/admin/campaigns/queries";
import { personName } from "@/lib/admin/campaigns/types";
import { ErrorNote } from "@/components/admin/ui";
import { Btn, Pill } from "@/components/admin/campaign/bits";
import NavIcon from "@/components/admin/NavIcon";
import {
  CHECKLIST,
  dueTone,
  loadChecklistNext,
  loadOpenCampaigns,
  loadPersonIdsForEmail,
  loadStaff,
  stageIndex,
  stageLabel,
  stageTone,
  type WorkspaceRow,
} from "@/lib/admin/workspace";
import ViewAsSelect from "./ViewAsSelect";
import ViewAsSwitch from "@/components/admin/view-as/ViewAsSwitch";
import ViewToggle from "@/components/admin/ViewToggle";
import { brandMarkUrl } from "@/lib/admin/brand-marks";
import { getListView } from "@/lib/admin/list-view";
import { loadAthleteOptions, loadBrandOptions } from "@/lib/admin/view-as/queries";

export const dynamic = "force-dynamic";

type Scope = "all" | "mine";
type Sort = "due" | "stage" | "name";

const firstName = (full: string | null) => (full ? full.split(/\s+/)[0] : null);

function initials(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "—";
  const parts = n.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase();
}

/** Bare brand mark — the logo file from the brands row, no container. */
function BrandMark({ row }: { row: WorkspaceRow }) {
  const logo = brandMarkUrl(row.brand?.name) ?? brandLogo(row.brand, "light");
  if (logo) {
    return <img src={logo} alt={row.brand?.name ?? ""} className="h-[30px] w-[30px] shrink-0 object-contain" />;
  }
  return (
    <span
      title={row.brand?.name ?? "No brand set"}
      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[7px] bg-[#F1F2F4] text-[11px] font-semibold text-stone-500"
    >
      {initials(row.brand?.name ?? null)}
    </span>
  );
}

function fmtDue(due: string | null): string {
  if (!due) return "—";
  const d = new Date(due + (due.length === 10 ? "T12:00:00" : ""));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const user = await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const scope: Scope = searchParams.scope === "all" ? "all" : "mine";
  const sort: Sort = searchParams.sort === "stage" ? "stage" : searchParams.sort === "name" ? "name" : "due";
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const view = getListView("workspace", searchParams);

  const [staffList, open, brandOptions, athleteOptions] = await Promise.all([
    loadStaff(supabase),
    loadOpenCampaigns(supabase),
    loadBrandOptions().catch(() => []),
    loadAthleteOptions().catch(() => []),
  ]);

  // Who we're viewing as: ?as=<profile id>, else the signed-in user.
  const viewingId = searchParams.as && staffList.staff.some((s) => s.id === searchParams.as) ? searchParams.as : user.id;
  const viewing =
    staffList.staff.find((s) => s.id === viewingId) ??
    ({ id: user.id, label: user.email ?? "You", email: user.email, level: user.accessLevel.charAt(0).toUpperCase() + user.accessLevel.slice(1) } as const);
  const viewingSelf = viewing.id === user.id;

  const [personIds, checklist] = await Promise.all([
    loadPersonIdsForEmail(supabase, viewing.email),
    loadChecklistNext(
      supabase,
      open.rows.map((r) => r.id)
    ),
  ]);
  const mineSet = new Set(personIds);
  const isMine = (r: WorkspaceRow) =>
    (r.manager && mineSet.has(r.manager.id)) ||
    (r.assistant && mineSet.has(r.assistant.id)) ||
    (r.director && mineSet.has(r.director.id)) ||
    false;

  const mine = open.rows.filter(isMine);
  let rows = (scope === "mine" ? mine : open.rows).slice();
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(needle) || (r.brand?.name ?? "").toLowerCase().includes(needle)
    );
  }
  rows.sort((a, b) => {
    if (sort === "due" && open.hasDue) return (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.name.localeCompare(b.name);
    if (sort === "stage" && open.hasStage) return stageIndex(a.stage) - stageIndex(b.stage) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });

  const today = new Date();
  const late = open.hasDue ? mine.filter((r) => dueTone(r.due, today) === "bad").length : 0;
  const week = open.hasDue ? mine.filter((r) => dueTone(r.due, today) === "warn").length : 0;

  const who = viewingSelf ? "you" : firstName(viewing.label) ?? viewing.label;
  const subtitle = (
    <>
      {mine.length.toLocaleString("en-US")} open {mine.length === 1 ? "campaign" : "campaigns"} assigned to {who} ·{" "}
      {open.rows.length.toLocaleString("en-US")} open across the team
      {open.hasDue && (
        <>
          {late > 0 && (
            <>
              {" "}
              · <b className="text-status-bad">{late} past due</b>
            </>
          )}
          {" "}· {week} due this week
        </>
      )}
    </>
  );

  const keep = { scope, sort, q: q || undefined, as: viewingSelf ? undefined : viewing.id };
  const hrefWith = (patch: Partial<Record<"scope" | "sort" | "q" | "as", string | undefined>>) => {
    const p = new URLSearchParams();
    const merged = { ...keep, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  const segBtn = (active: boolean, disabled = false) =>
    "rounded-md px-3 py-[5px] text-[13px] font-medium " +
    (active ? "bg-white text-stone-900 shadow-sm" : disabled ? "cursor-default text-stone-400" : "text-stone-500 hover:text-stone-900");

  const notes: string[] = [
    "Campaigns, brands and managers come from the Hub campaigns table.",
    checklist.connected
      ? `"Next task" is the first unchecked step on the campaign's ${CHECKLIST.length}-step checklist.`
      : "Checklist not connected yet — \"Next task\" fills in once campaign checklists sync to the Hub.",
  ];
  if (!open.hasStage && !open.hasDue) notes.push("Stages and due dates are not connected yet.");
  else if (!open.hasStage) notes.push("Stages are not connected yet.");
  else if (!open.hasDue) notes.push("Due dates are not connected yet.");

  return (
    <div>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Workspace</h1>
          <p className="mt-0.5 text-[13px] text-stone-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ViewAsSwitch mode="staff" brands={brandOptions} athletes={athleteOptions} />
          <Btn href="/admin/campaigns/new" primary>
            <NavIcon name="plus" size={15} />
            Campaign
          </Btn>
        </div>
      </div>

      {/* Viewing as */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-[#F1F2F4] px-3 py-2">
        <span className="text-[12px] text-stone-500">Viewing as</span>
        {staffList.staff.length ? (
          <ViewAsSelect
            options={staffList.staff.map((s) => ({ id: s.id, label: s.label }))}
            value={viewing.id}
            params={{ scope, sort, q: q || undefined }}
          />
        ) : (
          <span className="text-[13px] font-medium text-stone-900">{viewing.label}</span>
        )}
        <span className="text-[12px] text-stone-500">{viewing.level}</span>
        <span className="text-[12px] text-stone-500 sm:ml-auto">
          {staffList.pending
            ? "Staff list arrives with access levels (migration 022)."
            : "Each person sees their own campaigns first."}
        </span>
      </div>

      {open.error ? (
        <ErrorNote message={`Could not load campaigns: ${open.error}`} />
      ) : (
        <section className="min-w-0 rounded-xl border border-[#E3E5E9] bg-white">
          {/* Toolbar: scope · sort · search */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#E3E5E9] px-3 py-3 md:px-4">
            <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-[#F1F2F4] p-[3px]">
              <Link href={hrefWith({ scope: "mine" })} aria-pressed={scope === "mine"} className={segBtn(scope === "mine")}>
                {viewingSelf ? "My campaigns" : `${firstName(viewing.label) ?? "Their"}'s campaigns`}
              </Link>
              <Link href={hrefWith({ scope: "all" })} aria-pressed={scope === "all"} className={segBtn(scope === "all")}>
                Everyone&rsquo;s
              </Link>
            </div>
            <span className="ml-1 text-[12px] text-stone-500">Sort by</span>
            <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-[#F1F2F4] p-[3px]">
              {open.hasDue ? (
                <Link href={hrefWith({ sort: "due" })} aria-pressed={sort === "due"} className={segBtn(sort === "due")}>
                  Due date
                </Link>
              ) : (
                <span title="Due dates not connected yet" aria-disabled className={segBtn(false, true)}>
                  Due date
                </span>
              )}
              {open.hasStage ? (
                <Link href={hrefWith({ sort: "stage" })} aria-pressed={sort === "stage"} className={segBtn(sort === "stage")}>
                  Stage
                </Link>
              ) : (
                <span title="Stages not connected yet" aria-disabled className={segBtn(false, true)}>
                  Stage
                </span>
              )}
              <Link
                href={hrefWith({ sort: "name" })}
                aria-pressed={sort === "name" || (sort === "due" && !open.hasDue) || (sort === "stage" && !open.hasStage)}
                className={segBtn(sort === "name" || (sort === "due" && !open.hasDue) || (sort === "stage" && !open.hasStage))}
              >
                Name
              </Link>
            </div>
            <ViewToggle listKey="workspace" view={view} />
            <form action="/admin" method="get" className="flex h-[34px] min-w-0 flex-1 basis-[200px] items-center gap-2 rounded-lg border border-[#E3E5E9] bg-white px-2.5 text-stone-500 md:ml-auto md:max-w-[320px] md:flex-none">
              {scope !== "mine" && <input type="hidden" name="scope" value={scope} />}
              {sort !== "due" && <input type="hidden" name="sort" value={sort} />}
              {!viewingSelf && <input type="hidden" name="as" value={viewing.id} />}
              <NavIcon name="search" size={15} />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search campaigns..."
                aria-label="Search campaigns"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-stone-900 outline-none placeholder:text-stone-500"
              />
            </form>
          </div>

          {/* Cards, or the table (which scrolls sideways inside the card on narrow screens) */}
          {view === "cards" ? (
            rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-stone-500">
                {q ? "No open campaigns match." : scope === "mine" ? `No open campaigns are assigned to ${who} in the Hub yet.` : "No open campaigns. Campaigns marked active show here."}
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:p-4 xl:grid-cols-3">
                {rows.map((r) => {
                  const href = `/admin/campaigns/${r.id}`;
                  const mgr = firstName(personName(r.manager));
                  const owner = r.director ?? r.manager;
                  const ownerRole = r.director ? "Director" : "Manager";
                  const nextIdx = checklist.connected ? checklist.next.get(r.id) ?? 0 : null;
                  const tone = dueTone(r.due, today);
                  return (
                    <li key={r.id} className="min-w-0">
                      <Link
                        href={href}
                        className="flex h-full flex-col gap-3 rounded-[10px] border border-[#E3E5E9] bg-white p-3.5 text-inherit no-underline transition-colors hover:border-stone-300"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <BrandMark row={r} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-stone-900">{r.name}</span>
                            <span className="block truncate text-[12px] text-stone-500">
                              {r.brand?.name ?? "Set brand"} · {mgr ?? "No manager"}
                            </span>
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-[12px]">
                          {open.hasStage && r.stage ? (
                            <Pill tone={stageTone(r.stage)}>{stageLabel(r.stage)}</Pill>
                          ) : (
                            <span className="text-stone-400">No stage</span>
                          )}
                          {open.hasDue && r.due && (
                            <span className={tone === "bad" ? "text-status-bad" : tone === "warn" ? "text-status-warn" : "text-stone-500"}>
                              Due {fmtDue(r.due)}
                            </span>
                          )}
                        </span>
                        <span className="mt-auto border-t border-[#E3E5E9] pt-2.5 text-[13px]">
                          <span className="block text-[11px] uppercase tracking-wide text-stone-400">Next task</span>
                          {nextIdx == null ? (
                            <span className="block text-stone-500">Checklist not connected yet</span>
                          ) : nextIdx >= CHECKLIST.length ? (
                            <span className="block font-medium text-stone-900">All steps done</span>
                          ) : (
                            <>
                              <span className="block truncate font-medium text-stone-900">{CHECKLIST[nextIdx]}</span>
                              <span className="block text-[12px] text-stone-500">
                                Step {nextIdx + 1} of {CHECKLIST.length}
                                {owner && ` · ${ownerRole} ${firstName(personName(owner))}`}
                              </span>
                            </>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <thead>
                <tr>
                  {["Campaign", "Stage", "Next task", ""].map((h, i) => (
                    <th
                      key={i}
                      className="whitespace-nowrap border-b border-[#E3E5E9] bg-[#FAFAFB] px-3.5 py-2 text-left text-[12px] font-medium text-stone-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-stone-500">
                      {q ? (
                        "No open campaigns match."
                      ) : scope === "mine" ? (
                        <>
                          No open campaigns are assigned to {who} in the Hub yet.{" "}
                          <Link href={hrefWith({ scope: "all" })} className="font-medium text-[#D73F09] hover:underline">
                            See all open campaigns
                          </Link>
                        </>
                      ) : (
                        "No open campaigns. Campaigns marked active show here."
                      )}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const href = `/admin/campaigns/${r.id}`;
                    const mgr = firstName(personName(r.manager));
                    const owner = r.director ?? r.manager;
                    const ownerRole = r.director ? "Director" : "Manager";
                    const nextIdx = checklist.connected ? checklist.next.get(r.id) ?? 0 : null;
                    const tone = dueTone(r.due, today);
                    return (
                      <tr key={r.id} className="hover:[&>td]:bg-[#FAFAFB]">
                        <td className="border-b border-[#E3E5E9] px-3.5 py-2.5 align-middle">
                          <Link href={href} className="flex min-w-0 items-center gap-2.5 text-inherit no-underline">
                            <BrandMark row={r} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-stone-900">{r.name}</span>
                              <span className="block truncate text-[12px] text-stone-500">
                                {r.brand?.name ? r.brand.name : <span className="text-[#D73F09]">Set brand</span>}
                                {" · "}
                                {mgr ?? "No manager"}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="border-b border-[#E3E5E9] px-3.5 py-2.5 align-middle">
                          {open.hasStage ? (
                            r.stage ? (
                              <Pill tone={stageTone(r.stage)}>{stageLabel(r.stage)}</Pill>
                            ) : (
                              <span className="text-[12px] text-stone-500">No stage</span>
                            )
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                          {open.hasDue && r.due && (
                            <span
                              className={
                                "ml-2 text-[12px] " +
                                (tone === "bad" ? "text-status-bad" : tone === "warn" ? "text-status-warn" : "text-stone-500")
                              }
                            >
                              Due {fmtDue(r.due)}
                            </span>
                          )}
                        </td>
                        <td className="border-b border-[#E3E5E9] px-3.5 py-2.5 align-middle">
                          {nextIdx == null ? (
                            <>
                              <span className="block text-stone-400">—</span>
                              <span className="block text-[12px] text-stone-500">Checklist not connected yet</span>
                            </>
                          ) : nextIdx >= CHECKLIST.length ? (
                            <>
                              <span className="block font-medium text-stone-900">All steps done</span>
                              <span className="block text-[12px] text-stone-500">{CHECKLIST.length} of {CHECKLIST.length}</span>
                            </>
                          ) : (
                            <>
                              <span className="block font-medium text-stone-900">{CHECKLIST[nextIdx]}</span>
                              <span className="block text-[12px] text-stone-500">
                                Step {nextIdx + 1} of {CHECKLIST.length}
                                {owner && ` · ${ownerRole} ${firstName(personName(owner))}`}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="border-b border-[#E3E5E9] px-3.5 py-2.5 text-right align-middle">
                          <Btn href={href} small>
                            Open
                          </Btn>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E3E5E9] px-3 py-2.5 text-[12px] text-stone-500 md:px-4">
            <span>{notes.join(" ")}</span>
            <span className="tabular-nums">{rows.length.toLocaleString("en-US")} shown</span>
          </div>
        </section>
      )}
    </div>
  );
}
