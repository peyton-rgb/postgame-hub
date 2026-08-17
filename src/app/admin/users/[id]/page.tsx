// ============================================================
// /admin/users/[id] — User edit (users_edit.cfm rebuilt, with the
// field lockdown from the security audit).
//
// What CF had that the Hub deliberately does NOT rebuild here:
// - SSN / FEIN / bank + routing plain-text inputs: those columns do
//   not exist in the Hub database at all (they never migrated), so
//   there is nothing to render — and no raw PII ever will be. If a
//   W-9 vault lands later it gets its own exec-gated, masked screen.
// - Users_login.cfm one-click impersonation: not rebuilt.
// - Plain-GET activate/onboard toggles: replaced by confirmed POSTs.
//
// DNW (do-not-work-with, migration 025): staff set w/ reason,
// admin+ remove, all logged; honest pending state until applied.
// ============================================================

import { requireAdmin, hasLevel } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatDate, safeQuery } from "@/lib/admin/db";
import { PageHeader, PendingMigration, ErrorNote } from "@/components/admin/ui";
import AdminForm, { FieldCard, Field } from "@/components/admin/StickySaveBar";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { savePerson, toggleActive, setDnw, removeDnw } from "./actions";

export const dynamic = "force-dynamic";

const RESULT_NOTES: Record<string, { tone: "ok" | "warn" | "err"; text: string }> = {
  saved: { tone: "ok", text: "Saved." },
  error: { tone: "err", text: "Save failed — nothing was changed." },
  pending025: {
    tone: "warn",
    text: "DNW fields don't exist yet — they arrive with migration 025. Nothing was changed.",
  },
  "dnw-needs-reason": { tone: "warn", text: "A DNW flag requires a reason — nothing was set." },
};

