// ============================================================
// /admin/videographers — videographer app accounts.
//
// Source: videographer_profiles (migration 085) — everyone who created
// an account at /desktop or inside the desktop app. Columns: who, based
// in, gear, status (Signed up / Can upload / Inactive), campaigns
// assigned, joined. The status is the one write on this screen: a
// confirmed POST that SELECTs the row, UPDATEs by id, verifies, logs.
//
// "Campaigns assigned" counts `campaigns.videographer_id` (the blended
// campaigns table, 083) against the account's linked booking-roster row
// (videographer_profiles.videographer_id → videographers, 414 rows).
// An account that has not been matched to the roster yet shows "—",
// never 0: the link is what is missing, not the work.
//
// The old booking roster (`videographers`, with rates, travel, ratings)
// is NOT this list; it is surfaced as a count until its own screen
// lands. Nothing is made up to fill the gap.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote, PendingMigration, StatTile } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import { Avatar } from "@/components/admin/people/bits";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { setVideographerStatus } from "./actions";
import { STATUS_HELP, STATUS_LABEL, VIDEOGRAPHER_STATUSES, type VideographerStatus } from "./statuses";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  auth_user_id: string | null;
  person_id: string | null;
  videographer_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  instagram_or_portfolio: string | null;
  city: string | null;
  gear: string | null;
  status: VideographerStatus;
  lucidlink_member_id: string | null;
  signup_source: string;
  created_at: string;
}

const RESULT_NOTES: Record<string, { tone: "ok" | "warn" | "err"; text: string }> = {
  saved: { tone: "ok", text: "Status updated." },
  unchanged: { tone: "warn", text: "That account already had that status — nothing was changed." },
  notfound: { tone: "err", text: "That account no longer exists — nothing was changed." },
  pending085: { tone: "warn", text: "videographer_profiles doesn't exist yet — apply migration 085. Nothing was changed." },
  error: { tone: "err", text: "Status change failed — nothing was changed." },
};

