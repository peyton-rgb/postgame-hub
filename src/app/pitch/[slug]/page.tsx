import { createPlainSupabase, createServiceSupabase } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import type {
  CollageSectionData,
  PitchCollageAthleteRow,
  PitchOpportunityRow,
  PitchPage,
  PitchSectionData,
} from "@/types/pitch";
import TickerSection from "@/components/pitch/TickerSection";
import HeroSection from "@/components/pitch/HeroSection";
import ThesisSection from "@/components/pitch/ThesisSection";
import RosterSection from "@/components/pitch/RosterSection";
import PullQuoteSection from "@/components/pitch/PullQuoteSection";
import CapabilitiesSection from "@/components/pitch/CapabilitiesSection";
import IdeasSection from "@/components/pitch/IdeasSection";
import CtaSection from "@/components/pitch/CtaSection";
import CollageSection from "@/components/pitch/CollageSection";
import OpportunitiesSection from "@/components/pitch/OpportunitiesSection";
import WhyYouSection from "@/components/pitch/WhyYouSection";
import "@/styles/pitch.css";

export const dynamic = "force-dynamic";

// Sections that render purely from their `data` prop (no DB lookups).
// `collage` and `opportunities` are special-cased in the render below
// because they need extra props beyond `data`, so they intentionally
// are NOT in this map.
const SECTION_MAP: Partial<
  Record<PitchSectionData["type"], React.ComponentType<{ data: any }>>
> = {
  ticker: TickerSection,
  hero: HeroSection,
  thesis: ThesisSection,
  roster: RosterSection,
  pullQuote: PullQuoteSection,
  capabilities: CapabilitiesSection,
  ideas: IdeasSection,
  cta: CtaSection,
  whyYou: WhyYouSection,
};

export default async function PitchPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;

  // preview=1 uses service client (bypasses RLS) so draft pitches render in the editor iframe
  const isPreview = preview === "1";
  const supabase = isPreview ? createServiceSupabase() : createPlainSupabase();

  const { data } = await supabase
    .from("pitch_pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!data) return notFound();

  if (data.content?.external_url) {
    redirect(data.content.external_url);
  }

  const pitch = data as PitchPage;
  const sections: PitchSectionData[] = pitch.content?.sections ?? [];

  // Some section types (collage, opportunities) read from auxiliary
  // tables. We only fetch when the pitch actually uses those sections,
  // and we run both fetches in parallel to keep the page snappy.
  const collageSection = sections.find(
    (s): s is CollageSectionData => s.type === "collage" && s.visible !== false,
  );
  const wantsOpportunities = sections.some(
    (s) => s.type === "opportunities" && s.visible !== false,
  );

  const [collageAthletes, opportunities] = await Promise.all([
    collageSection ? fetchCollageAthletes(supabase, collageSection) : Promise.resolve([] as PitchCollageAthleteRow[]),
    wantsOpportunities ? fetchOpportunities(supabase, pitch.id) : Promise.resolve([] as PitchOpportunityRow[]),
  ]);

  return (
    <div className="pitch-page">
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap"
        rel="stylesheet"
      />

      {sections.map((section, i) => {
        const key = `${section.type}-${i}`;

        // Sections that need fetched data live outside SECTION_MAP.
        if (section.type === "collage") {
          return (
            <CollageSection
              key={key}
              data={section}
              athletes={collageAthletes}
            />
          );
        }
        if (section.type === "opportunities") {
          return (
            <OpportunitiesSection
              key={key}
              data={section}
              opportunities={opportunities}
            />
          );
        }

        const Component = SECTION_MAP[section.type];
        if (!Component) return null;
        return <Component key={key} data={section} />;
      })}

      <FadeScript />
    </div>
  );
}

// ------------------------------------------------------------
// Auxiliary fetches.
//
// Both helpers accept the page-level supabase client (which may be
// either the plain anon client or the service-role client when
// preview=1) so RLS behavior matches the parent page's behavior.
// ------------------------------------------------------------

type AnySupabase = ReturnType<typeof createPlainSupabase> | ReturnType<typeof createServiceSupabase>;

async function fetchCollageAthletes(
  supabase: AnySupabase,
  section: CollageSectionData,
): Promise<PitchCollageAthleteRow[]> {
  const fallbackToAll = section.fallbackToAll !== false;

  // Step 1: if the section requested a sport, try a sport-filtered query.
  if (section.sport) {
    const { data: matched, error } = await supabase
      .from("pitch_collage_athletes")
      .select(
        "id, athlete_name, brand_name, sport, cutout_image_url, display_order, is_active",
      )
      .eq("is_active", true)
      .eq("sport", section.sport)
      .order("display_order", { ascending: true, nullsFirst: false });

    if (!error && matched && matched.length > 0) {
      return matched as PitchCollageAthleteRow[];
    }
    if (!fallbackToAll) return [];
  }

  // Step 2: fall back to all active athletes.
  const { data } = await supabase
    .from("pitch_collage_athletes")
    .select(
      "id, athlete_name, brand_name, sport, cutout_image_url, display_order, is_active",
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true, nullsFirst: false });

  return (data ?? []) as PitchCollageAthleteRow[];
}

async function fetchOpportunities(
  supabase: AnySupabase,
  pitchPageId: string,
): Promise<PitchOpportunityRow[]> {
  // Junction-side fetch so we get the per-pitch display_order alongside
  // the joined opportunity row.
  const { data } = await supabase
    .from("pitch_page_opportunities")
    .select(
      `
        display_order,
        opportunity:pitch_opportunities (
          id,
          title,
          subtitle,
          description,
          is_archived
        )
      `,
    )
    .eq("pitch_page_id", pitchPageId)
    .order("display_order", { ascending: true, nullsFirst: false });

  if (!data) return [];

  return data
    .map((row: any) => {
      const opp = row?.opportunity;
      if (!opp) return null;
      if (opp.is_archived === true) return null;
      const result: PitchOpportunityRow = {
        id: opp.id,
        title: opp.title,
        subtitle: opp.subtitle ?? null,
        description: opp.description ?? null,
        is_archived: opp.is_archived ?? null,
        display_order: row.display_order ?? null,
      };
      return result;
    })
    .filter((r): r is PitchOpportunityRow => r !== null);
}

function FadeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function(){
            var io = new IntersectionObserver(function(entries){
              entries.forEach(function(e){
                if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}
              });
            },{threshold:0.12,rootMargin:'0px 0px -60px 0px'});
            document.querySelectorAll('.pitch-page .fade').forEach(function(el){io.observe(el);});
          })();
        `,
      }}
    />
  );
}
