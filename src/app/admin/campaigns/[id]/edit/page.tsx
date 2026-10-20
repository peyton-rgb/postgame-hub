// ============================================================
// /admin/campaigns/[id]/edit — Edit campaign, rebuilt to the approved
// prototype. Sections, in order:
//   1 General (incl. Campaign type → Event details when Event)
//   2 Budget · 3 Who can join · 4 Playbook links · 5 Affiliate & tracking
//   Archive zone (admin only; is_active=false, never a hard delete)
// Right rail: "On this page". Save goes through the confirmed sticky
// save bar (AdminForm). Opt-in page, contract and tags are edited on
// the Opt-in page builder, as the prototype says.
// ============================================================

import Link from "next/link";
import { requireAdmin, hasLevel } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import AdminForm, { FieldCard, Field } from "@/components/admin/StickySaveBar";
import { loadCampaign } from "@/lib/admin/campaigns/queries";
import { personName } from "@/lib/admin/campaigns/types";
import GeneralAndEventSections from "@/components/admin/campaign/CampaignTypeFields";
import { saveCampaign, archiveCampaign } from "../../actions";

export const dynamic = "force-dynamic";

const RESULT_NOTES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  saved: { tone: "ok", text: "Saved." },
  "saved-partial": {
    tone: "ok",
    text: "Saved. Campaign type, event details and the sheet links were skipped: they need migration 20261020_084 applied first.",
  },
  error: { tone: "bad", text: "Save failed. Nothing was changed." },
  "name-required": { tone: "bad", text: "Campaign name is required. Nothing was changed." },
  "archive-unconfirmed": { tone: "bad", text: "Type ARCHIVE exactly to archive this campaign." },
};

const money = (v: number | null | undefined) => (v == null ? "" : String(v));

