// The recap builder. New route, alongside /dashboard/[id] — the old editor and
// its `settings` writes are untouched, and the two coexist.
import { createPlainSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { HeroBuilder } from "@/components/recap-builder/HeroBuilder";
import type { PickableMedia } from "@/components/recap-builder/MediaPicker";
import { validateRecapConfig } from "@/lib/recap-v2/config";
import type { Media } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const { data: media } = await supabase
    .from("media")
    .select("*")
    .eq("campaign_id", id)
    .order("sort_order");

  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, name")
    .eq("campaign_id", id);
  const athleteName = new Map((athletes || []).map((a: { id: string; name: string }) => [a.id, a.name]));

  // Photos only. A video's thumbnail is a real still and could serve, but the
  // hero is a still frame and offering 29 video rows among 73 photos is how the
  // old selection got noisy.
  const items: PickableMedia[] = (media || [])
    .filter((m: Media) => !m.is_video_thumbnail && m.type === "image" && !!m.file_url)
    .map((m: Media) => ({
      id: m.id,
      url: m.file_url,
      athleteName: m.athlete_id ? athleteName.get(m.athlete_id) ?? null : null,
      isVideo: false,
    }));

  const { config } = validateRecapConfig(campaign.recap_config);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-neutral-100">
      <header className="mb-8 border-b border-neutral-800 pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-orange-500">
          Recap builder
        </p>
        <h1 className="mt-1 text-3xl font-bold">{campaign.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {campaign.client_name} · {items.length} photos ·{" "}
          <a
            className="underline"
            href={`/recap/${campaign.slug}?v2=1`}
            target="_blank"
            rel="noopener noreferrer"
          >
            open the recap
          </a>
        </p>
      </header>
      <HeroBuilder
        campaignId={id}
        items={items}
        initialSelected={config.hero?.media_ids ?? []}
        initialFocal={config.hero?.focal ?? {}}
        campaignTitle={config.display_name ?? campaign.name}
        clientName={campaign.client_name ?? null}
      />
    </main>
  );
}
