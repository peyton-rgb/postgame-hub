// ============================================================
// /admin/users — Users list (CF users.cfm consolidated).
//
// CF's four nav identities (Users / Ambassadors / Admins / Device
// IDs) collapse into ONE list with filter presets:
//   all      -> everyone in `people`
//   athletes -> person_type Athlete + Former Athlete
//   admins   -> person_type Super Admin / Admin / Admin Finance / Admin Sales
//   device   -> device column non-empty (CF ?HasDeviceID=1)
// (CF's Ambassador flag never migrated into `people` — no column to
// filter on, so no fake preset. Recorded in the run-state doc.)
//
// 50/page server-side; CF search semantics: name, email, phone
// (last 4) or IG handle.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

const PRESETS: Record<string, { label: string; types?: string[]; device?: boolean }> = {
  all: { label: "All" },
  athletes: { label: "Athletes", types: ["Athlete", "Former Athlete"] },
  admins: { label: "Admins", types: ["Super Admin", "Admin", "Admin Finance", "Admin Sales"] },
  device: { label: "Device IDs", device: true },
};

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
  admin_created_at: string | null;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const presetKey = PRESETS[searchParams.preset ?? "all"] ? (searchParams.preset ?? "all") : "all";
  const preset = PRESETS[presetKey];
  const q = sanitizeFilterValue(searchParams.q ?? "");

  function apply(query: any) {
    if (preset.types) query = query.in("person_type", preset.types);
    if (preset.device) query = query.not("device", "is", null).neq("device", "");
    if (q) {
      const terms = [
        `first_name.ilike.%${q}%`,
        `last_name.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `instagram_handle.ilike.%${q}%`,
      ];
      // CF semantics: phone matches on the LAST 4 digits
      if (/^\d{4}$/.test(q)) terms.push(`phone.ilike.%${q}`);
      else if (/^[\d\s()+-]{5,}$/.test(q)) terms.push(`phone.ilike.%${q}%`);
      query = query.or(terms.join(","));
    }
    return query;
  }

  const { from, to } = pageRange(page);
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    apply(
      supabase
        .from("people")
        .select(
          "id, admin_user_id, first_name, last_name, email, phone, instagram_handle, instagram_followers, college_raw, sport, device, person_type, admin_created_at"
        )
    )
      .order("admin_created_at", { ascending: false, nullsFirst: false })
      .range(from, to),
    apply(supabase.from("people").select("id", { count: "exact", head: true })),
  ]);

  if (error || countError) {
    return (
      <div>
        <PageHeader title="Users" />
        <ErrorNote message={(error ?? countError)?.message ?? "Query failed"} />
      </div>
    );
  }
  const rows = (data ?? []) as PersonRow[];
  const params = {
    preset: presetKey === "all" ? undefined : presetKey,
    q: q || undefined,
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${(count ?? 0).toLocaleString()} people · one list, presets replace CF's four nav identities`}
      />

      <div className="flex flex-wrap items-center gap-2 pb-4">
        <div className="flex rounded-md border border-stone-300 p-0.5">
          {Object.entries(PRESETS).map(([key, p]) => (
            <Link
              key={key}
              href={key === "all" ? "/admin/users" : `/admin/users?preset=${key}`}
              className={
                "rounded px-3 py-1 text-[13px] font-medium " +
                (presetKey === key ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
              }
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form className="flex-1 min-w-[220px]" action="/admin/users" method="GET">
          {presetKey !== "all" && <input type="hidden" name="preset" value={presetKey} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, phone (last 4) or handle"
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
          />
        </form>
      </div>

      <AdminTable<PersonRow>
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No users match."
        columns={[
          {
            key: "id",
            header: "ID",
            render: (r) => (
              <span className="text-stone-500 tabular-nums">{r.admin_user_id ?? r.id.slice(0, 8)}</span>
            ),
          },
          {
            key: "name",
            header: "Name",
            render: (r) => (
              <NameLink href={`/admin/users/${r.id}`}>
                {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
              </NameLink>
            ),
          },
          { key: "college", header: "College", render: (r) => r.college_raw ?? "—" },
          {
            key: "ig",
            header: "IG",
            render: (r) =>
              r.instagram_handle ? (
                <span className="text-stone-600">@{r.instagram_handle.replace(/^@/, "")}</span>
              ) : (
                "—"
              ),
          },
          {
            key: "followers",
            header: "Followers",
            align: "right",
            render: (r) => r.instagram_followers?.toLocaleString() ?? "—",
          },
          { key: "phone", header: "Phone", secondary: true, render: (r) => r.phone ?? "—" },
          {
            key: "device",
            header: "Device",
            secondary: true,
            render: (r) => (r.device ? <span title={r.device}>✓</span> : "—"),
          },
          { key: "type", header: "Type", secondary: true, render: (r) => r.person_type ?? "—" },
          {
            key: "created",
            header: "Created On",
            secondary: true,
            render: (r) => <span className="text-stone-500">{formatDate(r.admin_created_at)}</span>,
          },
        ]}
        mobile={{
          title: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
          href: (r) => `/admin/users/${r.id}`,
          subtitle: (r) => [r.college_raw, r.sport].filter(Boolean).join(" · "),
          figure: (r) => r.instagram_followers?.toLocaleString() ?? "",
          strip: (r) => (
            <span className="text-stone-500">
              {r.person_type ?? ""}
              {r.instagram_handle ? ` · @${r.instagram_handle.replace(/^@/, "")}` : ""}
            </span>
          ),
        }}
      />

      <Paginator
        page={page}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/users"
        params={params}
      />
    </div>
  );
}
