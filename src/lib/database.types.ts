export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      asset_metrics: {
        Row: {
          created_at: string | null
          d30_comments: number | null
          d30_engagement_rate: number | null
          d30_likes: number | null
          d30_logged_at: string | null
          d30_reach: number | null
          d30_saves: number | null
          d30_shares: number | null
          d30_views: number | null
          d7_comments: number | null
          d7_engagement_rate: number | null
          d7_impressions: number | null
          d7_likes: number | null
          d7_logged_at: string | null
          d7_reach: number | null
          d7_saves: number | null
          d7_shares: number | null
          d7_views: number | null
          id: string
          inspo_item_id: string
          live_url: string | null
          performance_tier:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform: string | null
          posted_at: string | null
          tier_rationale: string | null
          tier_scored_at: string | null
        }
        Insert: {
          created_at?: string | null
          d30_comments?: number | null
          d30_engagement_rate?: number | null
          d30_likes?: number | null
          d30_logged_at?: string | null
          d30_reach?: number | null
          d30_saves?: number | null
          d30_shares?: number | null
          d30_views?: number | null
          d7_comments?: number | null
          d7_engagement_rate?: number | null
          d7_impressions?: number | null
          d7_likes?: number | null
          d7_logged_at?: string | null
          d7_reach?: number | null
          d7_saves?: number | null
          d7_shares?: number | null
          d7_views?: number | null
          id?: string
          inspo_item_id: string
          live_url?: string | null
          performance_tier?:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform?: string | null
          posted_at?: string | null
          tier_rationale?: string | null
          tier_scored_at?: string | null
        }
        Update: {
          created_at?: string | null
          d30_comments?: number | null
          d30_engagement_rate?: number | null
          d30_likes?: number | null
          d30_logged_at?: string | null
          d30_reach?: number | null
          d30_saves?: number | null
          d30_shares?: number | null
          d30_views?: number | null
          d7_comments?: number | null
          d7_engagement_rate?: number | null
          d7_impressions?: number | null
          d7_likes?: number | null
          d7_logged_at?: string | null
          d7_reach?: number | null
          d7_saves?: number | null
          d7_shares?: number | null
          d7_views?: number | null
          id?: string
          inspo_item_id?: string
          live_url?: string | null
          performance_tier?:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform?: string | null
          posted_at?: string | null
          tier_rationale?: string | null
          tier_scored_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_metrics_inspo_item_id_fkey"
            columns: ["inspo_item_id"]
            isOneToOne: true
            referencedRelation: "inspo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          campaign_id: string
          content_rating: string | null
          created_at: string | null
          featured_order: number | null
          gender: string | null
          id: string
          ig_followers: number | null
          ig_handle: string | null
          is_featured: boolean | null
          metrics: Json | null
          name: string
          notes: string | null
          post_type: string
          post_url: string | null
          reach_level: string | null
          school: string
          sort_order: number | null
          sport: string
        }
        Insert: {
          campaign_id: string
          content_rating?: string | null
          created_at?: string | null
          featured_order?: number | null
          gender?: string | null
          id?: string
          ig_followers?: number | null
          ig_handle?: string | null
          is_featured?: boolean | null
          metrics?: Json | null
          name: string
          notes?: string | null
          post_type?: string
          post_url?: string | null
          reach_level?: string | null
          school: string
          sort_order?: number | null
          sport: string
        }
        Update: {
          campaign_id?: string
          content_rating?: string | null
          created_at?: string | null
          featured_order?: number | null
          gender?: string | null
          id?: string
          ig_followers?: number | null
          ig_handle?: string | null
          is_featured?: boolean | null
          metrics?: Json | null
          name?: string
          notes?: string | null
          post_type?: string
          post_url?: string | null
          reach_level?: string | null
          school?: string
          sort_order?: number | null
          sport?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes_master: {
        Row: {
          content_preference: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          ig_followers: number | null
          ig_handle: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          school: string | null
          sport: string | null
          tiktok_handle: string | null
          updated_at: string | null
        }
        Insert: {
          content_preference?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          ig_followers?: number | null
          ig_handle?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          school?: string | null
          sport?: string | null
          tiktok_handle?: string | null
          updated_at?: string | null
        }
        Update: {
          content_preference?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          ig_followers?: number | null
          ig_handle?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          school?: string | null
          sport?: string | null
          tiktok_handle?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      brand_campaigns: {
        Row: {
          admin_campaign_id: string | null
          brand: string | null
          brand_id: string | null
          brand_logo_url: string | null
          budget: number | null
          created_at: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          editor_name: string | null
          has_brief: boolean | null
          has_tracker: boolean | null
          id: string
          name: string
          production_config:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          raw_folder_populated: boolean | null
          settings: Json | null
          shoot_date: string | null
          shoot_location: string | null
          status: string | null
          updated_at: string | null
          videographer_id: string | null
        }
        Insert: {
          admin_campaign_id?: string | null
          brand?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          budget?: number | null
          created_at?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          editor_name?: string | null
          has_brief?: boolean | null
          has_tracker?: boolean | null
          id?: string
          name: string
          production_config?:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          raw_folder_populated?: boolean | null
          settings?: Json | null
          shoot_date?: string | null
          shoot_location?: string | null
          status?: string | null
          updated_at?: string | null
          videographer_id?: string | null
        }
        Update: {
          admin_campaign_id?: string | null
          brand?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          budget?: number | null
          created_at?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          editor_name?: string | null
          has_brief?: boolean | null
          has_tracker?: boolean | null
          id?: string
          name?: string
          production_config?:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          raw_folder_populated?: boolean | null
          settings?: Json | null
          shoot_date?: string | null
          shoot_location?: string | null
          status?: string | null
          updated_at?: string | null
          videographer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_campaigns_videographer_id_fkey"
            columns: ["videographer_id"]
            isOneToOne: false
            referencedRelation: "videographers"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          admin_brand_id: string | null
          archived: boolean
          brand_colors: Json | null
          brand_guidelines_url: string | null
          created_at: string | null
          font_primary: string | null
          font_primary_url: string | null
          font_secondary: string | null
          font_secondary_url: string | null
          id: string
          industry: string | null
          kit_notes: string | null
          logo_dark_url: string | null
          logo_light_url: string | null
          logo_mark_url: string | null
          logo_primary_url: string | null
          logo_url: string | null
          logo_white_url: string | null
          name: string
          notes: string | null
          primary_color: string | null
          secondary_color: string | null
          show_on_clients_page: boolean
          slug: string | null
          sort_order: number
          tagline: string | null
          website: string | null
        }
        Insert: {
          admin_brand_id?: string | null
          archived?: boolean
          brand_colors?: Json | null
          brand_guidelines_url?: string | null
          created_at?: string | null
          font_primary?: string | null
          font_primary_url?: string | null
          font_secondary?: string | null
          font_secondary_url?: string | null
          id?: string
          industry?: string | null
          kit_notes?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          logo_mark_url?: string | null
          logo_primary_url?: string | null
          logo_url?: string | null
          logo_white_url?: string | null
          name: string
          notes?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_on_clients_page?: boolean
          slug?: string | null
          sort_order?: number
          tagline?: string | null
          website?: string | null
        }
        Update: {
          admin_brand_id?: string | null
          archived?: boolean
          brand_colors?: Json | null
          brand_guidelines_url?: string | null
          created_at?: string | null
          font_primary?: string | null
          font_primary_url?: string | null
          font_secondary?: string | null
          font_secondary_url?: string | null
          id?: string
          industry?: string | null
          kit_notes?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          logo_mark_url?: string | null
          logo_primary_url?: string | null
          logo_url?: string | null
          logo_white_url?: string | null
          name?: string
          notes?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_on_clients_page?: boolean
          slug?: string | null
          sort_order?: number
          tagline?: string | null
          website?: string | null
        }
        Relationships: []
      }
      briefs: {
        Row: {
          _img_b64: string | null
          brand_id: string | null
          client_name: string
          created_at: string
          external_url: string | null
          html_content: string
          id: string
          pin_hash: string | null
          published: boolean
          slug: string
          title: string
          tracker_id: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          _img_b64?: string | null
          brand_id?: string | null
          client_name?: string
          created_at?: string
          external_url?: string | null
          html_content?: string
          id?: string
          pin_hash?: string | null
          published?: boolean
          slug: string
          title: string
          tracker_id?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          _img_b64?: string | null
          brand_id?: string | null
          client_name?: string
          created_at?: string
          external_url?: string | null
          html_content?: string
          id?: string
          pin_hash?: string | null
          published?: boolean
          slug?: string
          title?: string
          tracker_id?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "briefs_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_instructions: {
        Row: {
          athlete_section: Json | null
          brand_color: string | null
          brand_id: string | null
          brand_logo: string | null
          brand_name: string | null
          campaign_date: string | null
          created_at: string | null
          crew_section: Json | null
          hero_image: string | null
          hero_video: string | null
          id: string
          slug: string | null
          title: string | null
        }
        Insert: {
          athlete_section?: Json | null
          brand_color?: string | null
          brand_id?: string | null
          brand_logo?: string | null
          brand_name?: string | null
          campaign_date?: string | null
          created_at?: string | null
          crew_section?: Json | null
          hero_image?: string | null
          hero_video?: string | null
          id?: string
          slug?: string | null
          title?: string | null
        }
        Update: {
          athlete_section?: Json | null
          brand_color?: string | null
          brand_id?: string | null
          brand_logo?: string | null
          brand_name?: string | null
          campaign_date?: string | null
          created_at?: string | null
          crew_section?: Json | null
          hero_image?: string | null
          hero_video?: string | null
          id?: string
          slug?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_instructions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_instructions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_instructions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      campaign_optin_submissions: {
        Row: {
          created_at: string | null
          data: Json | null
          error_message: string | null
          id: string
          ig_handle: string | null
          optin_id: string | null
          status: string
          synced_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          ig_handle?: string | null
          optin_id?: string | null
          status?: string
          synced_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          ig_handle?: string | null
          optin_id?: string | null
          status?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_optin_submissions_optin_id_fkey"
            columns: ["optin_id"]
            isOneToOne: false
            referencedRelation: "campaign_optins"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_optins: {
        Row: {
          admin_campaign_id: number | null
          brand_color: string | null
          brand_id: string | null
          brand_logo: string | null
          brand_name: string | null
          campaign_description: string | null
          compensation_info: string | null
          created_at: string | null
          deadline: string | null
          fields: Json | null
          goal: string | null
          headline: string | null
          hero_image: string | null
          id: string
          notice: string | null
          products: string | null
          published_at: string | null
          requirements: string | null
          slug: string | null
          social_platforms: string | null
          status: string
          success_message: string | null
          terms: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          admin_campaign_id?: number | null
          brand_color?: string | null
          brand_id?: string | null
          brand_logo?: string | null
          brand_name?: string | null
          campaign_description?: string | null
          compensation_info?: string | null
          created_at?: string | null
          deadline?: string | null
          fields?: Json | null
          goal?: string | null
          headline?: string | null
          hero_image?: string | null
          id?: string
          notice?: string | null
          products?: string | null
          published_at?: string | null
          requirements?: string | null
          slug?: string | null
          social_platforms?: string | null
          status?: string
          success_message?: string | null
          terms?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_campaign_id?: number | null
          brand_color?: string | null
          brand_id?: string | null
          brand_logo?: string | null
          brand_name?: string | null
          campaign_description?: string | null
          compensation_info?: string | null
          created_at?: string | null
          deadline?: string | null
          fields?: Json | null
          goal?: string | null
          headline?: string | null
          hero_image?: string | null
          id?: string
          notice?: string | null
          products?: string | null
          published_at?: string | null
          requirements?: string | null
          slug?: string | null
          social_platforms?: string | null
          status?: string
          success_message?: string | null
          terms?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_optins_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_optins_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_optins_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      campaign_recaps: {
        Row: {
          admin_campaign_id: string | null
          brand_id: string | null
          client_logo_url: string | null
          client_name: string
          created_at: string | null
          description: string | null
          drive_folder_id: string | null
          featured: boolean | null
          hero_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          metric_overrides: Json
          name: string
          og_image: string | null
          pin_hash: string | null
          public_sections: Json | null
          published: boolean | null
          settings: Json | null
          slug: string
          status: string
          tags: string[] | null
          type: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          admin_campaign_id?: string | null
          brand_id?: string | null
          client_logo_url?: string | null
          client_name: string
          created_at?: string | null
          description?: string | null
          drive_folder_id?: string | null
          featured?: boolean | null
          hero_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          metric_overrides?: Json
          name: string
          og_image?: string | null
          pin_hash?: string | null
          public_sections?: Json | null
          published?: boolean | null
          settings?: Json | null
          slug: string
          status?: string
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          admin_campaign_id?: string | null
          brand_id?: string | null
          client_logo_url?: string | null
          client_name?: string
          created_at?: string | null
          description?: string | null
          drive_folder_id?: string | null
          featured?: boolean | null
          hero_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          metric_overrides?: Json
          name?: string
          og_image?: string | null
          pin_hash?: string | null
          public_sections?: Json | null
          published?: boolean | null
          settings?: Json | null
          slug?: string
          status?: string
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      campaign_rosters: {
        Row: {
          athlete_id: string
          campaign_id: string
          created_at: string | null
          id: string
          metrics: Json | null
          notes: string | null
          post_type: string | null
          post_url: string | null
          role: string | null
        }
        Insert: {
          athlete_id: string
          campaign_id: string
          created_at?: string | null
          id?: string
          metrics?: Json | null
          notes?: string | null
          post_type?: string | null
          post_url?: string | null
          role?: string | null
        }
        Update: {
          athlete_id?: string
          campaign_id?: string
          created_at?: string | null
          id?: string
          metrics?: Json | null
          notes?: string | null
          post_type?: string | null
          post_url?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_rosters_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_rosters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      case_studies: {
        Row: {
          athlete_names: string[] | null
          body_html: string | null
          brand_id: string | null
          brand_logo_url: string | null
          brand_name: string
          category: string | null
          challenge: string | null
          created_at: string
          featured: boolean
          gallery_urls: string[] | null
          hero_stat: string | null
          hero_stat_label: string | null
          highlights: string[]
          id: string
          image_url: string | null
          meta_description: string | null
          meta_title: string | null
          metrics: Json
          og_image: string | null
          overview: string | null
          published: boolean
          published_date: string | null
          quote_attribution: string | null
          quote_text: string | null
          results: string | null
          slug: string
          solution: string | null
          sort_order: number
          source_campaign_id: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          athlete_names?: string[] | null
          body_html?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          brand_name: string
          category?: string | null
          challenge?: string | null
          created_at?: string
          featured?: boolean
          gallery_urls?: string[] | null
          hero_stat?: string | null
          hero_stat_label?: string | null
          highlights?: string[]
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          metrics?: Json
          og_image?: string | null
          overview?: string | null
          published?: boolean
          published_date?: string | null
          quote_attribution?: string | null
          quote_text?: string | null
          results?: string | null
          slug: string
          solution?: string | null
          sort_order?: number
          source_campaign_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          athlete_names?: string[] | null
          body_html?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          brand_name?: string
          category?: string | null
          challenge?: string | null
          created_at?: string
          featured?: boolean
          gallery_urls?: string[] | null
          hero_stat?: string | null
          hero_stat_label?: string | null
          highlights?: string[]
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          metrics?: Json
          og_image?: string | null
          overview?: string | null
          published?: boolean
          published_date?: string | null
          quote_attribution?: string | null
          quote_text?: string | null
          results?: string | null
          slug?: string
          solution?: string | null
          sort_order?: number
          source_campaign_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_studies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_studies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_studies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "case_studies_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_studies_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      content_queue: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          asset_url: string | null
          asset_urls: string[] | null
          caption: string | null
          channel: string
          created_at: string | null
          created_by: string | null
          hashtags: string[] | null
          id: string
          inspo_item_ids: string[] | null
          notes: string | null
          platform_post_id: string | null
          posted_at: string | null
          publish_error: string | null
          scheduled_for: string | null
          status: string | null
          template_type: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          asset_url?: string | null
          asset_urls?: string[] | null
          caption?: string | null
          channel: string
          created_at?: string | null
          created_by?: string | null
          hashtags?: string[] | null
          id?: string
          inspo_item_ids?: string[] | null
          notes?: string | null
          platform_post_id?: string | null
          posted_at?: string | null
          publish_error?: string | null
          scheduled_for?: string | null
          status?: string | null
          template_type?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          asset_url?: string | null
          asset_urls?: string[] | null
          caption?: string | null
          channel?: string
          created_at?: string | null
          created_by?: string | null
          hashtags?: string[] | null
          id?: string
          inspo_item_ids?: string[] | null
          notes?: string | null
          platform_post_id?: string | null
          posted_at?: string | null
          publish_error?: string | null
          scheduled_for?: string | null
          status?: string | null
          template_type?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      deal_tracker: {
        Row: {
          athlete_name: string
          athlete_photo_url: string | null
          body: string | null
          brand: string | null
          campaign_id: string | null
          created_at: string | null
          deal_type: string | null
          headline: string
          id: string
          industry: string | null
          media: Json | null
          photos: string[] | null
          published: boolean | null
          school: string | null
          slug: string
          sport: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          athlete_name: string
          athlete_photo_url?: string | null
          body?: string | null
          brand?: string | null
          campaign_id?: string | null
          created_at?: string | null
          deal_type?: string | null
          headline: string
          id?: string
          industry?: string | null
          media?: Json | null
          photos?: string[] | null
          published?: boolean | null
          school?: string | null
          slug: string
          sport?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          athlete_name?: string
          athlete_photo_url?: string | null
          body?: string | null
          brand?: string | null
          campaign_id?: string | null
          created_at?: string | null
          deal_type?: string | null
          headline?: string
          id?: string
          industry?: string | null
          media?: Json | null
          photos?: string[] | null
          published?: boolean | null
          school?: string | null
          slug?: string
          sport?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_deal_tracker_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          athlete_name: string | null
          athlete_photo_url: string | null
          athlete_school: string | null
          athlete_sport: string | null
          bg_position_desktop: string | null
          bg_position_mobile: string | null
          bg_position_tablet: string | null
          body_html: string | null
          brand_id: string | null
          brand_logo_url: string | null
          brand_name: string
          canonical_url: string | null
          created_at: string
          date_announced: string | null
          deal_type: string | null
          description: string | null
          featured: boolean
          focal_point: string | null
          focal_point_mobile: string | null
          focal_point_tablet: string | null
          id: string
          image_url: string | null
          meta_description: string | null
          meta_title: string | null
          og_image: string | null
          published: boolean
          relevance_score: number | null
          slug: string
          sort_order: number
          source_campaign_id: string | null
          status: string
          tags: string[] | null
          tier: string
          updated_at: string
          value: string | null
          video_url: string | null
          zoom_desktop: number | null
          zoom_mobile: number | null
          zoom_tablet: number | null
        }
        Insert: {
          athlete_name?: string | null
          athlete_photo_url?: string | null
          athlete_school?: string | null
          athlete_sport?: string | null
          bg_position_desktop?: string | null
          bg_position_mobile?: string | null
          bg_position_tablet?: string | null
          body_html?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          brand_name: string
          canonical_url?: string | null
          created_at?: string
          date_announced?: string | null
          deal_type?: string | null
          description?: string | null
          featured?: boolean
          focal_point?: string | null
          focal_point_mobile?: string | null
          focal_point_tablet?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          published?: boolean
          relevance_score?: number | null
          slug: string
          sort_order?: number
          source_campaign_id?: string | null
          status?: string
          tags?: string[] | null
          tier?: string
          updated_at?: string
          value?: string | null
          video_url?: string | null
          zoom_desktop?: number | null
          zoom_mobile?: number | null
          zoom_tablet?: number | null
        }
        Update: {
          athlete_name?: string | null
          athlete_photo_url?: string | null
          athlete_school?: string | null
          athlete_sport?: string | null
          bg_position_desktop?: string | null
          bg_position_mobile?: string | null
          bg_position_tablet?: string | null
          body_html?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          brand_name?: string
          canonical_url?: string | null
          created_at?: string
          date_announced?: string | null
          deal_type?: string | null
          description?: string | null
          featured?: boolean
          focal_point?: string | null
          focal_point_mobile?: string | null
          focal_point_tablet?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          published?: boolean
          relevance_score?: number | null
          slug?: string
          sort_order?: number
          source_campaign_id?: string | null
          status?: string
          tags?: string[] | null
          tier?: string
          updated_at?: string
          value?: string | null
          video_url?: string | null
          zoom_desktop?: number | null
          zoom_mobile?: number | null
          zoom_tablet?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "deals_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      inspo_items: {
        Row: {
          athlete_id: string | null
          athlete_name: string | null
          brand_id: string | null
          brief_fit: string[] | null
          campaign_id: string | null
          clip_end_seconds: number | null
          clip_start_seconds: number | null
          content_freshness:
            | Database["public"]["Enums"]["content_freshness_enum"]
            | null
          content_type: Database["public"]["Enums"]["content_type_enum"]
          context_tags: Json | null
          created_at: string | null
          drive_file_id: string | null
          drive_folder_path: string | null
          duration_seconds: number | null
          editor_name: string | null
          embedding: string | null
          file_size_bytes: number | null
          file_url: string | null
          format: string | null
          id: string
          is_atomic_clip: boolean | null
          is_hero: boolean | null
          live_url: string | null
          mime_type: string | null
          notes: string | null
          parent_asset_id: string | null
          performance_tier:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform: string | null
          pro_tags: Json | null
          production_config:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          rights_expiry: string | null
          school: string | null
          search_phrases: string[] | null
          social_tags: Json | null
          source: Database["public"]["Enums"]["content_source_enum"]
          sport: string | null
          tagging_status: string | null
          tech_notes: string | null
          thumbnail_url: string | null
          triage_status: string | null
          updated_at: string | null
          videographer_id: string | null
          videographer_name: string | null
          visual_description: string | null
        }
        Insert: {
          athlete_id?: string | null
          athlete_name?: string | null
          brand_id?: string | null
          brief_fit?: string[] | null
          campaign_id?: string | null
          clip_end_seconds?: number | null
          clip_start_seconds?: number | null
          content_freshness?:
            | Database["public"]["Enums"]["content_freshness_enum"]
            | null
          content_type?: Database["public"]["Enums"]["content_type_enum"]
          context_tags?: Json | null
          created_at?: string | null
          drive_file_id?: string | null
          drive_folder_path?: string | null
          duration_seconds?: number | null
          editor_name?: string | null
          embedding?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          format?: string | null
          id?: string
          is_atomic_clip?: boolean | null
          is_hero?: boolean | null
          live_url?: string | null
          mime_type?: string | null
          notes?: string | null
          parent_asset_id?: string | null
          performance_tier?:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform?: string | null
          pro_tags?: Json | null
          production_config?:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          rights_expiry?: string | null
          school?: string | null
          search_phrases?: string[] | null
          social_tags?: Json | null
          source?: Database["public"]["Enums"]["content_source_enum"]
          sport?: string | null
          tagging_status?: string | null
          tech_notes?: string | null
          thumbnail_url?: string | null
          triage_status?: string | null
          updated_at?: string | null
          videographer_id?: string | null
          videographer_name?: string | null
          visual_description?: string | null
        }
        Update: {
          athlete_id?: string | null
          athlete_name?: string | null
          brand_id?: string | null
          brief_fit?: string[] | null
          campaign_id?: string | null
          clip_end_seconds?: number | null
          clip_start_seconds?: number | null
          content_freshness?:
            | Database["public"]["Enums"]["content_freshness_enum"]
            | null
          content_type?: Database["public"]["Enums"]["content_type_enum"]
          context_tags?: Json | null
          created_at?: string | null
          drive_file_id?: string | null
          drive_folder_path?: string | null
          duration_seconds?: number | null
          editor_name?: string | null
          embedding?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          format?: string | null
          id?: string
          is_atomic_clip?: boolean | null
          is_hero?: boolean | null
          live_url?: string | null
          mime_type?: string | null
          notes?: string | null
          parent_asset_id?: string | null
          performance_tier?:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform?: string | null
          pro_tags?: Json | null
          production_config?:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          rights_expiry?: string | null
          school?: string | null
          search_phrases?: string[] | null
          social_tags?: Json | null
          source?: Database["public"]["Enums"]["content_source_enum"]
          sport?: string | null
          tagging_status?: string | null
          tech_notes?: string | null
          thumbnail_url?: string | null
          triage_status?: string | null
          updated_at?: string | null
          videographer_id?: string | null
          videographer_name?: string | null
          visual_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspo_items_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspo_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspo_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspo_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "inspo_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspo_items_parent_asset_id_fkey"
            columns: ["parent_asset_id"]
            isOneToOne: false
            referencedRelation: "inspo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspo_items_videographer_id_fkey"
            columns: ["videographer_id"]
            isOneToOne: false
            referencedRelation: "videographers"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          athlete_id: string | null
          campaign_id: string
          created_at: string | null
          drive_file_id: string | null
          file_url: string
          id: string
          is_video_thumbnail: boolean | null
          sort_order: number | null
          thumbnail_url: string | null
          type: string
        }
        Insert: {
          athlete_id?: string | null
          campaign_id: string
          created_at?: string | null
          drive_file_id?: string | null
          file_url: string
          id?: string
          is_video_thumbnail?: boolean | null
          sort_order?: number | null
          thumbnail_url?: string | null
          type: string
        }
        Update: {
          athlete_id?: string | null
          campaign_id?: string
          created_at?: string | null
          drive_file_id?: string | null
          file_url?: string
          id?: string
          is_video_thumbnail?: boolean | null
          sort_order?: number | null
          thumbnail_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      moodboard_items: {
        Row: {
          created_at: string | null
          id: string
          inspo_item_id: string
          moodboard_id: string
          note: string | null
          position: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inspo_item_id: string
          moodboard_id: string
          note?: string | null
          position?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inspo_item_id?: string
          moodboard_id?: string
          note?: string | null
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "moodboard_items_inspo_item_id_fkey"
            columns: ["inspo_item_id"]
            isOneToOne: false
            referencedRelation: "inspo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodboard_items_moodboard_id_fkey"
            columns: ["moodboard_id"]
            isOneToOne: false
            referencedRelation: "moodboards"
            referencedColumns: ["id"]
          },
        ]
      }
      moodboards: {
        Row: {
          brand_id: string | null
          brief_id: string | null
          campaign_id: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          public_token: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          brief_id?: string | null
          campaign_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          public_token?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          brief_id?: string | null
          campaign_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          public_token?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moodboards_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodboards_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodboards_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "moodboards_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodboards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          blocks: Json | null
          brand_color: string | null
          brand_id: string | null
          brand_logo: string | null
          created_at: string | null
          id: string
          preview_text: string | null
          subject: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          blocks?: Json | null
          brand_color?: string | null
          brand_id?: string | null
          brand_logo?: string | null
          created_at?: string | null
          id?: string
          preview_text?: string | null
          subject?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          blocks?: Json | null
          brand_color?: string | null
          brand_id?: string | null
          brand_logo?: string | null
          created_at?: string | null
          id?: string
          preview_text?: string | null
          subject?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletters_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletters_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      optin_campaigns: {
        Row: {
          accent_color: string | null
          admin_campaign_id: number | null
          brand_id: string | null
          created_at: string
          deadline: string | null
          goal: string | null
          headline: string
          hero_image_url: string | null
          id: string
          notice: string | null
          payout: string | null
          products: string | null
          published_at: string | null
          requirements: string | null
          slug: string
          social_platforms: string[] | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          admin_campaign_id?: number | null
          brand_id?: string | null
          created_at?: string
          deadline?: string | null
          goal?: string | null
          headline?: string
          hero_image_url?: string | null
          id?: string
          notice?: string | null
          payout?: string | null
          products?: string | null
          published_at?: string | null
          requirements?: string | null
          slug: string
          social_platforms?: string[] | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          admin_campaign_id?: number | null
          brand_id?: string | null
          created_at?: string
          deadline?: string | null
          goal?: string | null
          headline?: string
          hero_image_url?: string | null
          id?: string
          notice?: string | null
          payout?: string | null
          products?: string | null
          published_at?: string | null
          requirements?: string | null
          slug?: string
          social_platforms?: string[] | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optin_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optin_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optin_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      page_athletes: {
        Row: {
          created_at: string | null
          id: string
          name: string
          page_id: string
          post_type: string | null
          post_url: string | null
          rank: number | null
          school: string | null
          sort_order: number | null
          sport: string | null
          stats: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          page_id: string
          post_type?: string | null
          post_url?: string | null
          rank?: number | null
          school?: string | null
          sort_order?: number | null
          sport?: string | null
          stats?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          page_id?: string
          post_type?: string | null
          post_url?: string | null
          rank?: number | null
          school?: string | null
          sort_order?: number | null
          sport?: string | null
          stats?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_athletes_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_athletes_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_sections: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          page_id: string
          sort_order: number | null
          title: string | null
          type: string
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          page_id: string
          sort_order?: number | null
          title?: string | null
          type: string
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          page_id?: string
          sort_order?: number | null
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          admin_campaign_id: string | null
          brand_id: string | null
          camera_settings: string | null
          campaign_id: string | null
          client_logo_url: string | null
          client_name: string | null
          contacts: Json | null
          created_at: string | null
          description: string | null
          event_name: string | null
          external_url: string | null
          featured: boolean | null
          html_content: string | null
          id: string
          pin_hash: string | null
          public_sections: Json | null
          published: boolean | null
          settings: Json | null
          slug: string
          source_page_id: string | null
          subtitle: string | null
          title: string
          tracker_id: string | null
          type: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          admin_campaign_id?: string | null
          brand_id?: string | null
          camera_settings?: string | null
          campaign_id?: string | null
          client_logo_url?: string | null
          client_name?: string | null
          contacts?: Json | null
          created_at?: string | null
          description?: string | null
          event_name?: string | null
          external_url?: string | null
          featured?: boolean | null
          html_content?: string | null
          id?: string
          pin_hash?: string | null
          public_sections?: Json | null
          published?: boolean | null
          settings?: Json | null
          slug: string
          source_page_id?: string | null
          subtitle?: string | null
          title: string
          tracker_id?: string | null
          type: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          admin_campaign_id?: string | null
          brand_id?: string | null
          camera_settings?: string | null
          campaign_id?: string | null
          client_logo_url?: string | null
          client_name?: string | null
          contacts?: Json | null
          created_at?: string | null
          description?: string | null
          event_name?: string | null
          external_url?: string | null
          featured?: boolean | null
          html_content?: string | null
          id?: string
          pin_hash?: string | null
          public_sections?: Json | null
          published?: boolean | null
          settings?: Json | null
          slug?: string
          source_page_id?: string | null
          subtitle?: string | null
          title?: string
          tracker_id?: string | null
          type?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_pages_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_pages_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "pages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_optins: {
        Row: {
          admin_response: Json | null
          forwarded_to_admin_at: string | null
          id: string
          ig_handle: string
          ip_address: unknown
          optin_campaign_id: string
          source: string | null
          submitted_at: string
          user_agent: string | null
        }
        Insert: {
          admin_response?: Json | null
          forwarded_to_admin_at?: string | null
          id?: string
          ig_handle: string
          ip_address?: unknown
          optin_campaign_id: string
          source?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_response?: Json | null
          forwarded_to_admin_at?: string | null
          id?: string
          ig_handle?: string
          ip_address?: unknown
          optin_campaign_id?: string
          source?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_optins_optin_campaign_id_fkey"
            columns: ["optin_campaign_id"]
            isOneToOne: false
            referencedRelation: "optin_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_pages: {
        Row: {
          brand_id: string | null
          content: Json
          created_at: string
          created_by: string | null
          id: string
          slug: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          slug: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          slug?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_pages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_pages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_pages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      posting_packages: {
        Row: {
          am_notes: string | null
          athlete_id: string | null
          athlete_name: string
          campaign_id: string | null
          caption_long: string | null
          caption_medium: string | null
          caption_short: string | null
          confirmed_at: string | null
          created_at: string | null
          delivery_token: string | null
          ftc_note: string | null
          hashtags: string[] | null
          id: string
          inspo_item_id: string | null
          intended_post_date: string | null
          live_url: string | null
          mentions: string[] | null
          platform_notes: string | null
          posted_at: string | null
          posting_window_end: string | null
          posting_window_start: string | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          am_notes?: string | null
          athlete_id?: string | null
          athlete_name: string
          campaign_id?: string | null
          caption_long?: string | null
          caption_medium?: string | null
          caption_short?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          delivery_token?: string | null
          ftc_note?: string | null
          hashtags?: string[] | null
          id?: string
          inspo_item_id?: string | null
          intended_post_date?: string | null
          live_url?: string | null
          mentions?: string[] | null
          platform_notes?: string | null
          posted_at?: string | null
          posting_window_end?: string | null
          posting_window_start?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          am_notes?: string | null
          athlete_id?: string | null
          athlete_name?: string
          campaign_id?: string | null
          caption_long?: string | null
          caption_medium?: string | null
          caption_short?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          delivery_token?: string | null
          ftc_note?: string | null
          hashtags?: string[] | null
          id?: string
          inspo_item_id?: string | null
          intended_post_date?: string | null
          live_url?: string | null
          mentions?: string[] | null
          platform_notes?: string | null
          posted_at?: string | null
          posting_window_end?: string | null
          posting_window_start?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posting_packages_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_packages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_packages_inspo_item_id_fkey"
            columns: ["inspo_item_id"]
            isOneToOne: false
            referencedRelation: "inspo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      press_articles: {
        Row: {
          archived: boolean
          author: string | null
          brand_id: string | null
          brand_logo_url: string | null
          category: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          external_url: string | null
          featured: boolean
          id: string
          image_url: string | null
          logo_position: string
          meta_description: string | null
          meta_title: string | null
          og_image: string | null
          publication: string | null
          published: boolean
          published_date: string | null
          read_time_mins: number | null
          show_logo: boolean
          slug: string
          sort_order: number
          source_campaign_id: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          author?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          external_url?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          logo_position?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          publication?: string | null
          published?: boolean
          published_date?: string | null
          read_time_mins?: number | null
          show_logo?: boolean
          slug: string
          sort_order?: number
          source_campaign_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          author?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          external_url?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          logo_position?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          publication?: string | null
          published?: boolean
          published_date?: string | null
          read_time_mins?: number | null
          show_logo?: boolean
          slug?: string
          sort_order?: number
          source_campaign_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "press_articles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "press_articles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "press_articles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "press_articles_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "press_articles_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          author_type: string
          body: string
          comment_type: string
          created_at: string | null
          id: string
          is_resolved: boolean | null
          linked_brand_comment_id: string | null
          resolved_at: string | null
          session_id: string
          timestamp_seconds: number | null
        }
        Insert: {
          author_type: string
          body: string
          comment_type: string
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          linked_brand_comment_id?: string | null
          resolved_at?: string | null
          session_id: string
          timestamp_seconds?: number | null
        }
        Update: {
          author_type?: string
          body?: string
          comment_type?: string
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          linked_brand_comment_id?: string | null
          resolved_at?: string | null
          session_id?: string
          timestamp_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_linked_brand_comment_id_fkey"
            columns: ["linked_brand_comment_id"]
            isOneToOne: false
            referencedRelation: "review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "review_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_sessions: {
        Row: {
          agency_token: string | null
          asset_name: string | null
          brand_decided_at: string | null
          brand_decision: string | null
          brand_token: string | null
          campaign_id: string | null
          created_at: string | null
          editor_deadline: string | null
          editor_token: string | null
          id: string
          inspo_item_id: string | null
          notes: string | null
          revision_round: number | null
          status: string | null
          updated_at: string | null
          version_number: number | null
          video_duration_seconds: number | null
          video_url: string
        }
        Insert: {
          agency_token?: string | null
          asset_name?: string | null
          brand_decided_at?: string | null
          brand_decision?: string | null
          brand_token?: string | null
          campaign_id?: string | null
          created_at?: string | null
          editor_deadline?: string | null
          editor_token?: string | null
          id?: string
          inspo_item_id?: string | null
          notes?: string | null
          revision_round?: number | null
          status?: string | null
          updated_at?: string | null
          version_number?: number | null
          video_duration_seconds?: number | null
          video_url: string
        }
        Update: {
          agency_token?: string | null
          asset_name?: string | null
          brand_decided_at?: string | null
          brand_decision?: string | null
          brand_token?: string | null
          campaign_id?: string | null
          created_at?: string | null
          editor_deadline?: string | null
          editor_token?: string | null
          id?: string
          inspo_item_id?: string | null
          notes?: string | null
          revision_round?: number | null
          status?: string | null
          updated_at?: string | null
          version_number?: number | null
          video_duration_seconds?: number | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_sessions_inspo_item_id_fkey"
            columns: ["inspo_item_id"]
            isOneToOne: false
            referencedRelation: "inspo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ros_shoots: {
        Row: {
          arrival_time: string
          athlete: string | null
          city: string
          client_contact_name: string | null
          client_contact_phone: string | null
          content_folder_url: string | null
          created_at: string | null
          date: string
          event_name: string
          event_start_time: string
          id: string
          run_of_show_id: string
          shoot_type: string
          shot_list: Json | null
          slug: string
          sort_order: number | null
          starting_address: string | null
          state: string
          timeline: Json | null
          type_label: string | null
          videographer: string
          videographer_phone: string | null
          website: string | null
        }
        Insert: {
          arrival_time: string
          athlete?: string | null
          city: string
          client_contact_name?: string | null
          client_contact_phone?: string | null
          content_folder_url?: string | null
          created_at?: string | null
          date: string
          event_name: string
          event_start_time: string
          id?: string
          run_of_show_id: string
          shoot_type?: string
          shot_list?: Json | null
          slug: string
          sort_order?: number | null
          starting_address?: string | null
          state: string
          timeline?: Json | null
          type_label?: string | null
          videographer?: string
          videographer_phone?: string | null
          website?: string | null
        }
        Update: {
          arrival_time?: string
          athlete?: string | null
          city?: string
          client_contact_name?: string | null
          client_contact_phone?: string | null
          content_folder_url?: string | null
          created_at?: string | null
          date?: string
          event_name?: string
          event_start_time?: string
          id?: string
          run_of_show_id?: string
          shoot_type?: string
          shot_list?: Json | null
          slug?: string
          sort_order?: number | null
          starting_address?: string | null
          state?: string
          timeline?: Json | null
          type_label?: string | null
          videographer?: string
          videographer_phone?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ros_shoots_run_of_show_id_fkey"
            columns: ["run_of_show_id"]
            isOneToOne: false
            referencedRelation: "run_of_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      run_of_shows: {
        Row: {
          brand_id: string | null
          camera_settings: string | null
          client_logo_url: string | null
          client_name: string
          contacts: Json | null
          created_at: string | null
          event_name: string | null
          id: string
          name: string
          pin_hash: string | null
          published: boolean | null
          slug: string
          subtitle: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          brand_id?: string | null
          camera_settings?: string | null
          client_logo_url?: string | null
          client_name: string
          contacts?: Json | null
          created_at?: string | null
          event_name?: string | null
          id?: string
          name: string
          pin_hash?: string | null
          published?: boolean | null
          slug: string
          subtitle?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          brand_id?: string | null
          camera_settings?: string | null
          client_logo_url?: string | null
          client_name?: string
          contacts?: Json | null
          created_at?: string | null
          event_name?: string | null
          id?: string
          name?: string
          pin_hash?: string | null
          published?: boolean | null
          slug?: string
          subtitle?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_of_shows_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_of_shows_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_of_shows_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      tier3_submissions: {
        Row: {
          asset_type: string
          athlete_email: string | null
          athlete_id: string | null
          athlete_name: string
          brand_id: string | null
          campaign_id: string
          campaign_media_id: string | null
          campaign_name: string | null
          caption: string | null
          created_at: string
          drive_file_id: string
          drive_file_url: string
          drive_thumbnail_url: string | null
          file_name: string | null
          file_size_bytes: number | null
          form_response_id: string | null
          id: string
          mime_type: string | null
          recap_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school: string | null
          score_brand_visibility: number | null
          score_composite: number | null
          score_composition: number | null
          score_hook: number | null
          score_lighting: number | null
          score_subject: number | null
          scored_at: string | null
          scoring_model: string | null
          shoot_date: string | null
          status: string
          submitted_at: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          asset_type: string
          athlete_email?: string | null
          athlete_id?: string | null
          athlete_name: string
          brand_id?: string | null
          campaign_id: string
          campaign_media_id?: string | null
          campaign_name?: string | null
          caption?: string | null
          created_at?: string
          drive_file_id: string
          drive_file_url: string
          drive_thumbnail_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          form_response_id?: string | null
          id?: string
          mime_type?: string | null
          recap_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school?: string | null
          score_brand_visibility?: number | null
          score_composite?: number | null
          score_composition?: number | null
          score_hook?: number | null
          score_lighting?: number | null
          score_subject?: number | null
          scored_at?: string | null
          scoring_model?: string | null
          shoot_date?: string | null
          status?: string
          submitted_at: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          athlete_email?: string | null
          athlete_id?: string | null
          athlete_name?: string
          brand_id?: string | null
          campaign_id?: string
          campaign_media_id?: string | null
          campaign_name?: string | null
          caption?: string | null
          created_at?: string
          drive_file_id?: string
          drive_file_url?: string
          drive_thumbnail_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          form_response_id?: string | null
          id?: string
          mime_type?: string | null
          recap_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school?: string | null
          score_brand_visibility?: number | null
          score_composite?: number | null
          score_composition?: number | null
          score_hook?: number | null
          score_lighting?: number | null
          score_subject?: number | null
          scored_at?: string | null
          scoring_model?: string | null
          shoot_date?: string | null
          status?: string
          submitted_at?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier3_submissions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier3_submissions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier3_submissions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "tier3_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier3_submissions_recap_id_fkey"
            columns: ["recap_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier3_submissions_recap_id_fkey"
            columns: ["recap_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      videographers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          portfolio_url: string | null
          schools: string[] | null
          specialties: string[] | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          portfolio_url?: string | null
          schools?: string[] | null
          specialties?: string[] | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          portfolio_url?: string | null
          schools?: string[] | null
          specialties?: string[] | null
        }
        Relationships: []
      }
      voice_settings: {
        Row: {
          channel: string
          created_at: string | null
          example_captions: string[] | null
          forbidden_phrases: string[] | null
          id: string
          is_active: boolean | null
          system_prompt: string
          tone_notes: string | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          example_captions?: string[] | null
          forbidden_phrases?: string[] | null
          id?: string
          is_active?: boolean | null
          system_prompt?: string
          tone_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          example_captions?: string[] | null
          forbidden_phrases?: string[] | null
          id?: string
          is_active?: boolean | null
          system_prompt?: string
          tone_notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_brands: {
        Row: {
          campaign_count: number | null
          deal_count: number | null
          id: string | null
          name: string | null
          press_count: number | null
        }
        Insert: {
          campaign_count?: never
          deal_count?: never
          id?: string | null
          name?: string | null
          press_count?: never
        }
        Update: {
          campaign_count?: never
          deal_count?: never
          id?: string | null
          name?: string | null
          press_count?: never
        }
        Relationships: []
      }
      public_campaign_recaps: {
        Row: {
          brand_name: string | null
          client_logo_url: string | null
          client_name: string | null
          created_at: string | null
          featured: boolean | null
          id: string | null
          name: string | null
          public_sections: Json | null
          settings: Json | null
          slug: string | null
          type: string | null
        }
        Relationships: []
      }
      public_deal_tracker: {
        Row: {
          athlete_name: string | null
          athlete_photo_url: string | null
          body: string | null
          brand: string | null
          created_at: string | null
          deal_type: string | null
          headline: string | null
          id: string | null
          industry: string | null
          media: Json | null
          photos: string[] | null
          school: string | null
          slug: string | null
          sport: string | null
          video_url: string | null
        }
        Insert: {
          athlete_name?: string | null
          athlete_photo_url?: string | null
          body?: string | null
          brand?: string | null
          created_at?: string | null
          deal_type?: string | null
          headline?: string | null
          id?: string | null
          industry?: string | null
          media?: Json | null
          photos?: string[] | null
          school?: string | null
          slug?: string | null
          sport?: string | null
          video_url?: string | null
        }
        Update: {
          athlete_name?: string | null
          athlete_photo_url?: string | null
          body?: string | null
          brand?: string | null
          created_at?: string | null
          deal_type?: string | null
          headline?: string | null
          id?: string | null
          industry?: string | null
          media?: Json | null
          photos?: string[] | null
          school?: string | null
          slug?: string | null
          sport?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      public_deals: {
        Row: {
          athlete_name: string | null
          athlete_school: string | null
          athlete_sport: string | null
          brand_display_name: string | null
          brand_logo_url: string | null
          brand_name: string | null
          created_at: string | null
          date_announced: string | null
          deal_type: string | null
          description: string | null
          featured: boolean | null
          id: string | null
          image_url: string | null
          sort_order: number | null
          tier: string | null
          value: string | null
          video_url: string | null
        }
        Relationships: []
      }
      public_pages: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          client_logo_url: string | null
          client_name: string | null
          created_at: string | null
          description: string | null
          external_url: string | null
          featured: boolean | null
          html_content: string | null
          id: string | null
          public_sections: Json | null
          settings: Json | null
          slug: string | null
          title: string | null
          type: string | null
        }
        Relationships: []
      }
      public_press: {
        Row: {
          author: string | null
          brand_logo_url: string | null
          brand_name: string | null
          category: string | null
          created_at: string | null
          excerpt: string | null
          external_url: string | null
          featured: boolean | null
          id: string | null
          image_url: string | null
          logo_position: string | null
          publication: string | null
          published_date: string | null
          show_logo: boolean | null
          slug: string | null
          sort_order: number | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      content_freshness_enum: "evergreen" | "timely" | "expired"
      content_source_enum: "inspo" | "produced_catalog" | "live_athlete_post"
      content_type_enum:
        | "produced"
        | "athlete_ugc"
        | "bts"
        | "raw_footage"
        | "photography"
        | "talking_head"
        | "inspo_external"
      performance_tier_enum: "top" | "solid" | "learning" | "unscored"
      production_config_enum: "vid_is_editor" | "split_team"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_freshness_enum: ["evergreen", "timely", "expired"],
      content_source_enum: ["inspo", "produced_catalog", "live_athlete_post"],
      content_type_enum: [
        "produced",
        "athlete_ugc",
        "bts",
        "raw_footage",
        "photography",
        "talking_head",
        "inspo_external",
      ],
      performance_tier_enum: ["top", "solid", "learning", "unscored"],
      production_config_enum: ["vid_is_editor", "split_team"],
    },
  },
} as const
