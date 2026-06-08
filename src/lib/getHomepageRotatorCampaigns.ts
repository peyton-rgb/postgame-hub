// Postgame — server-side data for the homepage cinematic rotator.
//
// This is DELIBERATELY separate from getCoverFlowCampaigns() so the homepage
// rotator and the public /campaigns cover flow can be curated independently:
//   - cover flow  → campaign_recaps.featured        + carousel_order
//   - rotator     → campaign_recaps.homepage_featured + homepage_order   (this file)
//
// It returns the SAME CampaignCard shape the cover flow uses (so heroVideo +
// poster carry over from Phase 2), extended with a short description and the
// three hero stats the rotator shows (reach / engagement rate / athlete count).
//
// Client note: uses createPlainSupabase() (anon, NO cookies) rather than the
// cookie-aware createServerSupabase(). cookies() would force the homepage out
// of its `revalidate = 60` ISR caching into dynamic rendering; the plain client
// matches the rest of the homepage's data loading and keeps the page static.

import { createPlainSupabase } from "@/lib/supabase";
import { computeStatsWithOverrides } from "@/lib/recap-helpers";
import type { Athlete, MetricOverrides } from "@/lib/types";
import type { CampaignCard } from "@/components/CampaignCoverFlow";

// One rotator slide = a cover-flow card + description + the three hero stats.
// A stat of 0 means "unavailable" — the UI omits it rather than showing "0".
export type RotatorSlide = CampaignCard & {
  description: string | null;
  reach: number;
  engRate: number; // percentage, e.g. 4.2
  athleteCount: number;
};

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
  description: string | null;
  hero_recap_video_url: string | null;
  homepage_order: number | null;
  metric_overrides: MetricOverrides | null;
  // Supabase may hand the joined brand back as an object or a 1-item array.
  brands:
    | { logo_light_url: string | null; logo_primary_url: string | null }
    | { logo_light_url: string | null; logo_primary_url: string | null }[]
    | null;
};

export async function getHomepageRotatorCampaigns(): Promise<RotatorSlide[]> {
  const supabase = createPlainSupabase();

  // 1) The hand-picked homepage set, in the order I control.
  const { data, error } = await supabase
    .from("campaign_recaps")
    .select(
      "id,name,slug,client_name,client_logo_url,hero_image_url,thumbnail_url,brand_id,description,hero_recap_video_url,homepage_order,metric_overrides, brands ( logo_light_url, logo_primary_url )"
    )
    .eq("homepage_featured", true)
    .order("homepage_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("getHomepageRotatorCampaigns:", error?.message);
    return [];
  }

  const rows = data as unknown as Row[];

  // 2) For any campaign with no still set directly, borrow a hero image from
  //    its MEDIA (same fallback the cover flow uses). One batched query.
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
      .order("is_hero", { ascending: false })
      .order("hero_order", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true, nullsFirst: false });

    media?.forEach((m) => {
      if (!heroFromMedia.has(m.campaign_id)) {
        const img = m.thumbnail_url ?? m.file_url;
        if (img) heroFromMedia.set(m.campaign_id, img);
      }
    });
  }

  // 3) Stats (Phase 4A Option A): load ALL athletes for the rotator campaigns
  //    in ONE batched query, group by campaign, then run the same
  //    computeStatsWithOverrides() the recap uses. collabGroups is [] here —
  //    deriving them needs media too, and for a marketing hero the minor
  //    collab over-count is an acceptable trade for staying at one query.
  const ids = rows.map((r) => r.id);
  const statsByCampaign = new Map<
    string,
    { reach: number; engRate: number; athleteCount: number }
  >();

  if (ids.length) {
    const { data: athleteRows } = await supabase
      .from("athletes")
      .select("*")
      .in("campaign_id", ids);

    const byCampaign = new Map<string, Athlete[]>();
    for (const a of (athleteRows || []) as Athlete[]) {
      const list = byCampaign.get(a.campaign_id) || [];
      list.push(a);
      byCampaign.set(a.campaign_id, list);
    }

    for (const r of rows) {
      const list = byCampaign.get(r.id) || [];
      const stats = computeStatsWithOverrides(
        list,
        { metric_overrides: r.metric_overrides },
        []
      );
      statsByCampaign.set(r.id, {
        reach: stats.totalReach,
        engRate: stats.avgEngRate,
        athleteCount: stats.athleteCount,
      });
    }
  }

  // 4) Shape each slide. A campaign with no usable still is dropped so the
  //    rotator never shows a black tile (the poster is mandatory).
  const slides: RotatorSlide[] = [];
  for (const r of rows) {
    const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
    const hero =
      r.hero_image_url ?? r.thumbnail_url ?? heroFromMedia.get(r.id) ?? null;
    if (!hero) continue;

    const st =
      statsByCampaign.get(r.id) ?? { reach: 0, engRate: 0, athleteCount: 0 };

    slides.push({
      id: r.id,
      name: r.name ?? "",
      brand: r.client_name ?? "",
      slug: r.slug ?? r.id,
      hero,
      // Phase 2 fields: heroVideo is the hand-picked background clip (may be
      // null → poster-only slide); poster is the still shown until it plays.
      heroVideo: r.hero_recap_video_url ?? null,
      poster: hero,
      logoLight: brand?.logo_light_url ?? null,
      logoChip: brand?.logo_primary_url ?? r.client_logo_url ?? null,
      description: r.description ?? null,
      reach: st.reach,
      engRate: st.engRate,
      athleteCount: st.athleteCount,
    });
  }

  return slides;
}
