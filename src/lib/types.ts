export interface VisibleSections {
  brief?: boolean;
  key_takeaways?: boolean;
  kpi_targets?: boolean;
  metrics?: boolean;
  platform_breakdown?: boolean;
  top_performers?: boolean;
  content_gallery?: boolean;
  roster?: boolean;
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

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  client_name: string;
  client_logo_url: string | null;
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
  thumbnail_url: string | null; // For videos: user-uploaded thumbnail
  sort_order: number;
  is_video_thumbnail: boolean; // true = this is a video's thumbnail image
  created_at: string;
}

// ─── Run of Show Types ────────────────────────────────────

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

// ─── Brief Types ──────────────────────────────────────────

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

// ─── Shoot Types ──────────────────────────────────────────

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