export default async function UserEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const viewer = await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const { data: person, error } = await supabase
    .from("people")
    .select(
      "id, admin_user_id, first_name, last_name, email, phone, instagram_handle, instagram_followers, tiktok_handle, tiktok_followers, person_type, roster_status, rating, sport, gender, college_raw, college_id, is_active, is_archived, shipping_address, shipping_city, shipping_state, shipping_zip, admin_created_at, nil_value"
    )
    .eq("id", params.id)
    .single();

  if (error || !person) {
    return (
      <div>
        <PageHeader title="User" />
        <ErrorNote message="User not found." />
      </div>
    );
  }

  const dnw = await safeQuery<{
    dnw_flag: boolean;
    dnw_reason: string | null;
    dnw_category: string | null;
    dnw_set_at: string | null;
  }>(
    () =>
      supabase
        .from("people")
        .select("dnw_flag, dnw_reason, dnw_category, dnw_set_at")
        .eq("id", params.id)
        .single() as any
  );

  const name = [person.first_name, person.last_name].filter(Boolean).join(" ") || "—";
  const note = searchParams.result ? RESULT_NOTES[searchParams.result] : undefined;

  return (
    <div>
      <PageHeader
        title={name}
        subtitle={`User edit · CF ID ${person.admin_user_id ?? "—"} · created ${formatDate(person.admin_created_at)}`}
        actions={
          <form action={toggleActive}>
            <input type="hidden" name="id" value={person.id} />
            <ConfirmSubmit
              variant="quiet"
              summary={
                person.is_active
                  ? `Deactivate ${name}? They stop appearing in active lists until reactivated.`
                  : `Reactivate ${name}?`
              }
              confirmLabel={person.is_active ? "Deactivate" : "Activate"}
            >
              {person.is_active ? "Active ✓" : "Inactive — activate"}
            </ConfirmSubmit>
          </form>
        }
      />

      {note && (
        <div
          className={
            "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
            (note.tone === "ok"
              ? "border-green-200 bg-green-50 text-green-900"
              : note.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-red-200 bg-red-50 text-red-900")
          }
        >
          {note.text}
        </div>
      )}

      {/* DNW banner */}
      {!dnw.pending && dnw.data?.dnw_flag && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-900">
          <span className="font-semibold">Do-not-work-with.</span> {dnw.data.dnw_reason}
          {dnw.data.dnw_category ? ` (${dnw.data.dnw_category})` : ""} · set{" "}
          {formatDate(dnw.data.dnw_set_at)}
          {hasLevel(viewer, "admin") && (
            <form action={removeDnw} className="mt-2">
              <input type="hidden" name="id" value={person.id} />
              <ConfirmSubmit
                variant="danger"
                summary={`Remove the do-not-work-with flag from ${name}? This is logged with your name.`}
                confirmLabel="Remove flag"
              >
                Remove DNW flag
              </ConfirmSubmit>
            </form>
          )}
        </div>
      )}

      <AdminForm
        action={savePerson}
        confirmSummary={`Save changes to ${name}? Only changed fields are written, scoped to this one person.`}
      >
        <input type="hidden" name="id" value={person.id} />
        <div className="space-y-4">
          <FieldCard title="Identity">
            <Field label="First Name" name="first_name" defaultValue={person.first_name} />
            <Field label="Last Name" name="last_name" defaultValue={person.last_name} />
            <Field label="Email" name="email" type="email" defaultValue={person.email} />
            <Field label="Phone" name="phone" defaultValue={person.phone} />
            <Field
              label="Gender"
              name="gender"
              type="select"
              defaultValue={person.gender ?? ""}
              options={[
                { value: "", label: "—" },
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
              ]}
            />
            <Field label="Type" name="person_type_display" defaultValue={person.person_type} readOnly />
          </FieldCard>

          <FieldCard title="Social">
            <Field label="Instagram" name="instagram_handle" defaultValue={person.instagram_handle} />
            <Field
              label="IG Followers"
              name="ig_followers_display"
              defaultValue={person.instagram_followers?.toLocaleString() ?? ""}
              readOnly
            />
            <Field label="TikTok" name="tiktok_handle" defaultValue={person.tiktok_handle} />
            <Field
              label="TikTok Followers"
              name="tt_followers_display"
              defaultValue={person.tiktok_followers?.toLocaleString() ?? ""}
              readOnly
            />
          </FieldCard>

          <FieldCard title="Athletics">
            <Field label="Sport" name="sport" defaultValue={person.sport} />
            <Field
              label="College (raw import value)"
              name="college_raw_display"
              defaultValue={person.college_raw}
              readOnly
            />
            <Field
              label="Rating"
              name="rating"
              defaultValue={person.rating}
              placeholder="e.g. A, B, C"
            />
            <Field label="Roster Status" name="roster_status" defaultValue={person.roster_status} />
          </FieldCard>

          <FieldCard title="Shipping">
            <Field label="Address" name="shipping_address" defaultValue={person.shipping_address} span2 />
            <Field label="City" name="shipping_city" defaultValue={person.shipping_city} />
            <Field label="State" name="shipping_state" defaultValue={person.shipping_state} />
            <Field label="Zip" name="shipping_zip" defaultValue={person.shipping_zip} />
          </FieldCard>
        </div>
      </AdminForm>

      {/* DNW controls (below the form so the save bar doesn't swallow them) */}
      <div className="mt-6">
        {dnw.pending ? (
          <PendingMigration migration="025_dnw_flags" feature="Do-not-work-with flags" />
        ) : (
          !dnw.data?.dnw_flag && (
            <form
              action={setDnw}
              className="rounded-lg border border-stone-200 bg-white p-4 md:p-5"
            >
              <input type="hidden" name="id" value={person.id} />
              <h2 className="pb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
                Do-not-work-with
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Reason (required)" name="dnw_reason" span2 />
                <Field
                  label="Category"
                  name="dnw_category"
                  type="select"
                  defaultValue=""
                  options={[
                    { value: "", label: "—" },
                    { value: "conduct", label: "Conduct" },
                    { value: "performance", label: "Deliverable performance" },
                    { value: "brand_request", label: "Brand request" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </div>
              <div className="mt-4">
                <ConfirmSubmit
                  variant="danger"
                  summary={`Flag ${name} as do-not-work-with network-wide? They're excluded from sourcing and blocked from roster adds. Logged with your name; only admin+ can remove it.`}
                  confirmLabel="Set DNW flag"
                >
                  Set DNW flag
                </ConfirmSubmit>
              </div>
            </form>
          )
        )}
      </div>
    </div>
  );
}
