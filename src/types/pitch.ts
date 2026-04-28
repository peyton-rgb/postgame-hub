// ============================================================
// Pitch Page types
// ============================================================

// Ticker items can be plain text (string) or an image (logo).
// Backwards compatible: existing pitches with string[] still work.
export type TickerItem = string | TickerImageItem;

export interface TickerImageItem {
  logoUrl: string;
  alt: string;
}

export interface TickerSectionData {
  type: "ticker";
  visible: boolean;
  items: TickerItem[];
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
  // Optional section heading rendered above the hero image / per-athlete
  // layout. Renders as a centered uppercase label band (e.g. "POSTGAME
  // TALENT").
  heading?: string;
  // ---- Hero-image mode -------------------------------------------------
  // When `heroImageUrl` is set, the section renders that single image
  // full-width and skips the per-athlete layout entirely. Use this when
  // you've manually composed a collage in Photoshop / Figma / Canva and
  // want to drop it in as-is.
  heroImageUrl?: string;
  // Optional: per-athlete name plate positions overlaid on the hero
  // image. When present, plates float at the specified positions and
  // the credits strip is suppressed. When absent, the credits strip
  // renders below the image.
  heroPlates?: HeroPlatePosition[];
  // ---- Per-athlete layout mode (data-driven) --------------------------
  // The fields below only apply when `heroImageUrl` is NOT set.
  sport?: string;          // if set, prefer pitch_collage_athletes rows where sport matches
  fallbackToAll?: boolean; // when no sport-match rows, fall back to all active athletes (default true)
}

// Position config for a single floating plate overlaid on the hero
// image. `left` is required (horizontal anchor); `bottom` defaults to
// near the image's bottom edge if omitted. Both accept any CSS length
// (e.g. "10%", "12vw", "150px").
export interface HeroPlatePosition {
  athleteName: string; // must match pitch_collage_athletes.athlete_name
  left: string;
  bottom?: string;
  align?: "left" | "right" | "center";
}

export interface OpportunitiesSectionData {
  type: "opportunities";
  visible: boolean;
  heading?: string;        // defaults to "WHAT WE HAVE LINED UP"
}

// Sport-grouped roster of athletes Postgame has worked with.
// Each group is a sport heading (e.g. FOOTBALL) followed by a list of
// athlete names, optionally with a team callout in parens.
export interface TalentRosterAthlete {
  name: string;
  team?: string; // e.g. "Browns" — rendered in parens after the name
}

export interface TalentRosterGroup {
  sport: string;                  // e.g. "FOOTBALL"
  athletes: TalentRosterAthlete[];
}

export interface TalentRosterSectionData {
  type: "talentRoster";
  visible: boolean;
  heading?: string;               // e.g. "TALENT ROSTER"
  intro?: string;                 // optional one-line intro
  groups: TalentRosterGroup[];
}

export interface WhyYouSocialStat {
  label: string;            // e.g. "Followers", "Engagement", "30-day views"
  value: string;            // e.g. "250K", "8.4%", "12M"
}

export interface WhyYouUpcomingCampaign {
  title: string;            // brand or campaign name (e.g. "Crocs")
  subtitle?: string;        // short tagline (e.g. "Spring 2026 capsule")
  description?: string;     // optional longer description
}

export interface WhyYouSocialHandle {
  platform: "instagram" | "twitter" | "tiktok" | "youtube";
  handle: string;           // e.g. "toosii" (no leading @ — component adds it)
  url: string;              // e.g. "https://instagram.com/toosii"
  followers?: string;       // optional, e.g. "4.2M"
}

export interface WhyYouSectionData {
  type: "whyYou";
  visible: boolean;

  // Athlete identity
  athleteName: string;               // Legal name (e.g. "Nau'Jour Grainger")
  nickname?: string;                 // NEW — displayed as "Legal / Nickname"
  athleteSubtitle?: string;
  athletePhotoUrl?: string;
  schoolLogoUrl?: string;
  hometown?: string;                 // "Syracuse, NY"
  classYear?: string;                // "Senior"
  position?: string;                 // "Wide Receiver"

  // Body copy. `paragraphs` (multi-paragraph) is preferred; `paragraph`
  // (single) is kept for backwards compatibility with existing pitches.
  paragraph?: string;
  paragraphs?: string[];

  // Stats and breakdown
  socialStats?: WhyYouSocialStat[];
  socialHandles?: WhyYouSocialHandle[]; // NEW — Instagram / X / TikTok with @handle and url
  highlights?: string[];                // NEW — bullet-point achievements / recent moments
  quote?: string;                       // NEW — pull-quote from the athlete

  upcomingCampaigns?: WhyYouUpcomingCampaign[];
  tinted?: boolean;                  // adds the slight orange wash bg (default true)
}

// Tabbed variant of the Capabilities section.
// Same data shape as CapabilitiesSectionData but rendered as an
// interactive tabs panel (one item visible at a time).
export interface TabbedCapabilitiesSectionData {
  type: "tabbedCapabilities";
  visible: boolean;
  heading: string;
  description: string;
  items: CapabilityItem[];
}

// ------------------------------------------------------------
// Agency comparison sheet — recreates the "More Than An Agency"
// printed value-prop page as a real HTML section.
// ------------------------------------------------------------
export interface AgencyComparisonRow {
  criterion: string;       // e.g. "Marketing Deals"
  postgame: string;        // e.g. "0% commission"   (cell value or check marks)
  otherAgency: string;     // e.g. "10% – 25% commission"
  doItYourself: string;    // e.g. "???"
}

export interface AgencyComparisonBenefit {
  title: string;
  description?: string;
}

export interface AgencyComparisonSectionData {
  type: "agencyComparison";
  visible: boolean;
  heading: string;          // e.g. "More than an agency"
  subheading?: string;      // e.g. "Your NIL partner"
  tableLabel?: string;      // e.g. "Agency Comparison"
  rows: AgencyComparisonRow[];
  benefitsLabel?: string;   // e.g. "Benefits Overview:"
  benefitsIntro?: string;   // small intro line above the bullets
  benefits: AgencyComparisonBenefit[];
}

// ------------------------------------------------------------
// Earnings comparison sheet — three side-by-side scenario tables
// showing the financial difference between Postgame, 'Other' Agency,
// and DIY representation.
// ------------------------------------------------------------
export interface EarningsScenarioRow {
  item: string;            // e.g. "Player Contract"
  income: string;          // e.g. "$200,000 x 0% (commission)"
  playerEarns: string;     // e.g. "$200,000"
}

export interface EarningsScenario {
  title: string;           // e.g. "Postgame Representation"
  emphasized?: boolean;    // when true, this scenario gets the orange highlight
  rows: EarningsScenarioRow[];
  totalLabel: string;      // e.g. "Total Earned with Postgame"
  totalValue: string;      // e.g. "$226,000+"
  totalNote?: string;      // optional sub-line, e.g. "+ $10,000 brand-building value"
}

export interface EarningsComparisonSectionData {
  type: "earningsComparison";
  visible: boolean;
  heading?: string;        // e.g. "Example Scenario"
  intro?: string;
  scenarios: EarningsScenario[];
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
  | WhyYouSectionData
  | TalentRosterSectionData
  | TabbedCapabilitiesSectionData
  | AgencyComparisonSectionData
  | EarningsComparisonSectionData;

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
  talentRoster: "Talent Roster",
  tabbedCapabilities: "Capabilities (Tabbed)",
  agencyComparison: "Agency Comparison",
  earningsComparison: "Earnings Comparison",
};
