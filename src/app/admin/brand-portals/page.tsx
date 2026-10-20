// ============================================================
// /admin/brand-portals — Brand portals (staff), prototype
// S["brand-portals"] (last definition): every brand's private portal,
// with "View as brand" opening that portal inside this shell
// (/admin/view-as/brand/<id>) and "Add seat" going to Access.
//
// Data: portal_campaigns (campaign counts, in flight, latest) and
// brand_contacts (active portal logins). Logos from the brands row —
// dark-ink mark on this white page.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { loadPortalBrands } from "@/lib/admin/view-as/queries";
import { shortDate } from "@/lib/admin/view-as/types";
import { ErrorNote, Paginator } from "@/components/admin/ui";
import { CardFoot, CardTabs, Toolbar } from "@/components/admin/ops-bits";
import { BrandMark } from "@/components/admin/brand-bits";
import { Btn } from "@/components/admin/campaign/bits";
import NavIcon from "@/components/admin/NavIcon";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";

export const dynamic = "force-dynamic";

const PAGE = 50;

export default async function BrandPortalsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const tab = searchParams.tab === "all" ? "all" : "live";
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const view = getListView("brand-portals", searchParams);

  const { rows, error, usersPending } = await loadPortalBrands();
  const inFlight = rows.filter((r) => r.active > 0);
  let list = (tab === "live" ? inFlight : rows).filter((r) => !q || r.name.toLowerCase().includes(q));
  list = list.slice().sort((a, b) => (tab === "live" ? b.active - a.active : 0) || b.total - a.total || a.name.localeCompare(b.name));
  const total = list.length;
  const pageRows = list.slice((page - 1) * PAGE, page * PAGE);
  const withUsers = rows.filter((r) => (r.users ?? 0) > 0).length;

  const th = "whitespace-nowrap border-b border-stone-200 bg-[#FAFAFB] px-3.5 py-2 text-left text-[12px] font-medium text-stone-500";
  const td = "border-b border-stone-100 px-3.5 py-2.5 align-middle";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Brand portals</h1>
          <p className="mt-0.5 text-[13px] text-stone-500">
            Each brand&rsquo;s private portal: the same shell as this admin, with brand-only tabs. Brand users log in; no more shared links.
          </p>
        </div>
        <Btn href="/admin/access">
          <NavIcon name="shield" size={15} />
          Access
        </Btn>
      </div>

      {error ? (
        <ErrorNote message={`Could not load brand portals: ${error}`} />
      ) : (
        <section className="min-w-0 rounded-xl border border-stone-200 bg-white">
          <CardTabs
            tabs={[
              { href: "/admin/brand-portals", label: "In flight", count: inFlight.length, active: tab === "live" },
              { href: "/admin/brand-portals?tab=all", label: "All brands", count: rows.length, active: tab === "all" },
            ]}
          />
          <Toolbar action="/admin/brand-portals" placeholder="Search brands" q={searchParams.q} hidden={{ tab: tab === "all" ? "all" : undefined }} right={<ViewToggle listKey="brand-portals" view={view} />} />
          {view === "cards" ? (
            pageRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-stone-500">
                {q ? "No brands match." : tab === "live" ? "No brands have a campaign in flight." : "No brands with campaigns yet."}
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:p-4 xl:grid-cols-3">
                {pageRows.map((r) => (
                  <li key={r.id} className="min-w-0">
                    <div className="flex h-full flex-col gap-3 rounded-[10px] border border-[#E3E5E9] bg-white p-3.5 transition-colors hover:border-stone-300">
                      <Link href={`/admin/brands/${r.id}`} className="flex flex-col gap-3 text-inherit no-underline">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <BrandMark src={r.logo} name={r.name} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-stone-900">{r.name}</span>
                            <span className="block truncate text-[12px] text-stone-500">
                              {r.latestName ? `Latest: ${r.latestName}` : "No campaigns yet"}
                              {r.latestDate ? ` · ${shortDate(r.latestDate)}` : ""}
                            </span>
                          </span>
                        </span>
                        <span className="grid grid-cols-3 gap-2 text-[12px]">
                          <span>
                            <span className="block text-[11px] uppercase tracking-wide text-stone-400">Campaigns</span>
                            <span className="block font-medium tabular-nums text-stone-900">{r.total.toLocaleString("en-US")}</span>
                          </span>
                          <span>
                            <span className="block text-[11px] uppercase tracking-wide text-stone-400">In flight</span>
                            <span className={"block font-medium tabular-nums " + (r.active ? "text-stone-900" : "text-stone-400")}>{r.active.toLocaleString("en-US")}</span>
                          </span>
                          <span>
                            <span className="block text-[11px] uppercase tracking-wide text-stone-400">Seats</span>
                            <span className={"block font-medium tabular-nums " + (r.users ? "text-stone-900" : "text-stone-400")}>{r.users == null ? "—" : r.users}</span>
                          </span>
                        </span>
                      </Link>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[#E3E5E9] pt-2.5">
                        <Btn href={`/admin/view-as/brand/${r.id}`} small>
                          Open portal
                        </Btn>
                        <Link
                          href={`/admin/access?brand=${r.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                        >
                          <NavIcon name="plus" size={13} />
                          Add seat
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className={th}>Brand</th>
                  <th className={th + " text-right"}>Campaigns</th>
                  <th className={th + " text-right"}>In flight</th>
                  <th className={th}>Latest campaign</th>
                  <th className={th + " text-right"}>Seats</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-stone-500">
                      {q ? "No brands match." : tab === "live" ? "No brands have a campaign in flight." : "No brands with campaigns yet."}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id} className="hover:[&>td]:bg-[#FAFAFB]">
                      <td className={td}>
                        <Link href={`/admin/brands/${r.id}`} className="flex min-w-0 items-center gap-2.5 text-inherit">
                          <BrandMark src={r.logo} name={r.name} />
                          <span className="truncate font-medium text-stone-900">{r.name}</span>
                        </Link>
                      </td>
                      <td className={td + " text-right tabular-nums"}>{r.total.toLocaleString("en-US")}</td>
                      <td className={td + " text-right tabular-nums"}>{r.active ? r.active.toLocaleString("en-US") : <span className="text-stone-400">0</span>}</td>
                      <td className={td}>
                        <div className="max-w-[260px] truncate text-stone-900">{r.latestName ?? "—"}</div>
                        {r.latestDate && <div className="text-[12px] text-stone-500">{shortDate(r.latestDate)}</div>}
                      </td>
                      <td className={td + " text-right tabular-nums"}>{r.users == null ? <span className="text-stone-400">—</span> : r.users || <span className="text-stone-400">0</span>}</td>
                      <td className={td + " whitespace-nowrap text-right"}>
                        <span className="inline-flex gap-1.5">
                          <Btn href={`/admin/view-as/brand/${r.id}`} small>
                            Open portal
                          </Btn>
                          <Link
                            href={`/admin/access?brand=${r.id}`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                          >
                            <NavIcon name="plus" size={13} />
                            Add seat
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
          {total > PAGE && (
            <div className="border-t border-stone-200 px-3">
              <Paginator page={page} total={total} pageSize={PAGE} basePath="/admin/brand-portals" params={{ tab: tab === "all" ? "all" : undefined, q: searchParams.q, view: searchParams.view }} />
            </div>
          )}
          <CardFoot>
            <span>
              Real brands and campaign counts from the portal&rsquo;s campaign view.{" "}
              {usersPending ? "Portal users fill in once brand logins exist." : `${withUsers} brand${withUsers === 1 ? " has" : "s have"} portal logins so far.`}
            </span>
            <span className="tabular-nums">{total.toLocaleString("en-US")} shown</span>
          </CardFoot>
        </section>
      )}
    </div>
  );
}
