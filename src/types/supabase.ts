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
      brand_assets: {
        Row: {
          brand_id: string
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          label: string | null
          mime_type: string | null
          type: string
          variant: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          label?: string | null
          mime_type?: string | null
          type: string
          variant?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          label?: string | null
          mime_type?: string | null
          type?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      brand_athletes: {
        Row: {
          campaign_id: string
          created_at: string | null
          first_name: string
          gender: string | null
          id: string
          ig_followers: number | null
          ig_handle: string | null
          last_name: string | null
          reach_level: string | null
          school: string | null
          sort_order: number | null
          sport: string | null
          tiktok_followers: number | null
          tiktok_handle: string | null
          total_followers: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          first_name: string
          gender?: string | null
          id?: string
          ig_followers?: number | null
          ig_handle?: string | null
          last_name?: string | null
          reach_level?: string | null
          school?: string | null
          sort_order?: number | null
          sport?: string | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
          total_followers?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          ig_followers?: number | null
          ig_handle?: string | null
          last_name?: string | null
          reach_level?: string | null
          school?: string | null
          sort_order?: number | null
          sport?: string | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
          total_followers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
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
          has_brief: boolean | null
          has_tracker: boolean | null
          id: string
          name: string
          settings: Json | null
          status: string | null
          updated_at: string | null
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
          has_brief?: boolean | null
          has_tracker?: boolean | null
          id?: string
          name: string
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
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
          has_brief?: boolean | null
          has_tracker?: boolean | null
          id?: string
          name?: string
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
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
        ]
      }
      brand_media: {
        Row: {
          campaign_id: string
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          participant_id: string | null
          sort_order: number | null
          thumbnail_url: string | null
          type: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          participant_id?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          type: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          participant_id?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_campaign_media_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_campaign_media_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "brand_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_posts: {
        Row: {
          campaign_id: string
          comments: number | null
          created_at: string | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          likes: number | null
          participant_id: string
          platform: string
          post_url: string | null
          reach: number | null
          saves: number | null
          shares: number | null
          views: number | null
        }
        Insert: {
          campaign_id: string
          comments?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          participant_id: string
          platform: string
          post_url?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          campaign_id?: string
          comments?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          participant_id?: string
          platform?: string
          post_url?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_posts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "brand_athletes"
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
          drive_folder_id: string | null
          featured: boolean | null
          id: string
          name: string
          pin_hash: string | null
          public_sections: Json | null
          published: boolean | null
          settings: Json | null
          slug: string
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
          drive_folder_id?: string | null
          featured?: boolean | null
          id?: string
          name: string
          pin_hash?: string | null
          public_sections?: Json | null
          published?: boolean | null
          settings?: Json | null
          slug: string
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
          drive_folder_id?: string | null
          featured?: boolean | null
          id?: string
          name?: string
          pin_hash?: string | null
          public_sections?: Json | null
          published?: boolean | null
          settings?: Json | null
          slug?: string
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
      case_studies: {
        Row: {
          brand_id: string | null
          brand_logo_url: string | null
          brand_name: string
          category: string | null
          challenge: string | null
          created_at: string
          featured: boolean
          hero_stat: string | null
          hero_stat_label: string | null
          highlights: string[]
          id: string
          image_url: string | null
          metrics: Json
          overview: string | null
          published: boolean
          published_date: string | null
          results: string | null
          slug: string
          solution: string | null
          sort_order: number
          source_campaign_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          brand_logo_url?: string | null
          brand_name: string
          category?: string | null
          challenge?: string | null
          created_at?: string
          featured?: boolean
          hero_stat?: string | null
          hero_stat_label?: string | null
          highlights?: string[]
          id?: string
          image_url?: string | null
          metrics?: Json
          overview?: string | null
          published?: boolean
          published_date?: string | null
          results?: string | null
          slug: string
          solution?: string | null
          sort_order?: number
          source_campaign_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          brand_logo_url?: string | null
          brand_name?: string
          category?: string | null
          challenge?: string | null
          created_at?: string
          featured?: boolean
          hero_stat?: string | null
          hero_stat_label?: string | null
          highlights?: string[]
          id?: string
          image_url?: string | null
          metrics?: Json
          overview?: string | null
          published?: boolean
          published_date?: string | null
          results?: string | null
          slug?: string
          solution?: string | null
          sort_order?: number
          source_campaign_id?: string | null
          title?: string
          updated_at?: string
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
          athlete_school: string | null
          athlete_sport: string | null
          bg_position_desktop: string | null
          bg_position_mobile: string | null
          bg_position_tablet: string | null
          brand_id: string | null
          brand_logo_url: string | null
          brand_name: string
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
          published: boolean
          relevance_score: number | null
          sort_order: number
          source_campaign_id: string | null
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
          athlete_school?: string | null
          athlete_sport?: string | null
          bg_position_desktop?: string | null
          bg_position_mobile?: string | null
          bg_position_tablet?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          brand_name: string
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
          published?: boolean
          relevance_score?: number | null
          sort_order?: number
          source_campaign_id?: string | null
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
          athlete_school?: string | null
          athlete_sport?: string | null
          bg_position_desktop?: string | null
          bg_position_mobile?: string | null
          bg_position_tablet?: string | null
          brand_id?: string | null
          brand_logo_url?: string | null
          brand_name?: string
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
          published?: boolean
          relevance_score?: number | null
          sort_order?: number
          source_campaign_id?: string | null
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
      media_files: {
        Row: {
          alt_text: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          folder_id: string | null
          id: string
          mime_type: string | null
          tags: string[] | null
          uploaded_by: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          tags?: string[] | null
          uploaded_by?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          tags?: string[] | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_media_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folders: {
        Row: {
          allowed_types: string[] | null
          athlete_name: string | null
          brand: string | null
          campaign_id: string | null
          created_at: string | null
          id: string
          instructions: string | null
          max_file_size: number | null
          name: string
          share_enabled: boolean | null
          share_token: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_types?: string[] | null
          athlete_name?: string | null
          brand?: string | null
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          instructions?: string | null
          max_file_size?: number | null
          name: string
          share_enabled?: boolean | null
          share_token?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_types?: string[] | null
          athlete_name?: string | null
          brand?: string | null
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          instructions?: string | null
          max_file_size?: number | null
          name?: string
          share_enabled?: boolean | null
          share_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_media_folders_campaign_id_fkey"
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
      page_media: {
        Row: {
          athlete_id: string | null
          caption: string | null
          created_at: string | null
          file_url: string
          id: string
          page_id: string
          section_id: string | null
          sort_order: number | null
          thumbnail_url: string | null
          type: string
        }
        Insert: {
          athlete_id?: string | null
          caption?: string | null
          created_at?: string | null
          file_url: string
          id?: string
          page_id: string
          section_id?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          type: string
        }
        Update: {
          athlete_id?: string | null
          caption?: string | null
          created_at?: string | null
          file_url?: string
          id?: string
          page_id?: string
          section_id?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_media_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "page_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_media_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_media_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_media_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "page_sections"
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
          publication: string | null
          published: boolean
          published_date: string | null
          show_logo: boolean
          slug: string
          sort_order: number
          source_campaign_id: string | null
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
          publication?: string | null
          published?: boolean
          published_date?: string | null
          show_logo?: boolean
          slug: string
          sort_order?: number
          source_campaign_id?: string | null
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
          publication?: string | null
          published?: boolean
          published_date?: string | null
          show_logo?: boolean
          slug?: string
          sort_order?: number
          source_campaign_id?: string | null
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
