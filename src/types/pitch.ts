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

export type PitchSectionData =
  | TickerSectionData
  | HeroSectionData
  | ThesisSectionData
  | RosterSectionData
  | PullQuoteSectionData
  | CapabilitiesSectionData
  | IdeasSectionData
  | CtaSectionData;

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
};
