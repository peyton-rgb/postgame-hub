// ============================================================
// /admin/campaigns/[id]/page — the Opt-in page builder: Lovable's 12
// numbered rows plus "Who's eligible" and "Hero video / photo", with
// the live App / Mobile web / Desktop web preview. Saves to
// campaign_optin_pages (migration 083 + the 084 extras).
//
// Server component loads the campaign, the saved page, the App card
// (hero fallback) and the Postgame wordmark; the builder itself is a
// client island fed by that data.
// ============================================================

import Link from "next/link";
import { Inter, Poppins } from "next/font/google";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { brandLogo, loadCampaign, loadPlaybook } from "@/lib/admin/campaigns/queries";
import OptinBuilder from "@/components/admin/campaign/OptinBuilder";
import { saveOptinPage } from "../../actions";

export const dynamic = "force-dynamic";

// The athlete app's faces, scoped to the preview via CSS variables.
const poppins = Poppins({ weight: ["600", "700", "800"], subsets: ["latin"], variable: "--font-poppins", display: "swap" });
const inter = Inter({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-inter", display: "swap" });

const POSTGAME_BRAND_ID = "7a0e28e9-d62f-427d-a207-cd22596fcf50";

const RESULT_NOTES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  saved: { tone: "ok", text: "Opt-in page saved · app and web." },
  "saved-partial": {
    tone: "ok",
    text: "Saved. The timeline, eligibility and hero media were skipped: they need migration 20261020_084 applied first.",
  },
  error: { tone: "bad", text: "That didn't save. Nothing was changed." },
};

export default async function OptinPageBuilder({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const id = Number(params.id);

  const { bundle, error } = await loadCampaign(supabase, id);
  if (error || !bundle) {
    return (
      <div>
        <PageHeader title="Opt-In Page" />
        <ErrorNote message={error ? `Could not load campaign: ${error}` : "Campaign not found."} />
        <Link href="/admin/campaigns" className="mt-4 inline-block text-[13px] text-[#D73F09]">
          ← Back to campaigns
        </Link>
      </div>
    );
  }
  const { campaign: c, extras, brand } = bundle;

  const [playbook, pg] = await Promise.all([
    loadPlaybook(supabase, id),
    supabase.from("brands").select("logo_light_url, logo_white_url, logo_primary_url").eq("id", POSTGAME_BRAND_ID).maybeSingle(),
  ]);
  const postgameLogoUrl = pg.data?.logo_light_url || pg.data?.logo_white_url || pg.data?.logo_primary_url || null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app";
  const note = searchParams.result ? RESULT_NOTES[searchParams.result] : undefined;
  const card = playbook.appCard;
  const cardUrl = card?.video_url || card?.image_url || null;

  return (
    <div className={`${poppins.variable} ${inter.variable}`}>
      <div className="pb-2 text-[12px] text-stone-500">
        <Link href="/admin/campaigns" className="hover:underline">
          Campaigns
        </Link>{" "}
        /{" "}
        <Link href={`/admin/campaigns/${id}`} className="hover:underline">
          {c.campaign_name || "Untitled campaign"}
        </Link>
      </div>

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

      <OptinBuilder
        campaignId={id}
        campaignName={c.campaign_name || "Untitled campaign"}
        brandName={brand?.name ?? null}
        brandLogoUrl={brandLogo(brand, "dark")}
        postgameLogoUrl={postgameLogoUrl}
        campaignType={extras.campaign_type}
        event={{
          date: extras.event_date,
          start_time: extras.event_start_time,
          venue: extras.event_venue,
          call_time: extras.event_call_time,
        }}
        initial={playbook.optinPage.data}
        exists={playbook.optinPage.exists}
        isActive={c.is_active ?? false}
        publicUrl={`${siteUrl}/join/${id}`}
        appCard={card && cardUrl ? { name: card.name, url: cardUrl } : null}
        contractTitle={c.contract_title ?? ""}
        contract={c.contract ?? ""}
        action={saveOptinPage}
      />
    </div>
  );
}