function StatusPill({ status }: { status: VideographerStatus }) {
  const cls =
    status === "can_upload"
      ? "border-status-ok text-status-ok"
      : status === "inactive"
        ? "border-stone-300 text-stone-500"
        : "border-status-warn text-status-warn";
  return (
    <span className={"inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium " + cls}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function linkHref(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^@?[a-z0-9._]{1,30}$/i.test(value)) return `https://instagram.com/${value.replace(/^@/, "")}`;
  return `https://${value}`;
}

export default async function VideographersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const view = getListView("videographers", searchParams);

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const statusFilter = (VIDEOGRAPHER_STATUSES as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as VideographerStatus)
    : null;
  const note = searchParams.result ? RESULT_NOTES[searchParams.result] : undefined;

  const apply = (query: any) => {
    if (statusFilter) query = query.eq("status", statusFilter);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%,gear.ilike.%${q}%`);
    return query;
  };

  const { from, to } = pageRange(page);
  const list = await safeQuery<Row[]>(
    () =>
      apply(
        supabase
          .from("videographer_profiles")
          .select(
            "id, auth_user_id, person_id, videographer_id, full_name, email, phone, instagram_or_portfolio, city, gear, status, lucidlink_member_id, signup_source, created_at"
          )
      )
        .order("created_at", { ascending: false })
        .range(from, to) as any
  );

  const header = (
    <PageHeader
      title="Videographers"
      subtitle="Accounts from the desktop app sign-up. Switch an account to “Can upload” once their LucidLink access is set."
      actions={
        <>
          <ViewToggle listKey="videographers" view={view} />
          <Link href="/desktop" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-50">
            Download page
          </Link>
          <Link href="/admin/users?type=videographer" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-50">
            In App users
          </Link>
        </>
      }
    />
  );

  if (list.pending) {
    return (
      <div>
        {header}
        <PendingMigration migration="085" feature="The videographer account list (videographer_profiles)" />
      </div>
    );
  }
  if (list.error) {
    return (
      <div>
        {header}
        <ErrorNote message={list.error} />
      </div>
    );
  }

  const rows = list.data ?? [];

  // Counts: total per status (for the tiles), the filtered total (for the
  // paginator), the old booking roster, and campaigns assigned per linked
  // roster row. All head/aggregate reads; nothing here writes.
  const rosterIds = Array.from(new Set(rows.map((r) => r.videographer_id).filter((v): v is string => !!v)));
  const [filteredCount, ...statusCounts] = await Promise.all([
    apply(supabase.from("videographer_profiles").select("id", { count: "exact", head: true })),
    ...VIDEOGRAPHER_STATUSES.map((s) =>
      supabase.from("videographer_profiles").select("id", { count: "exact", head: true }).eq("status", s)
    ),
  ]);
  const rosterRes = await supabase.from("videographers").select("id", { count: "exact", head: true });
  const rosterTotal = rosterRes.error ? null : (rosterRes.count ?? 0);

  const assigned = new Map<string, number>();
  if (rosterIds.length > 0) {
    const camp = await safeQuery<Array<{ videographer_id: string | null }>>(
      () => supabase.from("campaigns").select("videographer_id").in("videographer_id", rosterIds) as any
    );
    for (const c of camp.data ?? []) {
      if (c.videographer_id) assigned.set(c.videographer_id, (assigned.get(c.videographer_id) ?? 0) + 1);
    }
  }

  const params = { status: statusFilter ?? undefined, q: q || undefined };
  const returnFields = (
    <>
      {statusFilter && <input type="hidden" name="return_status" value={statusFilter} />}
      {q && <input type="hidden" name="return_q" value={q} />}
      {page > 1 && <input type="hidden" name="return_page" value={String(page)} />}
    </>
  );

  const statusActions = (r: Row) => (
              <div className="flex flex-wrap justify-end gap-1">
                {VIDEOGRAPHER_STATUSES.filter((s) => s !== r.status).map((s) => (
                  <form action={setVideographerStatus} key={s}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value={s} />
                    {returnFields}
                    <ConfirmSubmit
                      variant={s === "inactive" ? "danger" : s === "can_upload" ? "primary" : "quiet"}
                      summary={`Set ${r.full_name} to “${STATUS_LABEL[s]}”? ${STATUS_HELP[s]} This is logged with your name.`}
                      confirmLabel={STATUS_LABEL[s]}
                    >
                      {s === "can_upload" ? "Allow uploads" : s === "inactive" ? "Deactivate" : "Back to signed up"}
                    </ConfirmSubmit>
                  </form>
                ))}
              </div>
            );

  return (
    <div>
      {header}

      {note && (
        <div
          className={
            "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
            (note.tone === "ok"
              ? "border-status-ok bg-green-50 text-status-ok"
              : note.tone === "warn"
                ? "border-status-warn bg-amber-50 text-status-warn"
                : "border-status-bad bg-red-50 text-status-bad")
          }
        >
          {note.text}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {VIDEOGRAPHER_STATUSES.map((s, i) => (
          <StatTile
            key={s}
            label={STATUS_LABEL[s]}
            value={(statusCounts[i].count ?? 0).toLocaleString()}
            href={`/admin/videographers?status=${s}`}
          />
        ))}
        <StatTile label="Booking roster (legacy)" value={rosterTotal == null ? "—" : rosterTotal.toLocaleString()} />
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-4">
        <div className="flex rounded-md border border-stone-300 p-0.5">
          {[null, ...VIDEOGRAPHER_STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/admin/videographers?status=${s}` : "/admin/videographers"}
              className={
                "rounded px-3 py-1 text-[13px] font-medium " +
                (statusFilter === s ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
              }
            >
              {s ? STATUS_LABEL[s] : "All"}
            </Link>
          ))}
        </div>
        <form className="flex-1 min-w-[220px]" action="/admin/videographers" method="GET">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, email, city or gear"
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
          />
        </form>
      </div>

      <AdminTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        view={view}
        cardDetails={["city", "gear", "status", "campaigns"]}
        emptyLabel={q || statusFilter ? "No videographers match." : "No videographer accounts yet. Send the download page link to get the first one."}
        columns={[
          {
            key: "who",
            header: "Videographer",
            render: (r) => (
              <div>
                <div className="font-medium text-stone-900">{r.full_name}</div>
                <div className="text-[12px] text-stone-500">
                  {r.email}
                  {linkHref(r.instagram_or_portfolio) && (
                    <>
                      {" · "}
                      <a href={linkHref(r.instagram_or_portfolio)!} target="_blank" rel="noopener noreferrer" className="text-[#D73F09] hover:underline">
                        portfolio
                      </a>
                    </>
                  )}
                </div>
              </div>
            ),
          },
          { key: "city", header: "Based in", render: (r) => r.city ?? "—" },
          { key: "gear", header: "Gear", secondary: true, render: (r) => <span className="text-stone-600">{r.gear ?? "—"}</span> },
          { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
          {
            key: "campaigns",
            header: "Campaigns assigned",
            align: "right",
            render: (r) =>
              r.videographer_id ? (
                <span className="tabular-nums">{assigned.get(r.videographer_id) ?? 0}</span>
              ) : (
                <span className="text-stone-400" title="Not matched to the booking roster yet">—</span>
              ),
          },
          { key: "phone", header: "Phone", secondary: true, render: (r) => r.phone ?? "—" },
          {
            key: "joined",
            header: "Joined",
            secondary: true,
            render: (r) => (
              <span className="text-stone-500">
                {formatDate(r.created_at)}
                <span className="ml-1 text-stone-400">· {r.signup_source === "desktop_app" ? "app" : r.signup_source}</span>
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            render: statusActions,
          },
        ]}
        mobile={{
          icon: view === "cards" ? (r) => <Avatar name={r.full_name} /> : undefined,
          title: (r) => r.full_name,
          subtitle: (r) => (view === "cards" ? r.email : [r.city, r.email].filter(Boolean).join(" · ")),
          figure: (r) => (view === "cards" ? "" : r.videographer_id ? `${assigned.get(r.videographer_id) ?? 0} campaigns` : ""),
          // Cards aren't links here, so the status buttons can sit on them.
          strip: view === "cards" ? statusActions : (r) => <StatusPill status={r.status} />,
        }}
      />

      <Paginator page={page} total={filteredCount.count ?? 0} pageSize={PAGE_SIZE} basePath="/admin/videographers" params={params} />

      <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] text-stone-600">
        Status changes happen here, one account at a time, with a confirmation. On a phone the
        status buttons are on the desktop view only. The old booking roster (
        <code className="rounded bg-stone-200 px-1">videographers</code>, with day rates, travel and ratings)
        is not this list; accounts get matched to it by email so &ldquo;campaigns assigned&rdquo; can be
        counted.
      </div>
    </div>
  );
}
