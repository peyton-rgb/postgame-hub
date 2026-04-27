// ============================================================
// Pitch Page types
// ============================================================

export interface TickerSectionData {
  type: "ticker";
  visible: boolean;
  items: string[];
}

export interface HeroSectionData {
  type: "hero";
  visible: boolean;
  topLeft: string;
  topRight: string;
  title: string;        // supports <em> for orange highlight
  stamp: string;
  lede: string;
  deckParagraphs: string[];
  stats: { value: string; label: string }[];
  navBrand: string;     // e.g. "POSTGAME × CROCS"
  navMeta: { label: string; value: string }[];
}

export interface ThesisSectionData {
  type: "thesis";
  visible: boolean;
  sectionLabel: string;
  heading: string;
  paragraphs: string[];
  pillars: { label: string; text: string }[];
  bgWord: string;       // large watermark word behind section
}

export interface RosterAthlete {
  number: string;
  tag: string;
  tagStyle: "default" | "live" | "poy";
  name: string;
  role: string;
  moment: string;
  date: string;
  photoUrl: string;
  size: "feature" | "wide" | "std";
}

export interface RosterSectionData {
  type: "roster";
  visible: boolean;
  heading: string;
  metaLabel: string;
  metaDetail: string;
  athletes: RosterAthlete[];
}

export interface PullQuoteSectionData {
  type: "pullQuote";
  visible: boolean;
  quote: string;
  cite: string;
}

export interface CapabilityItem {
  index: string;
  title: string;
  description: string;
}

export interface CapabilitiesSectionData {
  type: "capabilities";
  visible: boolean;
  heading: string;
  description: string;
  items: CapabilityItem[];
}

export interface IdeaItem {
  number: string;
  name: string;
  description: string;
  channelLabel: string;
  channelValue: string;
}

export interface IdeasSectionData {
  type: "ideas";
  visible: boolean;
  sectionTag: string;
  heading: string;
  description: string;
  ideas: IdeaItem[];
}

export interface CtaSectionData {
  type: "cta";
  visible: boolean;
  kicker: string;
  heading: string;
  buttonText: string;
  buttonHref: string;
  footerBrand: string;
  footerMeta: string;
}

// ------------------------------------------------------------
// Sections that read live data from Supabase tables.
// The page-level fetch in src/app/pitch/[slug]/page.tsx populates
// the rows; the section components are still pure display.
// ------------------------------------------------------------

export interface CollageSectionData {
  type: "collage";
  visible: boolean;
  sport?: string;          // if set, prefer pitch_collage_athletes rows where sport matches
  fallbackToAll?: boolean; // when no sport-match rows, fall back to all active athletes (default true)
}

export interface OpportunitiesSectionData {
  type: "opportunities";
  visible: boolean;
  heading?: string;        // defaults to "WHAT WE HAVE LINED UP"
}

export interface WhyYouSectionData {
  type: "whyYou";
  visible: boolean;
  athleteName: string;
  athleteSubtitle?: string;
  athletePhotoUrl?: string;
  paragraph: string;       // the "why you" body copy
  tinted?: boolean;        // adds the slight orange wash background (default true)
}

// Row shapes returned by the page-level fetches. Components use these
// for their fetched-data props.
export interface PitchCollageAthleteRow {
  id: string;
  athlete_name: string;
  brand_name: string;
  sport: string;
  cutout_image_url: string | null;
  display_order: number | null;
  is_active: boolean | null;
}

export interface PitchOpportunityRow {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  is_archived: boolean | null;
  display_order: number | null; // copied off pitch_page_opportunities for sorting
}

export type PitchSectionData =
  | TickerSectionData
  | HeroSectionData
  | ThesisSectionData
  | RosterSectionData
  | PullQuoteSectionData
  | CapabilitiesSectionData
  | IdeasSectionData
  | CtaSectionData
  | CollageSectionData
  | OpportunitiesSectionData
  | WhyYouSectionData;

export interface PitchPageContent {
  sections: PitchSectionData[];
}

export interface PitchPage {
  id: string;
  slug: string;
  brand_id: string | null;
  title: string | null;
  status: "draft" | "published";
  content: PitchPageContent;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export const SECTION_TYPE_LABELS: Record<PitchSectionData["type"], string> = {
  ticker: "Ticker",
  hero: "Hero",
  thesis: "Thesis",
  roster: "Roster",
  pullQuote: "Pull Quote",
  capabilities: "Capabilities",
  ideas: "Ideas",
  cta: "CTA",
  collage: "Collage",
  opportunities: "Opportunities",
  whyYou: "Why You",
};
