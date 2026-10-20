// ============================================================
// /join/[slug] — the public opt-in page athletes open from a link.
// slug = campaign_id for now (campaigns has no slug column yet).
//
// Server-rendered from campaign_optin_pages + the campaign row, with
// the same renderer the builder previews: mobile web layout on phones,
// the landing layout on wide screens (switched in CSS). No auth to
// view; "Opt in" sends athletes to the existing athlete login with
// ?next= back to this page.
// ============================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase-server";
import { brandLogo, loadCampaign, loadPlaybook } from "@/lib/admin/campaigns/queries";
import { PublicJoinPage } from "@/components/admin/campaign/OptinPreview";

export const dynamic = "force-dynamic";

const POSTGAME_BRAND_ID = "7a0e28e9-d62f-427d-a207-cd22596fcf50";

function parseId(slug: string): number | null {
  const n = Number(slug);
  return /^\d+$/.test(slug) && Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const id = parseId(params.slug);
  if (!id) return { title: "Postgame" };
  const supabase = createServiceSupabase();
  const [{ bundle }, { data: page }] = await Promise.all([
    loadCampaign(supabase, id),
    supabase.from("campaign_optin_pages").select("headline, description").eq("campaign_id", id).maybeSingle(),
  ]);
  if (!bundle || !page) return { title: "Postgame" };
  const title = [page.headline || bundle.campaign.campaign_name, bundle.brand?.name, "Postgame"].filter(Boolean).join(" · ");
  return {
    title,
    description: page.description ?? undefined,
    openGraph: { title, description: page.description ?? undefined, type: "website" },
  };
}

export default async function JoinPage({ params }: { params: { slug: string } }) {
  const id = parseId(params.slug);
  if (!id) notFound();

  const supabase = createServiceSupabase();
  const { bundle } = await loadCampaign(supabase, id);
  if (!bundle) notFound();

  const [playbook, pg] = await Promise.all([
    loadPlaybook(supabase, id),
    supabase.from("brands").select("logo_light_url, logo_white_url, logo_primary_url").eq("id", POSTGAME_BRAND_ID).maybeSingle(),
  ]);
  // A campaign without a saved opt-in page has nothing to show yet.
  if (!playbook.optinPage.exists) notFound();

  const { campaign: c, extras, brand } = bundle;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app";
  const publicUrl = `${siteUrl}/join/${id}`.replace(/^https?:\/\//, "");
  const card = playbook.appCard;

  if (!c.is_active) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 800, fontSize: 24 }}>
            This campaign is closed
          </div>
          <p style={{ color: "#AAAAB0", marginTop: 8, fontSize: 14 }}>
            Opt-ins for {c.campaign_name || "this campaign"} have ended. Open the Postgame app to see what&apos;s live now.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <PublicJoinPage
        data={playbook.optinPage.data}
        campaignName={c.campaign_name || "Campaign"}
        brandName={brand?.name ?? null}
        brandLogoUrl={brandLogo(brand, "dark")}
        postgameLogoUrl={pg.data?.logo_light_url || pg.data?.logo_white_url || pg.data?.logo_primary_url || null}
        campaignType={extras.campaign_type}
        event={{
          date: extras.event_date,
          start_time: extras.event_start_time,
          venue: extras.event_venue,
          call_time: extras.event_call_time,
        }}
        optInHref={`/athlete/login?next=${encodeURIComponent(`/join/${id}`)}`}
        publicUrl={publicUrl}
        heroFallbackUrl={card?.video_url || card?.image_url || null}
      />
    </main>
  );
}
