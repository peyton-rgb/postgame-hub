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

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  /** Google Drive parent folder for campaign media imports (recap rows). */
  drive_folder_id?: string | null;
  client_name: string;
  client_logo_url: string | null;
  brand_id: string | null;
  created_at: string;
  published: boolean;
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
    brand_logo_url?: string;
    key_takeaways?: string;
    kpi_targets?: KpiTargets;
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
    engagement_rate?: number;
  };
  ig_story?: {
    count?: number;
    impressions?: number;
  };
  ig_reel?: {
    post_url?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reposts?: number;
    total_engagements?: number;
    engagement_rate?: number;
  };
  tiktok?: {
    post_url?: string;
    views?: number;
    likes?: number;
    comments?: number;
    likes_comments?: number;
    saves_shares?: number;
    total_engagements?: number;
    engagement_rate?: number;
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
  athlete_id: string;
  campaign_id: string;
  type: "image" | "video";
  file_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  is_video_thumbnail: boolean;
  drive_file_id?: string | null;
  created_at: string;
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
