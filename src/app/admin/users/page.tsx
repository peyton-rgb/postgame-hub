// ============================================================
// /admin/users — App users.
//
// Everyone who uses the Postgame app, one tab per kind of person
// (the approved prototype's S["app-users"] screen):
//
//   Current athletes      people · person_type 'Athlete', not high school
//   High school athletes  people · roster_status 'high_school_athlete'
//   Former athletes       people · person_type 'Former Athlete'
//   Coaches               coach_profiles        (migration 085)
//   Videographers         videographer_profiles (migration 085)
//   Agents                agent_profiles        (migration 085)
//
// `people` is the ColdFusion users table (52,809 rows) — every roster
// profile that ever had an app account — so the athlete tabs read from
// it directly. The three new types are self-service sign-ups and have
// their own tables; until 085 is applied those tabs show an honest
// pending state, never placeholder rows.
//
// There is no "Fan" tab on purpose: the 2,220 old Fan accounts get
// sorted into these groups, not listed as a type.
//
// Kept from the old Users list: 50/page, CF search semantics (name,
// handle, phone last 4, college), the /admin/users/[id] edit page, and
// the legacy admin-account list behind ?type=admins (not a tab).
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote, PendingMigration } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import { Avatar } from "@/components/admin/people/bits";
import { USER_TYPE_LABELS } from "@/lib/signup/types";

export const dynamic = "force-dynamic";

type TabKey = "current" | "high_school" | "former" | "coach" | "videographer" | "agent" | "admins";

interface Tab {
  key: TabKey;
  label: string;
  /** athlete tabs read `people`; the rest read a sign-up table */
  source: "people" | "coach_profiles" | "videographer_profiles" | "agent_profiles";
}

const TABS: Tab[] = [
  { key: "current", label: "Current athletes", source: "people" },
  { key: "high_school", label: "High school athletes", source: "people" },
  { key: "former", label: "Former athletes", source: "people" },
  { key: "coach", label: "Coaches", source: "coach_profiles" },
  { key: "videographer", label: "Videographers", source: "videographer_profiles" },
  { key: "agent", label: "Agents", source: "agent_profiles" },
];

/** Legacy ColdFusion admin accounts — reachable, not a tab. */
const ADMIN_TYPES = ["Super Admin", "Admin", "Admin Finance", "Admin Sales"];

// ---------- people (athlete tabs) ----------

interface PersonRow {
  id: string;
  admin_user_id: number | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
  college_raw: string | null;
  sport: string | null;
  device: string | null;
  person_type: string | null;
  roster_status: string | null;
  admin_profile_id: string | null;
  admin_created_at: string | null;
  /** arrives with migration 083 — absent on production today */
  date_last_login?: string | null;
}

const PEOPLE_COLS =
  "id, admin_user_id, first_name, last_name, email, phone, instagram_handle, instagram_followers, college_raw, sport, device, person_type, roster_status, admin_profile_id, admin_created_at";

