// ============================================================
// /admin/users/types — Roles & user types (read-only reference).
//
// Three vocabularies that are easy to mix up, on one page:
//
//   1. App user types   user_types table (migration 085 seed) — what
//                       kind of PERSON an app account belongs to.
//   2. Profile types    profile_types table — what kind of ROSTER
//                       profile (college / high school / former / pro).
//                       An athlete is a roster profile; a user is
//                       someone with the app.
//   3. Staff access     profiles.access_level, the ladder in
//                       src/lib/admin/auth.ts (exec > admin > staff >
//                       athlete, plus brand). What a LOGIN may open.
//      Staff roles      Director / Manager / Assistant — who runs a
//                       campaign. Set in Asana by Abby and Angie, not in
//                       the Hub; the blended campaigns table (083) has
//                       manager_person_id and assistant_person_id to
//                       carry them.
//
// Nothing here writes. The two tables are read live; the ladder is the
// constant list from auth.ts described in plain English.
// ============================================================

import Link from "next/link";
import { requireAdmin, type AccessLevel } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { PageHeader, PendingMigration, ErrorNote } from "@/components/admin/ui";
import { USER_TYPE_LABELS, type SignupUserType } from "@/lib/signup/types";

export const dynamic = "force-dynamic";

interface UserTypeRow {
  user_type_id: number;
  code: string | null;
  user_type: string | null;
  description: string | null;
}
interface ProfileTypeRow {
  profile_type_id: number;
  code: string | null;
  profile_type: string | null;
  show_in_rankings: boolean | null;
}

/** The access ladder from src/lib/admin/auth.ts, top to bottom. */
const ACCESS_LEVELS: Array<{ level: AccessLevel; who: string; opens: string }> = [
  {
    level: "exec",
    who: "Bill, Danny, Peyton",
    opens: "Everything, including the Payments menu (Pay Athletes, invoices, affiliate, bonus, ACH, 1099) — the only area that checks for exec today.",
  },
  {
    level: "admin",
    who: "Admin-level staff",
    opens: "Every staff screen plus Access Management and the API page; can preview brand portals (/portal/choose).",
  },
  {
    level: "staff",
    who: "Everyone with a @pstgm.com Google sign-in, by default",
    opens: "The /admin and /dashboard screens. Payments and Access Management are hidden.",
  },
  {
    level: "athlete",
    who: "App users — athletes, and (until auth.ts gets an 'app' level) coaches, videographers and agents",
    opens: "The athlete app only. Bounced from /admin and /dashboard to /athlete. The real kind of person is in profiles.role.",
  },
  {
    level: "brand",
    who: "Client contacts invited to a brand portal",
    opens: "/portal only, scoped to their brands. /admin sends them to /portal/denied.",
  },
];

