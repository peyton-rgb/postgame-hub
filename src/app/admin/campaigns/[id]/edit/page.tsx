// ============================================================
// /admin/campaigns/[id]/edit — Edit Campaign, rebuilt from the
// postgame1.com (Lovable) admin onto the blended `campaigns` table.
//
// Same sections, same order, same labels as the Lovable screen:
//   General · Campaign Playbook · Opt-In Page (Mobile App) · Links ·
//   Affiliate Link Builder · UTM & Tracking · Danger Zone (admin only)
// The Lovable "Overview & Goals" section is hidden there, so it is
// left out here too. Save goes through the confirmed sticky save bar.
// ============================================================

import Link from "next/link";
import { requireAdmin, hasLevel } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import AdminForm, { FieldCard, Field } from "@/components/admin/StickySaveBar";
import { saveCampaign, archiveCampaign } from "../../actions";

export const dynamic = "force-dynamic";

const RESULT_NOTES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  created: { tone: "ok", text: "Campaign created. Fill in the details below." },
  saved: { tone: "ok", text: "Saved." },
  error: { tone: "bad", text: "Save failed. Nothing was changed." },
  "name-required": { tone: "bad", text: "Campaign name is required. Nothing was changed." },
  "delete-unconfirmed": { tone: "bad", text: "Type ARCHIVE exactly to archive this campaign." },
  "delete-blocked": {
    tone: "bad",
    text: "This campaign can't be deleted: it still has content, contracts or other records linked to it.",
  },
};

const money = (v: number | null | undefined) => (v == null ? "" : String(v));

