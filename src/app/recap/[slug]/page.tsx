import { createPlainSupabase, createServiceSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { CampaignRecap } from "@/components/CampaignRecap";
import { Top50Recap } from "@/components/Top50Recap";
import { detectCollabGroups } from "@/lib/csv-parser";
import { deriveContainerCollab } from "@/lib/collab-reconcile";
import type { Athlete } from "@/lib/types";
import type { Metadata } from "next";
// PostgameCalendar is now rendered inside CampaignRecap and Top50Recap
// (right above their respective footers), so page.tsx no longer imports it.

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
};

// `?preview=1` lets the recap render even when published=false. Gated to
// non-production so a stray query string on the live site can't expose drafts.
function allowPreviewBypass(sp: { preview?: string } | undefined) {
  return sp?.preview === "1" && process.env.NODE_ENV !== "production";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const preview = allowPreviewBypass(sp);
  // Preview mode uses the service-role client so RLS doesn't hide draft recaps.
  const supabase = preview ? createServiceSupabase() : createPlainSupabase();
  let q = supabase
    .from("campaign_recaps")
    .select("name, client_name, settings")
    .eq("slug", slug);
  if (!preview) q = q.eq("published", true);
  const { data: campaign } = await q.single();

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

export default async function RecapPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const preview = allowPreviewBypass(sp);
  // Preview mode uses the service-role client so RLS doesn't hide draft recaps.
  const supabase = preview ? createServiceSupabase() : createPlainSupabase();

  let recapQ = supabase.from("campaign_recaps").select("*").eq("slug", slug);
  if (!preview) recapQ = recapQ.eq("published", true);
  const { data: campaign } = await recapQ.single();

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

  // For media rows without a direct athlete_id (e.g. team/shared-folder imports),
  // fan them out via the many-to-many media_athletes table so every linked
  // athlete sees them in their slot of the gallery.
  const mediaIds = (media || []).map((m: any) => m.id);
  const { data: maLinks } = mediaIds.length
    ? await supabase
        .from("media_athletes")
        .select("media_id, athlete_id")
        .in("media_id", mediaIds)
    : { data: [] };
  const linkedAthletesByMedia: Record<string, string[]> = {};
  for (const l of (maLinks || []) as any[]) {
    if (!linkedAthletesByMedia[l.media_id]) linkedAthletesByMedia[l.media_id] = [];
    linkedAthletesByMedia[l.media_id].push(l.athlete_id);
  }

  // Collab reconciliation: fold "collab:c-<containerId>-<slot>" media onto its
  // URL-derived group id, and surface a container-derived card for pre-URL teams
  // (imported team content with no shared post URL in the tracker yet).
  const { data: containers } = await supabase
    .from("collab_containers")
    .select("id, collab_container_athletes(included, athletes(id))")
    .eq("campaign_id", campaign.id);
  const containerLite = (containers || []).map((c: any) => ({
    containerId: c.id,
    athleteIds: (c.collab_container_athletes || [])
      .filter((x: any) => x.included !== false && x.athletes)
      .map((x: any) => x.athletes.id),
  }));
  const collabCounts: Record<string, number> = {};
  for (const m of (media || []) as any[]) {
    if (typeof m.drive_file_id === "string" && m.drive_file_id.startsWith("collab:")) {
      const k = m.drive_file_id.slice("collab:".length);
      collabCounts[k] = (collabCounts[k] || 0) + 1;
    }
  }
  const urlCollabGroups = detectCollabGroups<Athlete>(
    (athletes || []) as Athlete[],
    (a) => a.id,
  ).collabGroups;
  const athleteNameById = new Map<string, string>(
    (athletes || []).map((a: any) => [a.id, a.name]),
  );
  const { containerGroups, remap: collabKeyRemap } = deriveContainerCollab(
    urlCollabGroups,
    containerLite,
    (key) => collabCounts[key] || 0,
    (aid) => athleteNameById.get(aid),
  );

  const mediaByAthlete: Record<string, any[]> = {};
  (media || []).forEach((m: any) => {
    if (typeof m.drive_file_id === "string" && m.drive_file_id.startsWith("collab:")) {
      const rawKey = m.drive_file_id.slice("collab:".length);
      const groupId = collabKeyRemap[rawKey] ?? rawKey;
      if (!mediaByAthlete[groupId]) mediaByAthlete[groupId] = [];
      mediaByAthlete[groupId].push(m);
      return;
    }
    if (m.athlete_id) {
      if (!mediaByAthlete[m.athlete_id]) mediaByAthlete[m.athlete_id] = [];
      mediaByAthlete[m.athlete_id].push(m);
      return;
    }
    // No direct athlete_id — fan out via media_athletes (team/shared folders).
    for (const aId of linkedAthletesByMedia[m.id] || []) {
      if (!mediaByAthlete[aId]) mediaByAthlete[aId] = [];
      mediaByAthlete[aId].push(m);
    }
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

  // Collab groups: URL-derived (from persisted athletes) + container-derived
  // cards for pre-URL teams. Media is keyed to match via collabKeyRemap above.
  const collabGroups = [...urlCollabGroups, ...containerGroups];

  // Event content: athlete-less, non-collab, link-less media for the
  // gallery-first Event Content section. Only for event campaigns — every
  // other campaign passes nothing, so existing recaps are untouched.
  const isEvent = campaign.settings?.campaign_type === "event";
  const eventMedia = isEvent
    ? (media || []).filter(
        (m: any) =>
          !m.athlete_id &&
          !(typeof m.drive_file_id === "string" && m.drive_file_id.startsWith("collab:")) &&
          !(linkedAthletesByMedia[m.id]?.length) &&
          !m.is_video_thumbnail,
      )
    : [];

  return (
    <CampaignRecap
      campaign={campaign}
      athletes={galleryAthletes}
      allAthletes={allAthletes}
      media={mediaByAthlete}
      collabGroups={collabGroups}
      eventMedia={eventMedia}
    />
  );
}
