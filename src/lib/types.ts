export interface VisibleSections {
  brief?: boolean;
  key_takeaways?: boolean;
  kpi_targets?: boolean;
  metrics?: boolean;
  platform_breakdown?: boolean;
  top_performers?: boolean;
  content_gallery?: boolean;
  roster?: boolean;
  clicks?: boolean;
  sales?: boolean;
}

export interface KpiTargets {
  athlete_quantity?: number;
  content_units?: number;
  posts?: number;
  impressions?: number;
  engagements?: number;
  engagement_rate?: number;
  cpm?: number;
  other_kpis?: string;
}

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  website: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  admin_brand_id: string | null;
}

export interface BrandKit extends Brand {
  logo_primary_url: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  logo_mark_url: string | null;
  font_primary: string | null;
  font_secondary: string | null;
  font_primary_url: string | null;
  font_secondary_url: string | null;
  brand_guidelines_url: string | null;
  brand_colors: { hex: string; name: string }[];
  kit_notes: string | null;
}

export interface BrandAsset {
  id: string;
  brand_id: string;
  type: 'logo' | 'font' | 'guideline' | 'other';
  variant: string | null;
  label: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

// NEW: Hero metric override keys. These match the field names returned by
// computeStats() in recap-helpers.ts. When a key is present with a number,
// the recap displays that hand-typed value instead of the calculated one
// (and shows an "edited" badge).
export type HeroMetricOverrideKey =
  | "athlete_count"
  | "school_count"
  | "sport_count"
  | "total_posts"
  | "combined_followers"
  | "total_impressions"
  | "total_engagements"
  | "ig_avg_engagement_rate"
  | "tiktok_avg_engagement_rate";

export type MetricOverrides = Partial<Record<HeroMetricOverrideKey, number | null>>;

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  /** Google Drive parent folder for campaign media imports (recap rows). */
  drive_folder_id?: string | null;
  client_name: string;
  client_logo_url: string | null;
  admin_campaign_id: string | null;
  brand_id: string | null;
  created_at: string;
  published: boolean;
  // NEW: Hand-typed Hero metric overrides. Empty object {} means no overrides.
  // Stored in the metric_overrides jsonb column on campaign_recaps.
  metric_overrides?: MetricOverrides;
  settings: {
    primary_color?: string;
    secondary_color?: string;
    layout?: "masonry" | "grid";
    columns?: number;
    description?: string;
    quarter?: string;
    campaign_type?: string;
    platform?: string;
    tags?: string[];
    visible_sections?: VisibleSections;
    hidden_columns?: string[];
    hidden_platform_cards?: string[];
    hidden_heroes?: HeroMetricOverrideKey[];
    brand_logo_url?: string;
    key_takeaways?: string;
    kpi_targets?: KpiTargets;
    budget?: number;
    total_impressions?: number;
  };
}

export interface AthleteMetrics {
  ig_feed?: {
    post_url?: string;
    reach?: number;
    impressions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reposts?: number;
    total_engagements?: number;
    engagement_rate?: number; // LEGACY: single-rate field, kept for old campaigns
    // NEW: separate rates from the 2026 Performance Tracker template
    engagement_rate_followers?: number;
    engagement_rate_impressions?: number;
  };
  ig_story?: {
    count?: number;
    impressions?: number;       // per-story impressions (LEGACY/per-post)
    total_impressions?: number; // explicit total across all stories (preferred when present)
  };
  ig_reel?: {
    post_url?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reposts?: number;
    total_engagements?: number;
    engagement_rate?: number; // LEGACY
    // NEW
    engagement_rate_followers?: number;
    engagement_rate_impressions?: number;
  };
  tiktok?: {
    post_url?: string;
    views?: number;
    likes?: number;
    comments?: number;
    likes_comments?: number; // LEGACY
    saves_shares?: number;   // LEGACY
    total_engagements?: number;
    engagement_rate?: number; // LEGACY
    // NEW: 2026 spreadsheet has these as separate columns
    followers?: number;
    saves?: number;
    engagement_rate_followers?: number;
    engagement_rate_impressions?: number;
  };
  clicks?: {
    link_clicks?: number;
    click_through_rate?: number;
    landing_page_views?: number;
    cost_per_click?: number;
    orders?: number;
    sales?: number;
    cpm?: number;
  };
  sales?: {
    conversions?: number;
    revenue?: number;
    conversion_rate?: number;
    cost_per_acquisition?: number;
    roas?: number;
  };
  targets?: {
    athlete_target?: number;
    content_unit_target?: number;
    post_target?: number;
    cost_per_post?: number;
    cost_per_athlete?: number;
  };
  campaign_tag?: string;
  headshot_url?: string;
  content_folder_url?: string;
}