/** Campaign roles — set in Asana, mirrored into the Hub. */
const ASANA_ROLES: Array<{ role: string; means: string; hub: string }> = [
  {
    role: "Director",
    means: "Owns the relationship and signs off. Today Abby or Angie, from the Director field on the Asana campaign.",
    hub: "No column yet — the prototype proposes one on campaigns.",
  },
  {
    role: "Manager",
    means: "Runs the campaign day to day — the person whose Asana section it sits in.",
    hub: "campaigns.manager_person_id (migration 083).",
  },
  {
    role: "Assistant",
    means: "Supports the manager on that campaign.",
    hub: "campaigns.assistant_person_id (migration 083).",
  },
];

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px] text-stone-700">{children}</code>;
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
        {sub && <p className="mt-0.5 text-[12px] text-stone-500">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function UserTypesPage() {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const [userTypes, profileTypes] = await Promise.all([
    safeQuery<UserTypeRow[]>(
      () => supabase.from("user_types").select("user_type_id, code, user_type, description").order("user_type_id") as any
    ),
    safeQuery<ProfileTypeRow[]>(
      () => supabase.from("profile_types").select("profile_type_id, code, profile_type, show_in_rankings").order("profile_type_id") as any
    ),
  ]);

  const appTypes = (userTypes.data ?? []).filter((t) => t.code && t.code !== "brand" && t.code !== "staff");
  const otherTypes = (userTypes.data ?? []).filter((t) => !t.code || t.code === "brand" || t.code === "staff");

  return (
    <div>
      <PageHeader
        title="Roles & user types"
        subtitle="What kind of person an account belongs to, what kind of roster profile an athlete has, and what a staff login may open. Read-only."
        actions={
          <Link href="/admin/users" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-50">
            ← App users
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="App user types" sub="user_types · who can have a Postgame app account. No “fan” type.">
          {userTypes.pending ? (
            <div className="p-4"><PendingMigration migration="083 / 085" feature="The user_types table" /></div>
          ) : userTypes.error ? (
            <div className="p-4"><ErrorNote message={userTypes.error} /></div>
          ) : (userTypes.data ?? []).length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-stone-500">
              The table exists but is empty — migration 085 seeds it with the five app types plus brand and staff.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {[...appTypes, ...otherTypes].map((t) => (
                <li key={t.user_type_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                  <span className="min-w-[150px] text-[13px] font-medium text-stone-900">
                    {t.user_type ?? (t.code ? USER_TYPE_LABELS[t.code as SignupUserType] : null) ?? "—"}
                  </span>
                  {t.code && <Code>{t.code}</Code>}
                  {(t.code === "brand" || t.code === "staff") && (
                    <span className="rounded-full border border-stone-300 px-2 py-0.5 text-[11px] text-stone-500">separate sign-in</span>
                  )}
                  <span className="basis-full text-[13px] text-stone-600">{t.description ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Profile types" sub="profile_types · what kind of roster profile. An athlete is a roster profile; a user is someone with the app.">
          {profileTypes.pending ? (
            <div className="p-4"><PendingMigration migration="083 / 085" feature="The profile_types table" /></div>
          ) : profileTypes.error ? (
            <div className="p-4"><ErrorNote message={profileTypes.error} /></div>
          ) : (profileTypes.data ?? []).length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-stone-500">
              The table exists but is empty — migration 085 seeds the kinds the Hub already uses as{" "}
              <Code>people.roster_status</Code>.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {(profileTypes.data ?? []).map((t) => (
                <li key={t.profile_type_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                  <span className="min-w-[150px] text-[13px] font-medium text-stone-900">{t.profile_type ?? "—"}</span>
                  {t.code && <Code>{t.code}</Code>}
                  <span className="text-[12px] text-stone-500">
                    {t.show_in_rankings ? "shown in rankings" : "not in rankings"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Staff access levels" sub="profiles.access_level · the ladder in src/lib/admin/auth.ts. What a login may open.">
          <ul className="divide-y divide-stone-100">
            {ACCESS_LEVELS.map((a) => (
              <li key={a.level} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <Code>{a.level}</Code>
                  <span className="text-[12px] text-stone-500">{a.who}</span>
                </div>
                <p className="mt-1 text-[13px] text-stone-700">{a.opens}</p>
              </li>
            ))}
          </ul>
          <p className="border-t border-stone-200 px-4 py-3 text-[12px] text-stone-500">
            Set per login on <Link href="/admin/access" className="text-[#D73F09] hover:underline">Access Management</Link> (admin and up).
            Google sign-ins with a @pstgm.com address start at <Code>staff</Code>; the trigger never grants admin or exec from a sign-up.
          </p>
        </Card>

        <Card title="Campaign roles" sub="Director / Manager / Assistant · who runs a campaign. Set in Asana by Abby and Angie.">
          <ul className="divide-y divide-stone-100">
            {ASANA_ROLES.map((r) => (
              <li key={r.role} className="px-4 py-3">
                <div className="text-[13px] font-medium text-stone-900">{r.role}</div>
                <p className="mt-0.5 text-[13px] text-stone-700">{r.means}</p>
                <p className="mt-0.5 text-[12px] text-stone-500">In the Hub: {r.hub}</p>
              </li>
            ))}
          </ul>
          <p className="border-t border-stone-200 px-4 py-3 text-[12px] text-stone-500">
            These are job roles on a campaign, not access levels: a Director and a Manager are both{" "}
            <Code>staff</Code> (or higher) logins. The Hub reads them from Asana; it does not set them.
          </p>
        </Card>
      </div>
    </div>
  );
}
