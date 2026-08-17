// ============================================================
// /admin/notifications/send — Send Mass Notification
// (notification_mass_send.cfm rebuilt as one screen with a review
// gate). Compose → the confirm dialog states the LIVE recipient
// count → confirmed POST → tonight: dry-run logger only.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { FieldCard, Field } from "@/components/admin/StickySaveBar";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { sendMassNotification } from "../actions";

export const dynamic = "force-dynamic";

export default async function MassSendPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const [{ count: athleteCount }, { count: staffCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "athlete"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("role", "athlete"),
  ]);

  const result = searchParams.result;

  return (
    <div>
      <PageHeader
        title="Send Mass Notification"
        subtitle="In-app notifications to Hub profiles · review gate shows the live recipient count before anything fires"
      />

      {result === "dry-run" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Dry run logged for {searchParams.count ?? "?"} recipients — no notifications were
          created and nothing was sent. Real sends stay off until the send path is reviewed and
          enabled (morning decision).
        </div>
      )}
      {result === "needs-message" && <ErrorNote message="Write a message first — nothing was sent." />}
      {result === "bad-link" && <ErrorNote message="The link must be a valid http(s) URL — nothing was sent." />}
      {result === "admin-only" && <ErrorNote message="Mass sends are admin+ only." />}
      {result === "disabled" && (
        <ErrorNote message="Real sends are disabled in this build — dry-run only until reviewed." />
      )}

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <span className="font-medium">Dry-run mode.</span> Tonight&apos;s build never sends: the
        confirmed POST computes the real recipient count, writes an audit entry marked{" "}
        <code className="rounded bg-amber-100 px-1">dry_run</code>, and stops.
      </div>

      <form action={sendMassNotification} className="space-y-4">
        <FieldCard title="Audience">
          <Field
            label="Who to include"
            name="audience"
            type="select"
            defaultValue="athletes"
            options={[
              { value: "athletes", label: `Athletes with Hub profiles (${athleteCount ?? 0})` },
              { value: "staff", label: `Staff profiles (${staffCount ?? 0})` },
            ]}
          />
        </FieldCard>
        <FieldCard title="Message">
          <Field label="Message *" name="message" type="textarea" span2 />
          <Field label="Web Link (optional, validated)" name="link_url" type="url" span2 />
        </FieldCard>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <ConfirmSubmit
            summary={`Run the mass-notification pipeline in DRY-RUN mode? It will compute the exact recipient count for the chosen audience (athletes: ${athleteCount ?? 0}, staff: ${staffCount ?? 0}), log the run, and send nothing.`}
            confirmLabel="Run dry-run"
          >
            Review &amp; run (dry-run)
          </ConfirmSubmit>
        </div>
      </form>
    </div>
  );
}
