// ============================================================
// /admin/agents — Agents (agents.cfm rebuilt).
// Source: people where person_type = 'Agent' (162 real rows).
// The agent↔athlete linking UI needs a `representations` table
// that doesn't exist yet — honest state, per the brief.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");

  function apply(query: any) {
    query = query.eq("person_type", "Agent");
    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
    return query;
  }

  const { from, to } = pageRange(page);
  const [{ data, error }, { count }] = await Promise.all([
    apply(
      supabase
        .from("people")
        .select("id, admin_user_id, first_name, last_name, email, phone, admin_created_at")
    )
      .order("last_name", { ascending: true, nullsFirst: false })
      .range(from, to),
    apply(supabase.from("people").select("id", { count: "exact", head: true })),
  ]);

  if (error) {
    return (
      <div>
        <PageHeader title="Agents" />
        <ErrorNote message={error.message} />
      </div>
    );
  }

  const rows = (data ?? []) as {
    id: string;
    admin_user_id: number | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    admin_created_at: string | null;
  }[];

  return (
    <div>
      <PageHeader title="Agents" subtitle={`${(count ?? 0).toLocaleString()} agents in the network`} />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        Agent ↔ athlete linking arrives with the <code className="rounded bg-amber-100 px-1">representations</code>{" "}
        table (not migrated yet) — no invented links shown here.
      </div>

      <form className="pb-4" action="/admin/agents" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name or email"
          className="w-full max-w-sm rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
        />
      </form>

      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No agents match."
        columns={[
          {
            key: "id",
            header: "ID",
            render: (r) => <span className="text-stone-500 tabular-nums">{r.admin_user_id ?? r.id.slice(0, 8)}</span>,
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
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          { key: "phone", header: "Phone", secondary: true, render: (r) => r.phone ?? "—" },
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
          subtitle: (r) => r.email ?? "",
        }}
      />

      <Paginator page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/admin/agents" params={{ q: q || undefined }} />
    </div>
  );
}
