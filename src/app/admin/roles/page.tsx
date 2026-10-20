// ============================================================
// /admin/roles — Roles & permissions (prototype S.roles).
// The matrix is a PROPOSAL (what each role should be able to do),
// shown as such. "Who has which access today" is live: the Hub
// logins grouped by their real access level.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadStaff } from "@/lib/admin/workspace";
import { PageHeader } from "@/components/admin/ui";
import { Card } from "@/components/admin/campaign/bits";
import { SimpleTable } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

type V = 1 | 0 | string;
const PERMS: [string, V, V, V, V][] = [
  ["See every campaign", 1, 1, 1, 1],
  ["Edit campaigns they run", 1, 1, 1, 0],
  ["Edit any campaign", 1, 1, 0, 0],
  ["Assign managers and directors", 1, 1, 0, 0],
  ["Create campaigns", 1, 1, 1, 0],
  ["See budgets and margins", 1, 1, "Their own", 0],
  ["Select athletes and send notifications", 1, 1, 1, 0],
  ["Approve and send payouts", 1, 0, 0, 0],
  ["See payments and 1099s", 1, "View", 0, 0],
  ["Delete campaigns", 1, 0, 0, 0],
  ["Manage team and roles", 1, 0, 0, 0],
  ["Brand portals and recaps", 1, 1, 1, "View"],
];

function Mark({ v }: { v: V }) {
  if (v === 1) return <span className="font-semibold text-status-ok">✓</span>;
  if (v === 0) return <span className="text-stone-400">—</span>;
  return <span className="text-stone-500">{v}</span>;
}

export default async function RolesPage() {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const { staff, pending } = await loadStaff(supabase);

  const byLevel = new Map<string, string[]>();
  for (const s of staff) byLevel.set(s.level, [...(byLevel.get(s.level) ?? []), s.label.split(" ")[0]]);
  const order = ["Exec", "Admin", "Staff"];
  const rank = (l: string) => (order.includes(l) ? order.indexOf(l) : order.length);
  const levels = Array.from(byLevel.keys()).sort((a, b) => rank(a) - rank(b));

  return (
    <div>
      <PageHeader title="Roles & permissions" subtitle="What each role can see and do. Proposal for you to edit." />

      <section className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
        <SimpleTable
          rows={PERMS}
          rowKey={(p) => p[0]}
          cols={[
            { h: "", r: (p) => <span className="text-stone-800">{p[0]}</span> },
            { h: "Exec", r: (p) => <Mark v={p[1]} /> },
            { h: "Director", r: (p) => <Mark v={p[2]} /> },
            { h: "Campaign manager", r: (p) => <Mark v={p[3]} /> },
            { h: "Staff (content, editors)", r: (p) => <Mark v={p[4]} /> },
          ]}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Who has which access today">
          {pending ? (
            <p className="text-[13px] text-stone-500">Access levels are not readable yet (migration 022).</p>
          ) : staff.length === 0 ? (
            <p className="text-[13px] text-stone-500">No staff logins found.</p>
          ) : (
            <div className="grid gap-2 text-[13px]">
              {levels.map((l) => (
                <div key={l}>
                  <b className="text-stone-900">{l}</b>{" "}
                  <span className="text-stone-500">· {byLevel.get(l)!.join(", ")}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Where this comes from">
          <div className="grid gap-2 text-[13px] text-stone-500">
            <div>Asana: the campaign owner (section or assignee) and the Director field.</div>
            <div>
              Hub today: 3 access levels (exec, admin, staff) with {staff.length} accounts; only Payments checks for exec.
            </div>
            <div>Lovable admin: owner / admin / manager / user. ColdFusion: Super Admin, Admin Sales and other staff types.</div>
            <div>Nothing on this page changes anyone&apos;s access yet. Use Access to change who can sign in.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
