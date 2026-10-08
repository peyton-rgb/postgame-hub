import { createLiveSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { DynamicRunOfShowDetail } from "@/components/DynamicRunOfShow";
import type { Metadata } from "next";
import { buildDestBase, parseShootDate } from "@/lib/ros-upload";

// Crew open this on shoot day, so it must show the live rows: an edited call
// time cannot keep serving the old answer. createLiveSupabase() is what
// guarantees that (it opts every read out of Next's Data Cache); this only
// keeps the route itself from ever being prerendered.
export const dynamic = "force-dynamic";

const POSTGAME_BRAND_ID = "7a0e28e9-d62f-427d-a207-cd22596fcf50";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; city: string };
}): Promise<Metadata> {
  const supabase = createLiveSupabase();

  const { data: ros } = await supabase
    .from("run_of_shows")
    .select("id, name, client_name")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!ros) return { title: "Run of Show | Postgame" };

  const { data: shoot } = await supabase
    .from("ros_shoots")
    .select("city, state, event_name")
    .eq("run_of_show_id", ros.id)
    .eq("slug", params.city)
    .single();

  if (!shoot) return { title: "Run of Show | Postgame" };

  return {
    title: `${shoot.city}, ${shoot.state} — ${shoot.event_name} | Postgame x ${ros.client_name}`,
    description: `Run of show for ${shoot.event_name} in ${shoot.city}, ${shoot.state}`,
  };
}

export default async function DynamicShootPage({
  params,
}: {
  params: { slug: string; city: string };
}) {
  const supabase = createLiveSupabase();

  const { data: ros } = await supabase
    .from("run_of_shows")
    .select("*")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!ros) notFound();

  const { data: shoot } = await supabase
    .from("ros_shoots")
    .select("*")
    .eq("run_of_show_id", ros.id)
    .eq("slug", params.city)
    .single();

  if (!shoot) notFound();

  // Header lockup: Postgame mark + the client's logo, both from `brands`.
  const brandIds = [POSTGAME_BRAND_ID, ros.brand_id].filter(Boolean);
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, logo_primary_url, logo_white_url, logo_url")
    .in("id", brandIds);

  const postgame = brands?.find((b) => b.id === POSTGAME_BRAND_ID);
  const client = ros.brand_id
    ? brands?.find((b) => b.id === ros.brand_id)
    : undefined;

  // Where this stop lives in LucidLink — the same folders the upload box
  // writes to: content/<Brand>/<Year> - <Brand>/<campaign folder>/<Stop>.
  const campaignFolder = ros.lucid_campaign_folder?.trim();
  const shootDate = parseShootDate(shoot.date);
  const lucidStopPath = campaignFolder
    ? [
        "content",
        ...buildDestBase({
          brand: client?.name?.trim() || ros.client_name,
          year: shootDate ? shootDate.getUTCFullYear() : new Date().getFullYear(),
          campaignFolder,
          shootSlug: shoot.slug,
        }).split("/"),
      ]
    : null;

  return (
    <DynamicRunOfShowDetail
      lucidStopPath={lucidStopPath}
      ros={ros}
      shoot={shoot}
      postgameLogoUrl={postgame?.logo_primary_url || null}
      clientLogoUrl={
        client?.logo_white_url || client?.logo_primary_url || client?.logo_url || null
      }
    />
  );
}
