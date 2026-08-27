// The recap builder. New route alongside /dashboard/[id] — the old editor and
// its `settings` writes are untouched, and the two coexist.
import { createPlainSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { RecapBuilder, type BuilderAthlete } from "@/components/recap-builder/RecapBuilder";
import type { PickableMedia } from "@/components/recap-builder/MediaPicker";
import { validateRecapConfig } from "@/lib/recap-v2/config";
import { hasRichText, type SectionId } from "@/lib/recap-v2/guards";
import { stillFor } from "@/lib/recap-v2/hero";
import { engagementRateByImpressions } from "@/lib/recap-helpers";
import type { Athlete, Media } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Total engagements across an athlete's slots — the default performer order. */
function engagementsOf(a: Athlete): number {
  const m = (a.metrics || {}) as Record<string, { total_engagements?: number } | undefined>;
  return ["ig_feed", "ig_feed_2", "ig_reel", "ig_reel_2", "tiktok", "tiktok_2"].reduce(
    (sum, k) => sum + (m[k]?.total_engagements ?? 0),
    0,
  );
}

export default async function RecapBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPlainSupabase();

  const { data: campaign } = await supabase
    .from("campaign_recaps")
    .select("*")
    .eq("id", id)
    .single();
  if (!campaign) notFound();

  const [{ data: media }, { data: athleteRows }] = await Promise.all([
    supabase.from("media").select("*").eq("campaign_id", id).order("sort_order"),
    supabase.from("athletes").select("*").eq("campaign_id", id).order("sort_order"),
  ]);

  const athleteName = new Map((athleteRows || []).map((a: Athlete) => [a.id, a.name]));
  const nameFor = (m: Media) => (m.athlete_id ? athleteName.get(m.athlete_id) ?? null : null);

  // Hero: photos only — the hero is a still frame, and offering the videos
  // among them is how the old selection got noisy.
  const heroItems: PickableMedia[] = (media || [])
    .filter((m: Media) => !m.is_video_thumbnail && m.type === "image" && !!m.file_url)
    .map((m: Media) => ({ id: m.id, url: m.file_url, athleteName: nameFor(m), isVideo: false }));

  // Gallery: everything with a usable still, videos included via their thumbnail.
  const galleryItems: PickableMedia[] = (media || []).flatMap((m: Media) => {
    if (m.is_video_thumbnail) return [];
    const url = stillFor(m);
    if (!url) return [];
    return [{ id: m.id, url, athleteName: nameFor(m), isVideo: m.type === "video" }];
  });

  const athletes: BuilderAthlete[] = (athleteRows || [])
    .map((a: Athlete) => ({
      id: a.id,
      name: a.name,
      school: a.school || null,
      engagements: engagementsOf(a),
    }))
    .sort((x: BuilderAthlete, y: BuilderAthlete) => y.engagements - x.engagements);

  // What the data can support, so the Sections list can mark the rest. This
  // mirrors the guards rather than restating them: a section with nothing in it
  // stays out whatever the config says.
  const anyMetrics = (athleteRows || []).some(
    (a: Athlete) =>
      engagementRateByImpressions(a.metrics?.ig_feed, "impressions") > 0 ||
      engagementRateByImpressions(a.metrics?.ig_reel, "views") > 0 ||
      engagementRateByImpressions(a.metrics?.tiktok, "views") > 0 ||
      engagementsOf(a) > 0,
  );
  const availableSections: SectionId[] = [
    ...(hasRichText(campaign.settings?.description) ? (["overview"] as SectionId[]) : []),
    ...(hasRichText(campaign.settings?.key_takeaways) ? (["take"] as SectionId[]) : []),
    ...(anyMetrics ? (["numbers", "perf"] as SectionId[]) : []),
    ...(galleryItems.length > 0 ? (["bic"] as SectionId[]) : []),
    ...((athleteRows || []).length > 0 ? (["roster"] as SectionId[]) : []),
  ];

  const { config } = validateRecapConfig(campaign.recap_config);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-gray-100 sm:px-8">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-[#D73F09]">Recap builder</p>
        <h1 className="mt-1 text-3xl font-black uppercase tracking-wide">{campaign.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {campaign.client_name} · {athletes.length} athletes · {galleryItems.length} assets
        </p>
      </header>

      <RecapBuilder
        campaignId={id}
        slug={campaign.slug}
        initialConfig={config}
        heroItems={heroItems}
        galleryItems={galleryItems}
        athletes={athletes}
        availableSections={availableSections}
        derived={{
          title: campaign.name,
          brand: campaign.client_name ?? "",
          lede: ["Campaign recap", campaign.settings?.campaign_type]
            .filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0)
            .join(" — "),
        }}
        hasLegacyTakeaways={hasRichText(campaign.settings?.key_takeaways)}
      />
    </main>
  );
}
