// ============================================================
// /admin/notifications/unsubscribes — Unsubscribes compliance list
// (user_unsubscribes.cfm absorbed, 5D). CF's 173 unsubscribe rows
// live in the CF database; the Hub has no unsubscribes table yet.
// Honest empty state — compliance data is the last place for
// placeholders.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { PageHeader, EmptyRows } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function UnsubscribesPage() {
  await requireAdmin("staff");

  return (
    <div>
      <PageHeader
        title="Unsubscribes"
        subtitle="Compliance list — people who opted out of communications"
      />
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        CF holds 173 unsubscribe records in its own database. Importing them (and pointing new
        unsubscribes here) is flagged in the morning report — mass-send stays in dry-run mode
        until this list is live, so nothing can be sent to an unsubscribed contact in the
        meantime.
      </div>
      <div className="rounded-lg border border-stone-200 bg-white">
        <EmptyRows label="No unsubscribe records in the Hub database yet." />
      </div>
    </div>
  );
}
