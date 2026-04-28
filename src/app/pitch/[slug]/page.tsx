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
import TalentRosterSection from "@/components/pitch/TalentRosterSection";
import TabbedCapabilitiesSection from "@/components/pitch/TabbedCapabilitiesSection";
import AgencyComparisonSection from "@/components/pitch/AgencyComparisonSection";
import EarningsComparisonSection from "@/components/pitch/EarningsComparisonSection";
import "@/styles/pitch.css";

export const dynamic = "force-dynamic";
// `force-dynamic` opts out of static page caching, but Next.js still
// has a separate fetch-level Data Cache that caches individual HTTP
// responses by URL. Supabase REST calls go through that cache. Queries
// where the URL+params are stable across requests (like the collage
// athletes query, which has no per-pitch parameter) would otherwise
// serve stale results forever once the first response is cached.
// `force-no-store` disables the fetch cache for everything on this page.
export const fetchCache = "force-no-store";

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
  talentRoster: TalentRosterSection,
  tabbedCapabilities: TabbedCapabilitiesSection,
  agencyComparison: AgencyComparisonSection,
  earningsComparison: EarningsComparisonSection,
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

  // Section sourcing — supports two shapes:
  //
  //  1. Legacy: `content.sections` is a full array. Each pitch carries
  //     its own complete sections list. Render directly.
  //
  //  2. Template-based: `content.templateName` references a master
  //     template in pitch_templates; `content.whyYou` (and optionally
  //     `content.athleteName` / `content.ctaHeading`) override
  //     athlete-specific bits. The template provides the rest.
  //
  // We fall back to legacy if `content.sections` exists.
  const contentObj = (pitch.content ?? {}) as Record<string, any>;
  let sections: PitchSectionData[] = [];

  if (Array.isArray(contentObj.sections)) {
    // Legacy shape — render directly
    sections = contentObj.sections as PitchSectionData[];
  } else {
    // Template-based shape — load template, merge overrides
    const templateName: string = contentObj.templateName ?? "default";
    const { data: tmpl } = await supabase
      .from("pitch_templates")
      .select("sections")
      .eq("name", templateName)
      .single();
    const tmplSections = (tmpl?.sections as PitchSectionData[]) ?? [];
    sections = [...tmplSections];

    // Override the whyYou (player profile) with this pitch's data
    if (contentObj.whyYou) {
      const idx = sections.findIndex((s) => s.type === "whyYou");
      if (idx >= 0) sections[idx] = contentObj.whyYou as PitchSectionData;
    }

    // Override the CTA heading + footer-meta with the athlete name
    const athleteName: string | undefined = contentObj.athleteName;
    if (athleteName) {
      const firstName: string =
        contentObj.athleteFirstName ?? athleteName.split(/\s+/)[0];
      const ctaIdx = sections.findIndex((s) => s.type === "cta");
      if (ctaIdx >= 0) {
        const existing = sections[ctaIdx] as Record<string, any>;
        sections[ctaIdx] = {
          ...existing,
          heading:
            contentObj.ctaHeading ??
            `Welcome to Postgame, <em>${firstName}</em>.`,
          footerMeta: `Built for ${athleteName}`,
        } as PitchSectionData;
      }
    }
  }

  // Enrich whyYou.upcomingCampaigns with brand logos from the brands
  // table. Looks up each campaign title in brands.name and attaches
  // logo_light_url (preferred for dark backgrounds), falling back
  // through logo_dark_url and logo_url.
  const whyYouIdx = sections.findIndex((s) => s.type === "whyYou");
  if (whyYouIdx >= 0) {
    const why = sections[whyYouIdx] as Record<string, any>;
    if (
      Array.isArray(why.upcomingCampaigns) &&
      why.upcomingCampaigns.length > 0
    ) {
      const titles = why.upcomingCampaigns.map((c: any) => c.title);
      const { data: brandRows } = await supabase
        .from("brands")
        .select("name, logo_light_url, logo_dark_url, logo_url")
        .in("name", titles);
      const logoMap = new Map<string, string>();
      for (const b of brandRows ?? []) {
        const url =
          (b as any).logo_light_url ??
          (b as any).logo_dark_url ??
          (b as any).logo_url;
        if (url) logoMap.set((b as any).name, url);
      }
      sections[whyYouIdx] = {
        ...why,
        upcomingCampaigns: why.upcomingCampaigns.map((c: any) => ({
          ...c,
          logoUrl: c.logoUrl ?? logoMap.get(c.title),
        })),
      } as PitchSectionData;
    }
  }

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

      {/* Pitch page header — replaces the global SiteNav (hidden on /pitch).
          Left-aligned Postgame logo on solid black. .wrap aligns it with
          the same content gutter the other sections use. */}
      <header className="pitch-header">
        <div className="wrap">
          <img
            className="pitch-header__logo"
            src="/postgame-logo-white.png"
            alt="Postgame"
          />
        </div>
      </header>

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
            // Observe both:
            //  (1) every internal element flagged with .fade
            //  (2) every top-level <section> (skip the first — it's
            //      visible on initial paint) and any top-level <footer>
            var nodes = document.querySelectorAll(
              '.pitch-page > section:not(:first-of-type), ' +
              '.pitch-page > footer, ' +
              '.pitch-page .fade'
            );
            nodes.forEach(function(el){io.observe(el);});
          })();
        `,
      }}
    />
  );
}
