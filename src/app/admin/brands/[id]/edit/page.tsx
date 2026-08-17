// ============================================================
// /admin/brands/[id]/edit — Brand / Account edit (accounts_edit.cfm
// rebuilt + the new lifecycle fields from migration 024, honest-
// pending until applied). Brand-kit assets (logos/colors/fonts)
// stay in the kit flow — never edited or AI-generated here.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { PageHeader, PendingMigration, ErrorNote } from "@/components/admin/ui";
import AdminForm, { FieldCard, Field } from "@/components/admin/StickySaveBar";
import { saveBrand } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BrandEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const { data: brand, error } = await supabase
    .from("brands")
    .select("id, admin_brand_id, name, industry, website, tagline, notes, archived, logo_primary_url, logo_mark_url, portal_token")
    .eq("id", params.id)
    .single();

  if (error || !brand) {
    return (
      <div>
        <PageHeader title="Brand" />
        <ErrorNote message="Brand not found." />
      </div>
    );
  }

  const ext = await safeQuery<{
    lifecycle_stage: string | null;
    kit_status: string | null;
    msa_url: string | null;
    ig_handle: string | null;
    tiktok_handle: string | null;
  }>(
    () =>
      supabase
        .from("brands")
        .select("lifecycle_stage, kit_status, msa_url, ig_handle, tiktok_handle")
        .eq("id", params.id)
        .single() as any
  );

  const result = searchParams.result;

  return (
    <div>
      <PageHeader
        title={brand.name ?? "Brand"}
        subtitle={`Brand edit · ID ${brand.admin_brand_id ?? brand.id.slice(0, 8)}${brand.archived ? " · ARCHIVED" : ""}`}
        actions={
          (brand.logo_mark_url || brand.logo_primary_url) ? (
            <img
              src={brand.logo_mark_url ?? brand.logo_primary_url ?? ""}
              alt={brand.name ?? "Brand logo"}
              className="h-9 w-auto object-contain"
            />
          ) : undefined
        }
      />

      {result === "saved" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Saved.
        </div>
      )}
      {result === "saved-pending024" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Core fields saved. Lifecycle/kit/MSA/socials did not — those columns arrive with
          migration 024.
        </div>
      )}
      {result === "error" && <ErrorNote message="Save failed — nothing was changed." />}

      <AdminForm
        action={saveBrand}
        confirmSummary={`Save changes to ${brand.name}? Registry fields only — brand-kit assets are untouched.`}
      >
        <input type="hidden" name="id" value={brand.id} />
        <div className="space-y-4">
          <FieldCard title="Account">
            <Field label="Brand Name" name="name" defaultValue={brand.name} />
            <Field label="Industry" name="industry" defaultValue={brand.industry} />
            <Field label="Website" name="website" type="url" defaultValue={brand.website} />
            <Field label="Tagline" name="tagline" defaultValue={brand.tagline} />
            <Field label="Notes" name="notes" type="textarea" span2 defaultValue={brand.notes} />
          </FieldCard>

          {ext.pending ? (
            <PendingMigration
              migration="024_brand_lifecycle"
              feature="Lifecycle stage, kit status, MSA, and brand socials"
            />
          ) : (
            <FieldCard title="Lifecycle (migration 024)">
              <Field
                label="Lifecycle Stage"
                name="lifecycle_stage"
                defaultValue={ext.data?.lifecycle_stage ?? ""}
                placeholder="e.g. prospect, active, dormant"
              />
              <Field
                label="Kit Status"
                name="kit_status"
                type="select"
                defaultValue={ext.data?.kit_status ?? "placeholder"}
                options={[
                  { value: "placeholder", label: "Placeholder (blocks client-facing output)" },
                  { value: "official", label: "Official" },
                ]}
              />
              <Field label="MSA URL" name="msa_url" type="url" defaultValue={ext.data?.msa_url} />
              <Field label="Brand IG Handle" name="ig_handle" defaultValue={ext.data?.ig_handle} />
              <Field label="Brand TikTok Handle" name="tiktok_handle" defaultValue={ext.data?.tiktok_handle} />
            </FieldCard>
          )}
        </div>
      </AdminForm>
    </div>
  );
}