export interface Athlete {
  id: string;
  campaign_id: string;
  name: string;
  school: string;
  sport: string;
  post_type: "IG Feed" | "IG Reel" | "TikTok";
  post_url: string | null;
  sort_order: number;
  created_at: string;
  ig_handle?: string;
  ig_followers?: number;
  gender?: string;
  content_rating?: string;
  reach_level?: string;
  notes?: string;
  metrics?: AthleteMetrics;
}

export interface Media {
  id: string;
  athlete_id: string | null;
  campaign_id: string;
  type: "image" | "video";
  file_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  is_video_thumbnail: boolean;
  drive_file_id?: string | null;
  created_at: string;
}

/**
 * A post URL that appears on two or more athlete rows — i.e. a collab post.
 * Detected at parse-time from the metrics CSV (and rederivable at render-time
 * from athletes already in the DB). Used to (a) avoid double-counting
 * collab metrics across all participants and (b) render collab treatment in
 * the recap UI (stacked names, COLLAB badge, combined ER).
 *
 * `athleteIds` carries whatever stable identifier the caller has — DB id
 * (Athlete.id) at render-time, athlete name at parse-time (ParsedAthlete has
 * no id yet). `athleteNames` is always populated so name-based UI works
 * regardless of which identifier `athleteIds` holds.
 */
export interface CollabGroup {
  id: string;
  url: string;
  platform: "ig_feed" | "ig_reel" | "tiktok";
  athleteIds: string[];
  athleteNames: string[];
  combinedFollowers: number;
  metrics: {
    views?: number;
    impressions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reposts?: number;
    totalEngagements?: number;
    engagementRateFol?: number;
    engagementRateImp?: number;
  };
  combinedEngagementRate: number;
}

// Run of Show Types

export interface RosContact {
  name: string;
  phone: string;
  initials?: string;
}

export interface RosShotSection {
  category: string;
  shots: string[];
}

export interface RosTimelineItem {
  time: string;
  title: string;
  description: string;
  highlight?: boolean;
}

export interface RunOfShow {
  id: string;
  name: string;
  slug: string;
  client_name: string;
  client_logo_url: string | null;
  event_name: string | null;
  subtitle: string | null;
  camera_settings: string;
  contacts: RosContact[];
  published: boolean;
  created_at: string;
  updated_at: string;
}

// Brief Types

export interface Brief {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  html_content: string;
  published: boolean;
  external_url: string | null;
  created_at: string;
  updated_at: string;
}

// Deal Tracker Types

export interface Deal {
  id: string;
  brand_name: string;
  brand_logo_url: string | null;
  athlete_name: string | null;
  athlete_school: string | null;
  athlete_sport: string | null;
  deal_type: string | null;
  tier: "tier_1" | "tier_2" | "tier_3";
  value: string | null;
  description: string | null;
  image_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  date_announced: string | null;
  created_at: string;
  updated_at: string;
}

export interface PressArticle {
  id: string;
  title: string;
  slug: string;
  publication: string | null;
  author: string | null;
  excerpt: string | null;
  content: string | null;
  external_url: string | null;
  image_url: string | null;
  category: string | null;
  featured: boolean;
  published: boolean;
  published_date: string | null;
    brand_logo_url: string | null;
    logo_position: "bottom-left" | "bottom-right";
  sort_order: number;
  archived: boolean;
  show_logo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  brand_name: string;
  brand_logo_url: string | null;
  category: string | null;
  hero_stat: string | null;
  hero_stat_label: string | null;
  overview: string | null;
  challenge: string | null;
  solution: string | null;
  results: string | null;
  metrics: Record<string, unknown>;
  highlights: string[];
  image_url: string | null;
  featured: boolean;
  published: boolean;
  published_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Shoot Types

export interface RosShoot {
  id: string;
  run_of_show_id: string;
  slug: string;
  event_name: string;
  city: string;
  state: string;
  date: string;
  event_start_time: string;
  arrival_time: string;
  athlete: string | null;
  videographer: string;
  videographer_phone: string | null;
  starting_address: string | null;
  website: string | null;
  shoot_type: string;
  type_label: string | null;
  content_folder_url: string | null;
  client_contact_name: string | null;
  client_contact_phone: string | null;
  shot_list: RosShotSection[];
  timeline: RosTimelineItem[];
  sort_order: number;
  created_at: string;
}
