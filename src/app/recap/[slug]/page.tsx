import { createServerSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { CampaignRecap } from "@/components/CampaignRecap";
import { Top50Recap } from "@/components/Top50Recap";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerSupabase();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("name, client_name, settings")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!campaign) return { title: "Not Found" };

  const isTop50 = campaign.settings?.campaign_type === "top_50";
  return {
    title: isTop50
      ? `${campaign.name} — Top 50 Rankings`
      : `${campaign.name} — ${campaign.client_name} Campaign Recap`,
    description: isTop50
      ? `Top 50 athlete rankings for ${campaign.name} by ${campaign.client_name}`
      : `Campaign recap for ${campaign.name} by ${campaign.client_name}`,
  };
}

export default async function RecapPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerSupabase();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!campaign) notFound();

  const [{ data: athletes }, { data: media }] = await Promise.all([
    supabase
      .from("athletes")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("sort_order"),
    supabase
      .from("media")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("sort_order"),
  ]);

  const mediaByAthlete: Record<string, any[]> = {};
  (media || []).forEach((m: any) => {
    if (!mediaByAthlete[m.athlete_id]) mediaByAthlete[m.athlete_id] = [];
    mediaByAthlete[m.athlete_id].push(m);
  });

  const allAthletes = athletes || [];
  // Gallery athletes: only those with actual uploaded media
  const galleryAthletes = allAthletes.filter((a: any) => {
    const items = mediaByAthlete[a.id];
    return items && items.some((m: any) => !m.is_video_thumbnail);
  });

  const isTop50 = campaign.settings?.campaign_type === "top_50";

  if (isTop50) {
    return (
      <Top50Recap
        campaign={campaign}
        athletes={allAthletes}
        media={mediaByAthlete}
      />
    );
  }

  return (
    <CampaignRecap
      campaign={campaign}
      athletes={galleryAthletes}
      allAthletes={allAthletes}
      media={mediaByAthlete}
    />
  );
}