const SECTIONS = [
  ["general", "General"],
  ["budget", "Budget"],
  ["join", "Who can join"],
  ["playbook", "Playbook links"],
  ["tracking", "Affiliate & tracking"],
] as const;

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

  const { bundle, error } = await loadCampaign(supabase, id);
  if (error || !bundle) {
    return (
      <div>
        <PageHeader title="Edit campaign" />
        <ErrorNote message={error ? `Could not load campaign: ${error}` : "Campaign not found."} />
        <Link href="/admin/campaigns" className="mt-4 inline-block text-[13px] text-[#D73F09]">
          ← Back to campaigns
        </Link>
      </div>
    );
  }
  const { campaign: c, extras, extrasPending, brand } = bundle;

  const [{ data: brands }, { data: staff }] = await Promise.all([
    supabase.from("brands").select("id, name").order("name"),
    // Postgame staff = the admin person types (Super Admin, Admin, Admin Finance, Admin Sales).
    supabase.from("people").select("id, first_name, last_name").ilike("person_type", "%admin%").order("first_name"),
  ]);
  const staffOptions = [
    { value: "", label: "— None —" },
    ...(staff ?? []).map((p) => ({ value: p.id, label: personName(p) ?? p.id.slice(0, 8) })),
  ];
  const brandOptions = (brands ?? []).map((b) => ({ value: b.id, label: b.name ?? b.id.slice(0, 8) }));
  const note = searchParams.result ? RESULT_NOTES[searchParams.result] : undefined;
  const detailHref = `/admin/campaigns/${id}`;

  // Example affiliate URL from the saved template, with the variables left visible.
  const exampleUrl = c.affiliate_link
    ? `${c.affiliate_link}${c.affiliate_param_template ? (c.affiliate_link.includes("?") ? "&" : "?") + c.affiliate_param_template : ""}`
    : null;

  return (
    <div>
      <div className="pb-2 text-[12px] text-stone-500">
        <Link href="/admin/campaigns" className="hover:underline">
          Campaigns
        </Link>{" "}
        /{" "}
        <Link href={detailHref} className="hover:underline">
          {c.campaign_name || "Untitled campaign"}
        </Link>
      </div>
      <PageHeader
        title="Edit campaign"
        subtitle={[c.campaign_name || "Untitled", brand?.name, `#${c.campaign_id}`].filter(Boolean).join(" · ")}
        actions={
          <Link href={detailHref} className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700">
            Cancel
          </Link>
        }
      />

      {note && (
        <div
          className={
            "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
            (note.tone === "ok" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-status-bad")
          }
        >
          {note.text}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <AdminForm
            action={saveCampaign}
            confirmSummary={`Save changes to “${c.campaign_name ?? "this campaign"}”? Only this one campaign is updated.`}
          >
            <input type="hidden" name="campaign_id" value={c.campaign_id} />
            <div className="space-y-4">
              <GeneralAndEventSections
                values={{
                  campaign_name: c.campaign_name,
                  brand_id: c.brand_id,
                  manager_person_id: c.manager_person_id,
                  assistant_person_id: c.assistant_person_id,
                  expected_pay_date: c.expected_pay_date,
                  campaign_note: c.campaign_note,
                  is_active: c.is_active ?? false,
                  brand_approves_in: extras.brand_approves_in ?? c.brand_approval_mode ?? null,
                }}
                extras={extras}
                pending={extrasPending}
                brandOptions={brandOptions}
                staffOptions={staffOptions}
              />

              <div id="budget">
                <FieldCard title="2 · Budget">
                  <Field label="Total budget" name="total_budget" defaultValue={money(c.total_budget)} placeholder="$0" />
                  <Field label="Est. athlete spend" name="est_athlete_spend" defaultValue={money(c.est_athlete_spend)} placeholder="$0" />
                  <Field label="Est. videographer spend" name="est_videographer_spend" defaultValue={money(c.est_videographer_spend)} placeholder="$0" />
                  <Field label="Management fee" name="management_fee" defaultValue={money(c.management_fee)} placeholder="$0" />
                  <Field label="Other" name="other_spend" defaultValue={money(c.other_spend)} placeholder="$0" />
                  <Field label="Est. margin goal (%)" name="est_margin_goal" defaultValue={money(c.est_margin_goal)} placeholder="0%" />
                </FieldCard>
              </div>

              <div id="join">
                <FieldCard title="3 · Who can join">
                  <Field
                    label="Colleges for this campaign"
                    name="college_id_list"
                    type="textarea"
                    span2
                    defaultValue={c.college_id_list}
                    placeholder="College ids, comma-separated (the college picker arrives with the Audiences slice)"
                  />
                  <Field label="Content type" name="content_type" defaultValue={c.content_type} placeholder="e.g. Photos + A.I. video" />
                  <label className="flex items-start gap-2 text-[13px] font-medium text-stone-700 md:col-span-2">
                    <input type="checkbox" name="is_auto_select" defaultChecked={c.is_auto_select ?? false} className="mt-0.5 h-4 w-4 accent-[#D73F09]" />
                    <span>
                      Auto-select every opt-in
                      <span className="block text-[12px] font-normal text-stone-500">Everyone who opts in is selected automatically.</span>
                    </span>
                  </label>
                </FieldCard>
              </div>

              <div id="playbook">
                <FieldCard title="4 · Playbook links">
                  <Field label="Campaign SOW" name="sow_link" type="url" defaultValue={c.sow_link} placeholder="Paste link" />
                  <Field label="Campaign invoice" name="invoice_link" type="url" defaultValue={c.invoice_link} placeholder="Paste link" />
                  <Field label="Campaign brief" name="campaign_brief_link" type="url" defaultValue={c.campaign_brief_link} placeholder="Paste link" />
                  <Field label="Campaign instructions" name="campaign_details_link" type="url" defaultValue={c.campaign_details_link} placeholder="Paste link" />
                  <Field label="Style guide" name="campaign_style_guide" type="url" defaultValue={c.campaign_style_guide} placeholder="Paste link" />
                  <Field label="Asana task" name="asana_link" type="url" defaultValue={c.asana_link} placeholder="Paste link" />
                  <Field label="Internal sheet" name="internal_sheet_link" type="url" defaultValue={extras.internal_sheet_link} placeholder="Paste link" readOnly={extrasPending} />
                  <Field label="External sheet" name="external_sheet_link" type="url" defaultValue={extras.external_sheet_link} placeholder="Paste link" readOnly={extrasPending} />
                  <Field label="Performance tracker" name="performance_tracker_link" type="url" defaultValue={extras.performance_tracker_link} placeholder="Paste link" readOnly={extrasPending} />
                  <Field label="Drive folder id" name="drive_folder_id" defaultValue={extras.drive_folder_id} placeholder="Folder id from the Drive URL" readOnly={extrasPending} />
                  <Field label="LucidLink folder path" name="lucidlink_folder_path" span2 defaultValue={extras.lucidlink_folder_path} placeholder="Brand/Year/Campaign" readOnly={extrasPending} />
                  <p className="text-[12px] text-stone-500 md:col-span-2">
                    The internal sheet, external sheet, performance tracker, LucidLink folder and Drive folder will be made
                    automatically once that integration moves over. Until then, paste the links here
                    {extrasPending ? " (these five fields unlock with migration 20261020_084)" : ""}.
                  </p>
                </FieldCard>
              </div>

              <div id="tracking">
                <FieldCard title="5 · Affiliate & tracking">
                  <Field label="Affiliate link" name="affiliate_link" type="url" span2 defaultValue={c.affiliate_link} />
                  <Field label="Affiliate landing page" name="affiliate_landing_page" type="url" defaultValue={c.affiliate_landing_page} />
                  <Field label="Affiliate ad ID" name="affiliate_ad_id" defaultValue={c.affiliate_ad_id} />
                  <Field
                    label="Tracking variables"
                    name="affiliate_param_template"
                    type="textarea"
                    span2
                    defaultValue={c.affiliate_param_template}
                    placeholder="sharedid={user_id}&subId1={campaign_id}"
                  />
                  <p className="-mt-1 text-[12px] text-stone-500 md:col-span-2">
                    Added to each athlete&apos;s link. Variables: {"{user_id} {campaign_id} {ig} {first_name} {last_name} {college} {sport}"}
                  </p>
                  {exampleUrl && (
                    <div className="break-all rounded-md bg-stone-50 px-2.5 py-2 font-mono text-[12px] text-stone-700 md:col-span-2">
                      <span className="mr-2 font-sans text-stone-500">Example</span>
                      {exampleUrl}
                    </div>
                  )}
                  <Field label="UTM source" name="utm_source" defaultValue={c.utm_source} />
                  <Field label="UTM medium" name="utm_medium" defaultValue={c.utm_medium} />
                  <Field label="UTM campaign" name="utm_campaign" defaultValue={c.utm_campaign} placeholder="Defaults to the athlete's Instagram" />
                  <Field label="UTM content" name="utm_content" defaultValue={c.utm_content} />
                  <Field label="Custom tracking" name="custom_tracking" span2 defaultValue={c.custom_tracking} />
                </FieldCard>
              </div>
            </div>
          </AdminForm>

          {hasLevel(user, "admin") && (
            <form id="archive" action={archiveCampaign} className="mb-28 mt-2 rounded-lg border border-red-200 bg-white p-4 md:p-5">
              <input type="hidden" name="campaign_id" value={c.campaign_id} />
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-status-bad">Archive campaign</h2>
              <p className="mt-2 text-[13px] text-stone-600">
                {c.is_active ? (
                  <>
                    Admins only. Archiving marks the campaign inactive and hides it from the active list; nothing is deleted
                    and it can be reactivated with the Active box above. Type{" "}
                    <span className="font-mono font-bold text-status-bad">ARCHIVE</span> to confirm.
                  </>
                ) : (
                  <>This campaign is already archived. Tick Active above and save to bring it back.</>
                )}
              </p>
              {c.is_active && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    name="confirm"
                    placeholder='Type "ARCHIVE" to confirm'
                    autoComplete="off"
                    className="max-w-xs flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px]"
                  />
                  <button type="submit" className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-[13px] font-medium text-status-bad hover:bg-red-50">
                    Archive campaign
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-4">
          <div className="rounded-lg border border-stone-200 bg-white p-4 text-[13px]">
            <b className="text-stone-900">On this page</b>
            <ol className="mt-2 space-y-1.5">
              {SECTIONS.map(([anchor, label], i) => (
                <li key={anchor}>
                  <a href={`#${anchor}`} className="text-stone-500 hover:text-stone-900">
                    {i + 1}. {label}
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t border-stone-200 pt-3 text-[12px] text-stone-500">
              The opt-in page, athlete contract and tags are edited on the{" "}
              <Link href={`/admin/campaigns/${id}/page`} className="font-medium text-[#D73F09] hover:underline">
                Opt-in page
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
