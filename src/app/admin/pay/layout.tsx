// ============================================================
// /admin/pay — exec-only gate for the entire Pay suite.
//
// Below-exec staff see an honest lock screen instead of a silent
// redirect. IMPORTANT pre-migration behavior: until migration 022
// is applied nobody has access_level='exec', so EVERYONE sees the
// lock (with the pending-022 explanation). That is deliberate —
// the most sensitive screens stay shut until the ladder is real.
// ============================================================

import { requireAdmin, hasLevel } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function PayLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin("staff");

  if (!hasLevel(user, "exec")) {
    return (
      <div>
        <PageHeader title="Pay suite" />
        <div className="rounded-lg border border-stone-300 bg-stone-50 px-5 py-6 text-[13px] text-stone-700">
          <div className="text-[15px] font-semibold text-stone-900">Exec access required</div>
          <p className="mt-2 max-w-lg leading-5">
            Payments, banking details, and the 1099 report are restricted to exec accounts
            (Peyton, Bill, Angie).
          </p>
          {user.accessLevelPending && (
            <p className="mt-2 max-w-lg leading-5 text-amber-700">
              Access levels are still running on the legacy role column — nobody is exec until
              migration <code className="rounded bg-amber-100 px-1">022_admin_access_levels</code>{" "}
              is applied and the exec seed emails are filled in. That&apos;s step 1 of the morning
              checklist.
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
