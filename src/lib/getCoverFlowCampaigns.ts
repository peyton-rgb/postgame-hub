// Postgame — server-side data for the campaign cover flow.
// Runs on the server only. It reads the database and returns a clean list of
// cards, already shaped exactly the way the cover flow component wants them.
//
// THREE THINGS TO ADJUST (all marked with  // ADJUST  below):
//   1. The import path for your Supabase server client.
//   2. The import path for the CampaignCard type.
//   3. (Optional) the filter that decides which campaigns are "public".

import { createServerSupabase } from "@/lib/supabase-server";        // ADJUST 1: point at your Supabase server client
import type { CampaignCard } from "@/components/CampaignCoverFlow"; // ADJUST 2: point at the component file
import {
  BRAND_LOGO_COLUMNS,
  groupLogosByBrand,
  resolveBrandLogo,
  type BrandLogoRow,
} from "@/lib/brand-logo";

// What one campaign row looks like coming back from the query.
type Row = {
  id: string;
  name: string | null;
  slug: string | null;
  client_name: string | null;
  client_logo_url: string | null;
  hero_image_url: string | null;
  thumbnail_url: string | null;
  brand_id: string | null;
  featured: boolean | null;
  hero_recap_video_url: string | null;
  created_at: string | null;
  // The joined brand. Supabase may hand this back as an object or a 1-item array,
  // so we handle both below.
  brands:
    | { logo_light_url: string | null; logo_primary_url: string | null }
    | { logo_light_url: string | null; logo_primary_url: string | null }[]
    | null;
};

export async function getCoverFlowCampaigns(
  opts: { featuredOnly?: boolean } = {}
): Promise<CampaignCard[]> {
  const supabase = createServerSupabase();

  // 1) Pull the campaigns that should appear on the public page.
  //    "Public" here = published AND visibility is public/both, newest first,
  //    with any "featured" campaigns floated to the front.
  let query = supabase
    .from("campaign_recaps")
    .select(
      "id,name,slug,client_name,client_logo_url,hero_image_url,thumbnail_url,brand_id,featured,hero_recap_video_url,created_at,carousel_order, brands ( logo_light_url, logo_primary_url )"
    )
    .eq("published", true)
    .in("visibility", ["public", "both"]); // ADJUST 3: change the filter if you want a different public set

  // When the caller asks for featured-only (e.g. the strip on the public
  // /campaigns page), narrow the set further. Omitted/false = unchanged behavior.
  if (opts.featuredOnly) {
    query = query.eq("featured", true);
  }

  const { data, error } = await query
    .order("carousel_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // One bulk read for every brand on the page — these are public pages that
  // render many cards, so a per-row lookup would be an N+1.
  const brandIds = Array.from(
    new Set(((data ?? []) as any[]).map((r) => r.brand_id).filter(Boolean))
  );
  const { data: logoRows } = brandIds.length
    ? await supabase.from("brand_logos").select(BRAND_LOGO_COLUMNS).in("brand_id", brandIds)
    : { data: [] as BrandLogoRow[] };
  const logosByBrand = groupLogosByBrand((logoRows ?? []) as BrandLogoRow[]);

  if (error || !data) {
    console.error("getCoverFlowCampaigns:", error?.message);
    return [];
  }

  const rows = data as unknown as Row[];

  // 2) Most campaigns don't have a hero image set directly on them, so for any
  //    that are missing one we go find a hero from their MEDIA (their photos).
  //    We grab it for all the missing ones in a single batched query.
  const needHero = rows
    .filter((r) => !r.hero_image_url && !r.thumbnail_url)
    .map((r) => r.id);

  const heroFromMedia = new Map<string, string>();

  if (needHero.length) {
    const { data: media } = await supabase
      .from("media")
      .select("campaign_id,thumbnail_url,file_url,is_hero,hero_order,sort_order")
      .in("campaign_id", needHero)
      .eq("type", "image")
      .order("is_hero", { ascending: false })             // a flagged hero wins
      .order("hero_order", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true, nullsFirst: false });

    // Keep the FIRST usable image we see per campaign (the list is already ordered).
    media?.forEach((m) => {
      if (!heroFromMedia.has(m.campaign_id)) {
        const img = m.thumbnail_url ?? m.file_url;
        if (img) heroFromMedia.set(m.campaign_id, img);
      }
    });
  }

  // 3) Shape each row into a card. Any campaign with no usable hero is dropped,
  //    so the cover flow never shows an empty/black card.
  const cards: CampaignCard[] = [];
  for (const r of rows) {
    const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
    const hero =
      r.hero_image_url ?? r.thumbnail_url ?? heroFromMedia.get(r.id) ?? null;
    if (!hero) continue;

    cards.push({
      id: r.id,
      name: r.name ?? "",
      brand: r.client_name ?? "",
      slug: r.slug ?? r.id,
      hero,
      // Phase 2: optional cinematic-rotator fields. heroVideo is the hand-picked
      // hero_recap_video_url (may be null); poster is the still to show until it loads.
      heroVideo: r.hero_recap_video_url ?? null,
      poster: hero,
      // Two surfaces on one card: the logo sits directly on the DARK card
      // when a light-ink file exists, and on a WHITE CHIP when it falls back.
      // So both are resolved, each for its own ground — a single url would be
      // wrong for whichever half it wasn't chosen for. Legacy columns stay
      // beneath so brands with no brand_logos rows keep rendering.
      logoLight:
        resolveBrandLogo(logosByBrand.get(String(r.brand_id)), { surface: "dark", prefer: "lockup" })?.url ??
        brand?.logo_light_url ??
        null,
      logoChip:
        resolveBrandLogo(logosByBrand.get(String(r.brand_id)), { surface: "light", prefer: "lockup" })?.url ??
        brand?.logo_primary_url ??
        r.client_logo_url ??
        null,
    });
  }

  return cards;
}
