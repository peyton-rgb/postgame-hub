export interface VisibleSections {
  brief?: boolean;
  metrics?: boolean;
  platform_breakdown?: boolean;
  top_performers?: boolean;
  content_gallery?: boolean;
  roster?: boolean;
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
  };
}

export interface AthleteMetrics {
  ig_feed?: {
    post_url?: string;
    reach?: number;
    impressions?: number;
    likes?: number;
    comments?: number;
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
    total_engagements?: number;
    engagement_rate?: number;
  };
  tiktok?: {
    post_url?: string;
    views?: number;
    likes_comments?: number;
    saves_shares?: number;
    total_engagements?: number;
    engagement_rate?: number;
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
