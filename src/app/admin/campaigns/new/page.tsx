// ============================================================
// /admin/campaigns/new — New campaign, to the approved prototype:
// name · account · campaign manager · total budget · campaign type ·
// note. Creates the row in the blended `campaigns` table and opens
// the campaign page.
//
// The prototype's subtitle promises Drive folders, a Frame.io project,
// the upload form and three Google Sheets on create. That automation
// hasn't moved over yet, so the three sheet links are recorded as
// empty and the page says so instead of pretending.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { CampaignTypeSwitch } from "@/components/admin/campaign/CampaignTypeFields";
import { personName } from "@/lib/admin/campaigns/types";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const [{ data: brands }, { data: staff }] = await Promise.all([
    supabase.from("brands").select("id, name").eq("archived", false).order("name"),
    supabase.from("people").select("id, first_name, last_name").ilike("person_type", "%admin%").order("first_name"),
  ]);

  const input = "mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900";
  const label = "block text-[12px] font-medium text-stone-600";

  return (
    <div className="max-w-2xl">
      <div className="pb-2 text-[12px] text-stone-500">
        <Link href="/admin/campaigns" className="hover:underline">
          All campaigns
        </Link>
      </div>
      <PageHeader
        title="New campaign"
        subtitle="Creates the campaign and opens its page. Drive folders, the Frame.io project, the upload form and the three sheets come later."
      />

      {searchParams.result === "name-required" && <ErrorNote message="Campaign name is required." />}
      {searchParams.result === "error" && <ErrorNote message="Could not create the campaign. Nothing was saved." />}

      <form action={createCampaign} className="mt-2 rounded-lg border border-stone-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={label + " md:col-span-2"}>
            Campaign name
            <input name="campaign_name" required placeholder="e.g. Holiday 26" className={input} />
          </label>
          <label className={label}>
            Account
            <select name="brand_id" defaultValue="" className={input}>
              <option value="">Choose a brand</option>
              {(brands ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Campaign manager
            <select name="manager_person_id" defaultValue="" className={input}>
              <option value="">Choose a staff member</option>
              {(staff ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {personName(p) ?? p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Total budget ($)
            <input name="total_budget" inputMode="decimal" placeholder="$0" className={input} />
          </label>
          <CampaignTypeSwitch initial="social" />
          <label className={label + " md:col-span-2"}>
            Campaign note
            <textarea name="campaign_note" rows={2} placeholder="Anything the team should know" className={input} />
          </label>
        </div>

        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[12px] leading-5 text-status-warn">
          The internal sheet, external sheet and performance tracker are recorded as empty for now. Creating them (plus
          the Drive folders, Frame.io project and upload form) is a later integration — paste links on Edit campaign in the
          meantime.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Link href="/admin/campaigns" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700">
            Cancel
          </Link>
          <button type="submit" className="rounded-md bg-[#D73F09] px-4 py-1.5 text-[13px] font-medium text-white">
            Create campaign
          </button>
        </div>
      </form>
    </div>
  );
}