function peopleFilter(tab: TabKey, q: string) {
  // Returns a function that narrows a people query to the tab + search.
  return (query: any) => {
    if (tab === "current") {
      query = query.eq("person_type", "Athlete").or("roster_status.is.null,roster_status.neq.high_school_athlete");
    } else if (tab === "high_school") {
      query = query.eq("roster_status", "high_school_athlete");
    } else if (tab === "former") {
      query = query.eq("person_type", "Former Athlete");
    } else if (tab === "admins") {
      query = query.in("person_type", ADMIN_TYPES);
    }
    if (q) {
      const terms = [
        `first_name.ilike.%${q}%`,
        `last_name.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `instagram_handle.ilike.%${q}%`,
        `college_raw.ilike.%${q}%`,
      ];
      // CF semantics: a 4-digit search matches the LAST 4 of the phone
      if (/^\d{4}$/.test(q)) terms.push(`phone.ilike.%${q}`);
      else if (/^[\d\s()+-]{5,}$/.test(q)) terms.push(`phone.ilike.%${q}%`);
      query = query.or(terms.join(","));
    }
    return query;
  };
}

// ---------- sign-up tables (coach / videographer / agent tabs) ----------

interface SignupRow {
  id: string;
  auth_user_id: string | null;
  person_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  // one of these per table
  agency?: string | null;
  school?: string | null;
  city?: string | null;
  title?: string | null;
  gear?: string | null;
}

const SIGNUP_COLS: Record<Exclude<Tab["source"], "people">, string> = {
  coach_profiles: "id, auth_user_id, person_id, full_name, email, phone, status, created_at, school, title",
  videographer_profiles: "id, auth_user_id, person_id, full_name, email, phone, status, created_at, city, gear",
  agent_profiles: "id, auth_user_id, person_id, full_name, email, phone, status, created_at, agency, title",
};

const STATUS_LABEL: Record<string, string> = {
  signed_up: "Signed up",
  can_upload: "Can upload",
  inactive: "Inactive",
  pending: "Pending review",
  approved: "Approved",
};

async function headCount(
  run: () => PromiseLike<{ count: number | null; error: { code?: string; message?: string } | null }>
): Promise<number | null> {
  try {
    const { count, error } = await run();
    if (error) return null; // missing table/column or a real error: show "—"
    return count ?? 0;
  } catch {
    return null;
  }
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  const cls =
    tone === "ok"
      ? "border-status-ok text-status-ok"
      : tone === "warn"
        ? "border-status-warn text-status-warn"
        : "border-stone-300 text-stone-600";
  return (
    <span className={"inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium " + cls}>
      {children}
    </span>
  );
}

export default async function AppUsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const view = getListView("users", searchParams);

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const tabKey: TabKey =
    searchParams.type === "admins"
      ? "admins"
      : (TABS.find((t) => t.key === searchParams.type)?.key ?? "current");
  const tab: Tab = TABS.find((t) => t.key === tabKey) ?? { key: "admins", label: "Admin accounts (legacy)", source: "people" };
  const { from, to } = pageRange(page);

  // Tab counts — one head query each, in parallel. A sign-up table that
  // does not exist yet (085 unapplied) counts as "—", not zero.
  const countValues: Array<number | null> = await Promise.all(
    TABS.map((t) =>
      headCount(() =>
        t.source === "people"
          ? peopleFilter(t.key, "")(supabase.from("people").select("id", { count: "exact", head: true }))
          : supabase.from(t.source).select("id", { count: "exact", head: true })
      )
    )
  );

  const params = { type: tabKey === "current" ? undefined : tabKey, q: q || undefined };

  const header = (
    <PageHeader
      title="App users"
      subtitle="Everyone who uses the Postgame app: current and former athletes, coaches, videographers and agents."
      actions={
        <>
          <ViewToggle listKey="users" view={view} />
          <Link href="/admin/users/types" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-50">
            Roles &amp; user types
          </Link>
          <Link href="/signup" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-50">
            Sign-up page
          </Link>
        </>
      }
    />
  );

  const tabs = (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <div className="flex flex-wrap rounded-md border border-stone-300 p-0.5">
        {TABS.map((t, i) => (
          <Link
            key={t.key}
            href={t.key === "current" ? "/admin/users" : `/admin/users?type=${t.key}`}
            className={
              "rounded px-3 py-1 text-[13px] font-medium whitespace-nowrap " +
              (tabKey === t.key ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
            }
          >
            {t.label}
            <span className={"ml-1.5 tabular-nums " + (tabKey === t.key ? "text-white/80" : "text-stone-400")}>
              {countValues[i] == null ? "—" : countValues[i]!.toLocaleString()}
            </span>
          </Link>
        ))}
      </div>
      <form className="flex-1 min-w-[220px]" action="/admin/users" method="GET">
        {tabKey !== "current" && <input type="hidden" name="type" value={tabKey} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, handle, phone or college"
          className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
        />
      </form>
    </div>
  );

  const note = (
    <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] text-stone-600">
      <b className="text-stone-800">High school athletes</b> can sign up and keep a profile, but they
      see almost nothing in the app. A campaign only shows them anything when the brand asks for high
      school athletes. <b className="text-stone-800">Coaches</b> is a new type; nobody has it yet. The old{" "}
      <b className="text-stone-800">Fan</b> accounts get sorted into these groups (roster matches become
      current athletes) instead of being deleted.{" "}
      <Link href="/admin/users?type=admins" className="text-[#D73F09] hover:underline">
        Legacy admin accounts
      </Link>
    </div>
  );

  // ---------- athlete tabs + legacy admins: people ----------
  if (tab.source === "people") {
    const filter = peopleFilter(tab.key, q);
    const run = (cols: string) =>
      filter(supabase.from("people").select(cols))
        .order("admin_created_at", { ascending: false, nullsFirst: false })
        .range(from, to);

    // Try with the 083 column first; fall back without it on production.
    let listRes = await run(`${PEOPLE_COLS}, date_last_login`);
    let hasLastLogin = true;
    if (listRes.error && /date_last_login|column|schema cache/i.test(listRes.error.message)) {
      listRes = await run(PEOPLE_COLS);
      hasLastLogin = false;
    }
    const countRes = await filter(supabase.from("people").select("id", { count: "exact", head: true }));

    if (listRes.error || countRes.error) {
      return (
        <div>
          {header}
          <ErrorNote message={(listRes.error ?? countRes.error)?.message ?? "Query failed"} />
        </div>
      );
    }

    const rows = (listRes.data ?? []) as unknown as PersonRow[];
    const typeLabel = (r: PersonRow) =>
      tab.key === "admins"
        ? (r.person_type ?? "—")
        : r.roster_status === "high_school_athlete"
          ? "High school athlete"
          : r.person_type === "Former Athlete"
            ? USER_TYPE_LABELS.former_athlete
            : USER_TYPE_LABELS.current_athlete;
    const name = (r: PersonRow) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "—";

    return (
      <div>
        {header}
        {tabs}
        <AdminTable<PersonRow>
          rows={rows}
          rowKey={(r) => r.id}
          view={view}
          cardDetails={["type", "college", "followers", "match"]}
          emptyLabel={q ? "No users match." : `No ${tab.label.toLowerCase()} yet.`}
          columns={[
            {
              key: "user",
              header: "User",
              render: (r) => (
                <div>
                  <NameLink href={`/admin/users/${r.id}`}>{name(r)}</NameLink>
                  <div className="text-[12px] text-stone-500">
                    {r.instagram_handle ? `@${r.instagram_handle.replace(/^@/, "")}` : (r.email ?? "—")}
                  </div>
                </div>
              ),
            },
            { key: "type", header: "Type", render: (r) => <Pill>{typeLabel(r)}</Pill> },
            { key: "college", header: "College", render: (r) => r.college_raw ?? "—" },
            {
              key: "followers",
              header: "Followers",
              align: "right",
              render: (r) => r.instagram_followers?.toLocaleString() ?? "—",
            },
            {
              key: "device",
              header: "Device",
              secondary: true,
              render: (r) => (r.device ? <span className="text-stone-600" title={r.device}>✓</span> : <span className="text-stone-400">—</span>),
            },
            {
              key: "joined",
              header: "Joined",
              secondary: true,
              render: (r) => <span className="text-stone-500">{formatDate(r.admin_created_at)}</span>,
            },
            {
              key: "login",
              header: "Last login",
              secondary: true,
              render: (r) => (
                <span className="text-stone-500" title={hasLastLogin ? undefined : "Arrives with migration 083"}>
                  {hasLastLogin ? formatDate(r.date_last_login) : "—"}
                </span>
              ),
            },
            {
              key: "match",
              header: "Roster match",
              render: (r) =>
                tab.key === "admins" ? (
                  <span className="text-stone-400">—</span>
                ) : r.admin_profile_id ? (
                  <Pill tone="ok">Linked</Pill>
                ) : (
                  <Pill tone="warn">No roster match</Pill>
                ),
            },
          ]}
          mobile={{
            icon: (r) => <Avatar name={name(r) === "—" ? null : name(r)} />,
            title: (r) => name(r),
            href: (r) => `/admin/users/${r.id}`,
            subtitle: (r) => [r.college_raw, r.sport].filter(Boolean).join(" · "),
            figure: (r) => (view === "cards" ? "" : r.instagram_followers?.toLocaleString() ?? ""),
            strip: view === "cards" ? undefined : (r) => (
              <span className="text-stone-500">
                {typeLabel(r)}
                {r.instagram_handle ? ` · @${r.instagram_handle.replace(/^@/, "")}` : ""}
              </span>
            ),
          }}
        />
        <Paginator page={page} total={countRes.count ?? 0} pageSize={PAGE_SIZE} basePath="/admin/users" params={params} />
        {note}
      </div>
    );
  }

  // ---------- coach / videographer / agent: sign-up tables ----------
  const table = tab.source;
  const applySearch = (query: any) =>
    q ? query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`) : query;

  const list = await safeQuery<SignupRow[]>(
    () =>
      applySearch(supabase.from(table).select(SIGNUP_COLS[table]))
        .order("created_at", { ascending: false })
        .range(from, to) as any
  );
  const countRes = list.pending
    ? { count: 0 }
    : await applySearch(supabase.from(table).select("id", { count: "exact", head: true }));

  if (list.pending) {
    return (
      <div>
        {header}
        {tabs}
        <PendingMigration migration="085" feature={`The ${tab.label.toLowerCase()} list (${table})`} />
        {note}
      </div>
    );
  }
  if (list.error) {
    return (
      <div>
        {header}
        {tabs}
        <ErrorNote message={list.error} />
      </div>
    );
  }

  const rows = list.data ?? [];
  const org = (r: SignupRow) => r.agency ?? r.school ?? r.city ?? null;
  const orgHeader = table === "agent_profiles" ? "Agency" : table === "coach_profiles" ? "School" : "Based in";
  const detailHref = (r: SignupRow) =>
    table === "videographer_profiles" ? "/admin/videographers" : null;
  const typeLabel =
    table === "agent_profiles"
      ? USER_TYPE_LABELS.agent
      : table === "coach_profiles"
        ? USER_TYPE_LABELS.coach
        : USER_TYPE_LABELS.videographer;

  return (
    <div>
      {header}
      {tabs}
      <AdminTable<SignupRow>
        rows={rows}
        rowKey={(r) => r.id}
        view={view}
        cardDetails={["org", "status", "extra", "match"]}
        emptyLabel={q ? "No users match." : `No ${tab.label.toLowerCase()} have signed up yet.`}
        columns={[
          {
            key: "user",
            header: "User",
            render: (r) => (
              <div>
                {detailHref(r) ? (
                  <NameLink href={detailHref(r)!}>{r.full_name}</NameLink>
                ) : (
                  <span className="font-medium text-stone-900">{r.full_name}</span>
                )}
                <div className="text-[12px] text-stone-500">{r.email}</div>
              </div>
            ),
          },
          { key: "type", header: "Type", render: () => <Pill>{typeLabel}</Pill> },
          { key: "org", header: orgHeader, render: (r) => org(r) ?? "—" },
          {
            key: "extra",
            header: table === "videographer_profiles" ? "Gear" : "Role",
            secondary: true,
            render: (r) => (table === "videographer_profiles" ? r.gear : r.title) ?? "—",
          },
          { key: "phone", header: "Phone", secondary: true, render: (r) => r.phone ?? "—" },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Pill tone={r.status === "can_upload" || r.status === "approved" ? "ok" : r.status === "inactive" ? "neutral" : "warn"}>
                {STATUS_LABEL[r.status] ?? r.status}
              </Pill>
            ),
          },
          {
            key: "joined",
            header: "Joined",
            secondary: true,
            render: (r) => <span className="text-stone-500">{formatDate(r.created_at)}</span>,
          },
          {
            key: "match",
            header: "Roster match",
            render: (r) => (r.person_id ? <Pill tone="ok">Linked</Pill> : <Pill tone="warn">No roster match</Pill>),
          },
        ]}
        mobile={{
          icon: (r) => <Avatar name={r.full_name} />,
          title: (r) => r.full_name,
          href: (r) => detailHref(r),
          subtitle: (r) => [org(r), r.email].filter(Boolean).join(" · "),
          strip: view === "cards" ? (() => <span className="text-stone-500">{typeLabel}</span>) : (r) => (
            <span className="text-stone-500">
              {typeLabel} · {STATUS_LABEL[r.status] ?? r.status}
            </span>
          ),
        }}
      />
      <Paginator page={page} total={countRes.count ?? 0} pageSize={PAGE_SIZE} basePath="/admin/users" params={params} />
      {note}
    </div>
  );
}
