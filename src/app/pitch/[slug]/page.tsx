import { createPlainSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { PitchPage, PitchSectionData } from "@/types/pitch";
import TickerSection from "@/components/pitch/TickerSection";
import HeroSection from "@/components/pitch/HeroSection";
import ThesisSection from "@/components/pitch/ThesisSection";
import RosterSection from "@/components/pitch/RosterSection";
import PullQuoteSection from "@/components/pitch/PullQuoteSection";
import CapabilitiesSection from "@/components/pitch/CapabilitiesSection";
import IdeasSection from "@/components/pitch/IdeasSection";
import CtaSection from "@/components/pitch/CtaSection";
import "@/styles/pitch.css";

export const dynamic = "force-dynamic";

const SECTION_MAP: Record<
  PitchSectionData["type"],
  React.ComponentType<{ data: any }>
> = {
  ticker: TickerSection,
  hero: HeroSection,
  thesis: ThesisSection,
  roster: RosterSection,
  pullQuote: PullQuoteSection,
  capabilities: CapabilitiesSection,
  ideas: IdeasSection,
  cta: CtaSection,
};

export default async function PitchPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPlainSupabase();

  const { data } = await supabase
    .from("pitch_pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!data) return notFound();

  const pitch = data as PitchPage;
  const sections: PitchSectionData[] = pitch.content?.sections ?? [];

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
        const Component = SECTION_MAP[section.type];
        if (!Component) return null;
        return <Component key={`${section.type}-${i}`} data={section} />;
      })}

      <FadeScript />
    </div>
  );
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