export default async function CampaignEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const user = await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const id = Number(params.id);

  const { data: c, error } = Number.isInteger(id)
    ? await supabase.from("campaigns").select("*").eq("campaign_id", id).maybeSingle()
    : { data: null, error: null };

  if (error || !c) {
    return (
      <div>
        <PageHeader title="Edit Campaign" />
        <ErrorNote message={error ? `Could not load campaign: ${error.message}` : "Campaign not found."} />
        <Link href="/admin/campaigns" className="mt-4 inline-block text-[13px] text-[#D73F09]">
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  const [{ data: brands }, { data: staff }] = await Promise.all([
    supabase.from("brands").select("id, name").order("name"),
    // Postgame staff = the admin person types (Super Admin, Admin, Admin Finance, Admin Sales).
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .ilike("person_type", "%admin%")
      .order("first_name"),
  ]);

  const staffOptions = [
    { value: "", label: "— None —" },
    ...(staff ?? []).map((p) => ({
      value: p.id,
      label: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.id.slice(0, 8),
    })),
  ];
  const note = searchParams.result ? RESULT_NOTES[searchParams.result] : undefined;

  return (
    <div>
      <PageHeader
        title="Edit Campaign"
        subtitle={`${c.campaign_name ?? "Untitled"} · ID ${c.campaign_id}`}
        actions={
          <Link href="/admin/campaigns" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700">
            ← Campaigns
          </Link>
        }
      />

      {note && (
        <div
          className={
            "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
            (note.tone === "ok"
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-status-bad")
          }
        >
          {note.text}
        </div>
      )}

      <AdminForm
        action={saveCampaign}
        confirmSummary={`Save changes to “${c.campaign_name ?? "this campaign"}”? Only this one campaign is updated.`}
      >
        <input type="hidden" name="campaign_id" value={c.campaign_id} />
        <div className="space-y-4">
          <FieldCard title="General">
            <Field label="Campaign Name" name="campaign_name" defaultValue={c.campaign_name} />
            <Field
              label="Account"
              name="brand_id"
              type="select"
              defaultValue={c.brand_id}
              options={[{ value: "", label: "Select account" }, ...(brands ?? []).map((b) => ({ value: b.id, label: b.name }))]}
            />
            <Field label="Campaign Manager" name="manager_person_id" type="select" defaultValue={c.manager_person_id} options={staffOptions} />
            <Field label="Campaign Assistant" name="assistant_person_id" type="select" defaultValue={c.assistant_person_id} options={staffOptions} />
            <label className="flex items-center gap-2 text-[13px] font-medium text-stone-700 md:col-span-2">
              <input type="checkbox" name="is_active" defaultChecked={c.is_active ?? false} className="h-4 w-4 accent-[#D73F09]" />
              Active
            </label>
            <Field label="Total Budget Amount ($)" name="total_budget" defaultValue={money(c.total_budget)} placeholder="$0" />
            <Field label="Est. Athlete Spend ($)" name="est_athlete_spend" defaultValue={money(c.est_athlete_spend)} placeholder="$0" />
            <Field label="Est. Videographer Spend ($)" name="est_videographer_spend" defaultValue={money(c.est_videographer_spend)} placeholder="$0" />
            <Field label="Management Fee ($)" name="management_fee" defaultValue={money(c.management_fee)} placeholder="$0" />
            <Field label="Other ($)" name="other_spend" defaultValue={money(c.other_spend)} placeholder="$0" />
            <Field label="Est. Margin Goal (%)" name="est_margin_goal" defaultValue={money(c.est_margin_goal)} placeholder="0%" />
          </FieldCard>

          <FieldCard title="Campaign Playbook">
            <Field label="Campaign SOW" name="sow_link" type="url" defaultValue={c.sow_link} />
            <Field label="Campaign Invoice" name="invoice_link" type="url" defaultValue={c.invoice_link} />
            <Field label="Campaign Brief" name="campaign_brief_link" type="url" defaultValue={c.campaign_brief_link} />
            <Field label="Campaign Opt-In" name="campaign_webpage" type="url" defaultValue={c.campaign_webpage} />
            <Field label="Campaign Tracker" name="campaign_tracker" type="url" defaultValue={c.campaign_tracker} />
            <Field label="Campaign Recap" name="campaign_recap_link" type="url" defaultValue={c.campaign_recap_link} />
            <Field label="Style Guide" name="campaign_style_guide" type="url" defaultValue={c.campaign_style_guide} />
            <Field label="Asana" name="asana_link" type="url" defaultValue={c.asana_link} />
          </FieldCard>

          <section className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
            <h2 className="pb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">Opt-In Page (Mobile App)</h2>
            <p className="text-[13px] text-stone-600">
              Everything athletes see on the opt-in page (headline, compensation, required posts, examples, tags)
              plus the Talent Agreement is managed on the Opt-In Page. That screen is the next one being rebuilt.
            </p>
          </section>

          <FieldCard title="Links">
            <Field label="Affiliate Link" name="affiliate_link" type="url" defaultValue={c.affiliate_link} />
            <Field label="Affiliate Landing Page" name="affiliate_landing_page" type="url" defaultValue={c.affiliate_landing_page} />
            <Field label="Affiliate Ad ID" name="affiliate_ad_id" defaultValue={c.affiliate_ad_id} />
          </FieldCard>

          <FieldCard title="Affiliate Link Builder">
            <Field
              label="Tracking Variables"
              name="affiliate_param_template"
              type="textarea"
              span2
              defaultValue={c.affiliate_param_template}
              placeholder="sharedid={user_id}&subId1={campaign_id}"
            />
            <p className="text-[12px] text-stone-500 md:col-span-2">
              Appended to the affiliate link for each athlete. Leave blank to use the per-brand defaults.
            </p>
          </FieldCard>

          <FieldCard title="UTM & Tracking">
            <Field label="UTM Source" name="utm_source" defaultValue={c.utm_source} />
            <Field label="UTM Medium" name="utm_medium" defaultValue={c.utm_medium} />
            <Field label="UTM Campaign" name="utm_campaign" defaultValue={c.utm_campaign} />
            <Field label="UTM Content" name="utm_content" defaultValue={c.utm_content} />
            <Field label="Custom Tracking" name="custom_tracking" defaultValue={c.custom_tracking} />
          </FieldCard>
        </div>
      </AdminForm>

      {hasLevel(user, "admin") && (
        <form action={archiveCampaign} className="mb-28 mt-2 rounded-lg border border-red-200 bg-white p-4 md:p-5">
          <input type="hidden" name="campaign_id" value={c.campaign_id} />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-status-bad">Danger Zone</h2>
          <p className="mt-2 text-[13px] text-stone-600">
            Deleting a campaign is permanent and cannot be undone. Type{" "}
            <span className="font-mono font-bold text-status-bad">DELETE</span> to confirm.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              name="confirm"
              placeholder='Type "ARCHIVE" to confirm'
              autoComplete="off"
              className="max-w-xs flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px]"
            />
            <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white">
              Delete Campaign
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
