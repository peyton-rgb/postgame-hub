// ============================================================
// /admin/colleges/[id]/edit — College edit (colleges_edit.cfm
// rebuilt, minus CF's link-to-another-college form — that job now
// belongs to the alias mapper). Confirmed POST save.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import AdminForm, { FieldCard, Field } from "@/components/admin/StickySaveBar";
import { saveCollege } from "../../actions";

export const dynamic = "force-dynamic";

export default async function CollegeEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const id = parseInt(params.id, 10);
  const { data: college, error } = Number.isNaN(id)
    ? { data: null, error: { message: "bad id" } }
    : await supabase
        .from("colleges")
        .select("id, name, short_name, city, state, zip, website, is_active, ncaa_division, ipeds_unitid")
        .eq("id", id)
        .single();

  if (error || !college) {
    return (
      <div>
        <PageHeader title="College" />
        <ErrorNote message="College not found." />
      </div>
    );
  }

  const { data: aliases } = await supabase
    .from("school_aliases")
    .select("id, alias")
    .eq("college_id", college.id)
    .order("alias");

  return (
    <div>
      <PageHeader
        title={college.name ?? "College"}
        subtitle={`College edit · ID ${college.id}${college.ipeds_unitid ? ` · IPEDS ${college.ipeds_unitid}` : ""}`}
      />

      {searchParams.result === "saved" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Saved.
        </div>
      )}
      {searchParams.result === "error" && (
        <ErrorNote message="Save failed — nothing was changed." />
      )}

      <AdminForm
        action={saveCollege}
        confirmSummary={`Save changes to ${college.name}? This affects how athletes match to this college everywhere in the Hub.`}
      >
        <input type="hidden" name="id" value={college.id} />
        <div className="space-y-4">
          <FieldCard title="College">
            <Field label="Name" name="name" defaultValue={college.name} />
            <Field label="Short Name / Initials" name="short_name" defaultValue={college.short_name} />
            <Field label="City" name="city" defaultValue={college.city} />
            <Field label="State" name="state" defaultValue={college.state} />
            <Field label="Zip" name="zip" defaultValue={college.zip} />
            <Field label="Website" name="website" type="url" defaultValue={college.website} />
            <Field
              label="NCAA Division"
              name="ncaa_division"
              type="select"
              defaultValue={college.ncaa_division ?? ""}
              options={[
                { value: "", label: "—" },
                { value: "I", label: "Division I" },
                { value: "II", label: "Division II" },
                { value: "III", label: "Division III" },
              ]}
            />
            <Field
              label="Active"
              name="is_active"
              type="select"
              defaultValue={String(college.is_active ?? true)}
              options={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
            />
          </FieldCard>
        </div>
      </AdminForm>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <h2 className="pb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
          Aliases ({(aliases ?? []).length})
        </h2>
        {(aliases ?? []).length === 0 ? (
          <p className="text-[13px] text-stone-500">
            No aliases yet. Raw import strings get attached in the alias mapper.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {(aliases ?? []).map((a) => (
              <li key={a.id} className="rounded-full bg-stone-100 px-2.5 py-1 text-[12px] text-stone-700">
                {a.alias}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
