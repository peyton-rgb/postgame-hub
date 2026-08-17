// ============================================================
// /admin/campaigns/[id]/edit — Campaign edit (campaigns_edit.cfm
// rebuilt). Grouped cards in CF field order; sticky save bar with
// unsaved-changes state; save is a confirmed POST server action.
//
// Only fields with REAL columns are editable. CF fields whose
// columns don't exist in the Hub yet (UTM set, IG/TikTok mention +
// hashtag, opt-in TOS, contract terms, payout date, colleges
// multi-select) are NOT rendered with fake storage — they're listed
// in the run-state doc as schema follow-ups.
//
// Lifecycle + owner (migration 023) render live when the columns
// exist; until then the card shows the honest pending state.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { PageHeader, PendingMigration, ErrorNote } from "@/components/admin/ui";
import AdminForm, { FieldCard, Field } from "@/components/admin/StickySaveBar";
import { saveCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function CampaignEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const { data: campaign, error } = await supabase
    .from("campaign_recaps")
    .select(
      "id, name, client_name, description, status, brand_id, brief_url, brief_doc_id, tracker_url, tracker_sheet_id, drive_folder_id, tags, created_at, admin_campaign_id"
    )
    .eq("id", params.id)
    .single();

  if (error || !campaign) {
    return (
      <div>
        <PageHeader title="Campaign edit" />
        <ErrorNote message="Campaign not found." />
      </div>
    );
  }

  // Lifecycle columns (migration 023) — probe with a safe query.
  const lifecycleProbe = await safeQuery<{ lifecycle_status: string | null; owner_id: string | null }>(
    () =>
      supabase
        .from("campaign_recaps")
        .select("lifecycle_status, owner_id")
        .eq("id", params.id)
        .single() as any
  );

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .neq("role", "athlete")
    .order("full_name");

  const result = searchParams.result;

  return (
    <div>
      <PageHeader
        title={campaign.name ?? "Untitled campaign"}
        subtitle={`Campaign edit · ID ${campaign.admin_campaign_id ?? campaign.id.slice(0, 8)}`}
      />

      {result === "saved" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Saved.
        </div>
      )}
      {result === "saved-pending023" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Core fields saved. Lifecycle/owner did not save — those columns arrive with migration
          023.
        </div>
      )}
      {result === "error" && <ErrorNote message="Save failed — nothing was changed. Check the server logs." />}

      <AdminForm
        action={saveCampaign}
        confirmSummary={`Save changes to “${campaign.name ?? "this campaign"}”? Only the fields you changed are written, scoped to this one campaign.`}
      >
        <input type="hidden" name="id" value={campaign.id} />
        <div className="space-y-4">
          <FieldCard title="Campaign">
            <Field label="Campaign Name" name="name" defaultValue={campaign.name} />
            <Field label="Client / Account Name" name="client_name" defaultValue={campaign.client_name} />
            <Field
              label="Status"
              name="status"
              type="select"
              defaultValue={campaign.status ?? "draft"}
              options={[
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ]}
            />
            <Field
              label="Tags (comma-separated)"
              name="tags"
              defaultValue={(campaign.tags ?? []).join(", ")}
            />
            <Field
              label="Campaign Notes"
              name="description"
              type="textarea"
              span2
              defaultValue={campaign.description}
            />
          </FieldCard>

          <FieldCard title="Links (URL-validated on save)">
            <Field label="Campaign Brief Link" name="brief_url" type="url" defaultValue={campaign.brief_url} />
            <Field
              label="Campaign Tracker Sheet Link"
              name="tracker_url"
              type="url"
              defaultValue={campaign.tracker_url}
            />
            <Field
              label="Drive Folder ID"
              name="drive_folder_id_display"
              defaultValue={campaign.drive_folder_id}
              readOnly
            />
            <Field
              label="Brief Doc ID"
              name="brief_doc_id_display"
              defaultValue={campaign.brief_doc_id}
              readOnly
            />
          </FieldCard>

          {lifecycleProbe.pending ? (
            <PendingMigration
              migration="023_campaign_lifecycle"
              feature="Lifecycle status + campaign owner"
            />
          ) : (
            <FieldCard title="Lifecycle (migration 023)">
              <Field
                label="Lifecycle Status"
                name="lifecycle_status"
                type="select"
                defaultValue={lifecycleProbe.data?.lifecycle_status ?? "draft"}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "delivered", label: "Delivered" },
                  { value: "closed", label: "Closed" },
                ]}
              />
              <Field
                label="Owner"
                name="owner_id"
                type="select"
                defaultValue={lifecycleProbe.data?.owner_id ?? ""}
                options={[
                  { value: "", label: "Unassigned" },
                  ...(staff ?? []).map((s) => ({
                    value: s.id,
                    label: s.full_name ?? s.email ?? s.id.slice(0, 8),
                  })),
                ]}
              />
            </FieldCard>
          )}
        </div>
      </AdminForm>
    </div>
  );
}
