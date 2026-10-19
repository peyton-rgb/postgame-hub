// ============================================================
// /admin/campaigns/new — New campaign (the Lovable "New Campaign"
// dialog, as its own page): name + account (brand). Creates the row
// in the blended `campaigns` table and opens the edit screen.
//
// Not yet wired: the automatic Drive folders, upload form, Frame.io
// project and LucidLink folders the Lovable admin kicks off after
// create. Those automations move over in a later slice; the page
// says so instead of pretending.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("archived", false)
    .order("name");

  const input = "mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900";

  return (
    <div className="max-w-lg">
      <PageHeader title="New campaign" subtitle="Enter the campaign details below." />

      {searchParams.result === "name-required" && <ErrorNote message="Campaign name is required." />}
      {searchParams.result === "error" && <ErrorNote message="Could not create the campaign. Nothing was saved." />}

      <form action={createCampaign} className="mt-2 space-y-4 rounded-lg border border-stone-200 bg-white p-5">
        <label className="block text-[12px] font-medium text-stone-600">
          Campaign Name
          <input name="campaign_name" required placeholder="Enter campaign name" className={input} />
        </label>
        <label className="block text-[12px] font-medium text-stone-600">
          Account
          <select name="brand_id" defaultValue="" className={input}>
            <option value="">Select account</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-[12px] leading-5 text-status-warn">
          Drive folders, the athlete upload form and the Frame.io project are not created
          automatically here yet. That automation moves over from the old admin in a later step.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Link href="/admin/campaigns" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700">
            Cancel
          </Link>
          <button type="submit" className="rounded-md bg-[#D73F09] px-4 py-1.5 text-[13px] font-medium text-white">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
