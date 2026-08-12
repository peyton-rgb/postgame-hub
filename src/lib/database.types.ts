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
      _archive_admin_campaigns_staging_20260812: {
        Row: {
          admin_brand: string | null
          admin_created: string | null
          admin_id: string | null
          admin_name: string | null
          brand_norm: string | null
          name_norm: string | null
          sheet_id: string | null
          tracker: string | null
        }
        Insert: {
          admin_brand?: string | null
          admin_created?: string | null
          admin_id?: string | null
          admin_name?: string | null
          brand_norm?: string | null
          name_norm?: string | null
          sheet_id?: string | null
          tracker?: string | null
        }
        Update: {
          admin_brand?: string | null
          admin_created?: string | null
          admin_id?: string | null
          admin_name?: string | null
          brand_norm?: string | null
          name_norm?: string | null
          sheet_id?: string | null
          tracker?: string | null
        }
        Relationships: []
      }
      _brand_color_rollback_20260727: {
        Row: {
          brand_id: string
          name: string | null
          nulled_at: string | null
          old_primary_color: string | null
        }
        Insert: {
          brand_id: string
          name?: string | null
          nulled_at?: string | null
          old_primary_color?: string | null
        }
        Update: {
          brand_id?: string
          name?: string | null
          nulled_at?: string | null
          old_primary_color?: string | null
        }
        Relationships: []
      }
      _deprecated_brand_heroes: {
        Row: {
          brand_id: string
          created_at: string
          focal_x: number
          focal_x_mobile: number | null
          focal_y: number
          focal_y_mobile: number | null
          hero_order: number
          hero_scale: number
          hero_scale_mobile: number | null
          media_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          focal_x?: number
          focal_x_mobile?: number | null
          focal_y?: number
          focal_y_mobile?: number | null
          hero_order?: number
          hero_scale?: number
          hero_scale_mobile?: number | null
          media_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          focal_x?: number
          focal_x_mobile?: number | null
          focal_y?: number
          focal_y_mobile?: number | null
          hero_order?: number
          hero_scale?: number
          hero_scale_mobile?: number | null
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_heroes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_heroes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_heroes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_heroes_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_campaigns: {
        Row: {
          admin_id: number
          brand: string | null
          created_on: string | null
          name: string
          status: string | null
          synced_at: string
        }
        Insert: {
          admin_id: number
          brand?: string | null
          created_on?: string | null
          name: string
          status?: string | null
          synced_at?: string
        }
        Update: {
          admin_id?: number
          brand?: string | null
          created_on?: string | null
          name?: string
          status?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_name: Database["public"]["Enums"]["agent_name"]
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input_payload: Json
          input_tokens: number | null
          model: string
          output_payload: Json | null
          output_tokens: number | null
          status: Database["public"]["Enums"]["agent_run_status"]
          triggered_by: string
        }
        Insert: {
          agent_name: Database["public"]["Enums"]["agent_name"]
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_payload: Json
          input_tokens?: number | null
          model?: string
          output_payload?: Json | null
          output_tokens?: number | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          triggered_by: string
        }
        Update: {
          agent_name?: Database["public"]["Enums"]["agent_name"]
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_payload?: Json
          input_tokens?: number | null
          model?: string
          output_payload?: Json | null
          output_tokens?: number | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          triggered_by?: string
        }
        Relationships: []
      }
      asset_metrics: {
        Row: {
          athlete_name: string | null
          campaign_id: string | null
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
          final_asset_id: string | null
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
          athlete_name?: string | null
          campaign_id?: string | null
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
          final_asset_id?: string | null
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
          athlete_name?: string | null
          campaign_id?: string | null
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
          final_asset_id?: string | null
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
            foreignKeyName: "asset_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_metrics_final_asset_id_fkey"
            columns: ["final_asset_id"]
            isOneToOne: false
            referencedRelation: "final_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_metrics_inspo_item_id_fkey"
            columns: ["inspo_item_id"]
            isOneToOne: true
            referencedRelation: "inspo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_packages: {
        Row: {
          brand_id: string
          campaign_recap_id: string | null
          created_at: string | null
          id: string
          name: string
          roster_label: string | null
          settings: Json | null
          share_token: string
          slug: string
          status: string
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          campaign_recap_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          roster_label?: string | null
          settings?: Json | null
          share_token?: string
          slug: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          campaign_recap_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          roster_label?: string | null
          settings?: Json | null
          share_token?: string
          slug?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_packages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_packages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_packages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "asset_packages_campaign_recap_id_fkey"
            columns: ["campaign_recap_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_packages_campaign_recap_id_fkey"
            columns: ["campaign_recap_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_packages_campaign_recap_id_fkey"
            columns: ["campaign_recap_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_campaign_optins: {
        Row: {
          athlete_id: string
          created_at: string
          drive_folder_id: string | null
          ftc_ack: boolean
          id: string
          optin_campaign_id: string
          status: string
          submission_id: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          drive_folder_id?: string | null
          ftc_ack?: boolean
          id?: string
          optin_campaign_id: string
          status?: string
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          drive_folder_id?: string | null
          ftc_ack?: boolean
          id?: string
          optin_campaign_id?: string
          status?: string
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_campaign_optins_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_campaign_optins_optin_campaign_id_fkey"
            columns: ["optin_campaign_id"]
            isOneToOne: false
            referencedRelation: "optin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_campaign_optins_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "campaign_optin_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_deliverables: {
        Row: {
          approved_at: string | null
          athlete_id: string
          content_type: string | null
          created_at: string
          file_size_bytes: number | null
          file_url: string | null
          id: string
          live_url: string | null
          media_id: string | null
          media_type: string | null
          optin_campaign_id: string
          optin_id: string
          paid_at: string | null
          posted_at: string | null
          review_note: string | null
          slot: string
          status: string
          storage_bucket: string | null
          storage_path: string | null
          thumbnail_url: string | null
          updated_at: string
          uploaded_at: string | null
          verified_at: string | null
        }
        Insert: {
          approved_at?: string | null
          athlete_id: string
          content_type?: string | null
          created_at?: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          live_url?: string | null
          media_id?: string | null
          media_type?: string | null
          optin_campaign_id: string
          optin_id: string
          paid_at?: string | null
          posted_at?: string | null
          review_note?: string | null
          slot: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_at?: string | null
          verified_at?: string | null
        }
        Update: {
          approved_at?: string | null
          athlete_id?: string
          content_type?: string | null
          created_at?: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          live_url?: string | null
          media_id?: string | null
          media_type?: string | null
          optin_campaign_id?: string
          optin_id?: string
          paid_at?: string | null
          posted_at?: string | null
          review_note?: string | null
          slot?: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_deliverables_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_deliverables_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_deliverables_optin_campaign_id_fkey"
            columns: ["optin_campaign_id"]
            isOneToOne: false
            referencedRelation: "optin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_deliverables_optin_id_fkey"
            columns: ["optin_id"]
            isOneToOne: false
            referencedRelation: "athlete_campaign_optins"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_edit_jobs: {
        Row: {
          created_at: string
          deliverable_id: string
          error: string | null
          id: string
          params: Json
          result_url: string | null
          status: string
          suggestion_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deliverable_id: string
          error?: string | null
          id?: string
          params?: Json
          result_url?: string | null
          status?: string
          suggestion_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deliverable_id?: string
          error?: string | null
          id?: string
          params?: Json
          result_url?: string | null
          status?: string
          suggestion_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_edit_jobs_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "athlete_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_edit_jobs_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "edit_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_shipping: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          athlete_id: string
          city: string | null
          hat_size: string | null
          pants_size: string | null
          shirt_size: string | null
          shoe_size: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          athlete_id: string
          city?: string | null
          hat_size?: string | null
          pants_size?: string | null
          shirt_size?: string | null
          shoe_size?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          athlete_id?: string
          city?: string | null
          hat_size?: string | null
          pants_size?: string | null
          shirt_size?: string | null
          shoe_size?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_shipping_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
          person_id: string | null
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
          person_id?: string | null
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
          person_id?: string | null
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
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
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
      banner_videos: {
        Row: {
          brand_name: string | null
          created_at: string | null
          display_name: string
          filename: string
          id: string
          sort_order: number | null
          url: string
        }
        Insert: {
          brand_name?: string | null
          created_at?: string | null
          display_name: string
          filename: string
          id?: string
          sort_order?: number | null
          url: string
        }
        Update: {
          brand_name?: string | null
          created_at?: string | null
          display_name?: string
          filename?: string
          id?: string
          sort_order?: number | null
          url?: string
        }
        Relationships: []
      }
      board_tasks: {
        Row: {
          court: string | null
          created_at: string
          detail: string | null
          due_date: string | null
          id: string
          is_agent: boolean | null
          lane: string
          next_step: string | null
          priority: string
          section: string | null
          sort_order: number
          source: string | null
          source_url: string | null
          status: string
          timing: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          court?: string | null
          created_at?: string
          detail?: string | null
          due_date?: string | null
          id?: string
          is_agent?: boolean | null
          lane?: string
          next_step?: string | null
          priority?: string
          section?: string | null
          sort_order?: number
          source?: string | null
          source_url?: string | null
          status?: string
          timing?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          court?: string | null
          created_at?: string
          detail?: string | null
          due_date?: string | null
          id?: string
          is_agent?: boolean | null
          lane?: string
          next_step?: string | null
          priority?: string
          section?: string | null
          sort_order?: number
          source?: string | null
          source_url?: string | null
          status?: string
          timing?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_aliases: {
        Row: {
          admin_name: string
          brand_id: string
          created_at: string
          id: string
          note: string | null
        }
        Insert: {
          admin_name: string
          brand_id: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Update: {
          admin_name?: string
          brand_id?: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_aliases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_aliases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_aliases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
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
      brand_kit_staging: {
        Row: {
          brand_id: string | null
          brand_name: string
          confidence: string | null
          created_at: string
          current_value: string | null
          field: string
          has_alpha: boolean | null
          id: string
          is_vector: boolean | null
          notes: string | null
          proposed_value: string | null
          render_mode: string | null
          retrieved_at: string
          source_type: string | null
          source_url: string | null
          status: string
        }
        Insert: {
          brand_id?: string | null
          brand_name: string
          confidence?: string | null
          created_at?: string
          current_value?: string | null
          field: string
          has_alpha?: boolean | null
          id?: string
          is_vector?: boolean | null
          notes?: string | null
          proposed_value?: string | null
          render_mode?: string | null
          retrieved_at?: string
          source_type?: string | null
          source_url?: string | null
          status?: string
        }
        Update: {
          brand_id?: string | null
          brand_name?: string
          confidence?: string | null
          created_at?: string
          current_value?: string | null
          field?: string
          has_alpha?: boolean | null
          id?: string
          is_vector?: boolean | null
          notes?: string | null
          proposed_value?: string | null
          render_mode?: string | null
          retrieved_at?: string
          source_type?: string | null
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kit_staging_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_kit_staging_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_kit_staging_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      brands: {
        Row: {
          admin_brand_id: string | null
          approval_settings: Json | null
          archived: boolean
          brand_colors: Json | null
          brand_fonts: Json | null
          brand_guidelines: Json | null
          brand_guidelines_url: string | null
          created_at: string | null
          drive_campaign_subfolder_id: string | null
          drive_parent_folder_id: string | null
          font_primary: string | null
          font_primary_url: string | null
          font_secondary: string | null
          font_secondary_url: string | null
          hero_recap_generated_at: string | null
          hero_recap_prompt: string | null
          hero_recap_video_url: string | null
          id: string
          industry: string | null
          kit_notes: string | null
          logo_dark_url: string | null
          logo_icon_svg_url: string | null
          logo_icon_url: string | null
          logo_light_url: string | null
          logo_mark_url: string | null
          logo_primary_url: string | null
          logo_url: string | null
          logo_white_url: string | null
          name: string
          notes: string | null
          portal_token: string | null
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
          approval_settings?: Json | null
          archived?: boolean
          brand_colors?: Json | null
          brand_fonts?: Json | null
          brand_guidelines?: Json | null
          brand_guidelines_url?: string | null
          created_at?: string | null
          drive_campaign_subfolder_id?: string | null
          drive_parent_folder_id?: string | null
          font_primary?: string | null
          font_primary_url?: string | null
          font_secondary?: string | null
          font_secondary_url?: string | null
          hero_recap_generated_at?: string | null
          hero_recap_prompt?: string | null
          hero_recap_video_url?: string | null
          id?: string
          industry?: string | null
          kit_notes?: string | null
          logo_dark_url?: string | null
          logo_icon_svg_url?: string | null
          logo_icon_url?: string | null
          logo_light_url?: string | null
          logo_mark_url?: string | null
          logo_primary_url?: string | null
          logo_url?: string | null
          logo_white_url?: string | null
          name: string
          notes?: string | null
          portal_token?: string | null
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
          approval_settings?: Json | null
          archived?: boolean
          brand_colors?: Json | null
          brand_fonts?: Json | null
          brand_guidelines?: Json | null
          brand_guidelines_url?: string | null
          created_at?: string | null
          drive_campaign_subfolder_id?: string | null
          drive_parent_folder_id?: string | null
          font_primary?: string | null
          font_primary_url?: string | null
          font_secondary?: string | null
          font_secondary_url?: string | null
          hero_recap_generated_at?: string | null
          hero_recap_prompt?: string | null
          hero_recap_video_url?: string | null
          id?: string
          industry?: string | null
          kit_notes?: string | null
          logo_dark_url?: string | null
          logo_icon_svg_url?: string | null
          logo_icon_url?: string | null
          logo_light_url?: string | null
          logo_mark_url?: string | null
          logo_primary_url?: string | null
          logo_url?: string | null
          logo_white_url?: string | null
          name?: string
          notes?: string | null
          portal_token?: string | null
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
            referencedRelation: "campaigns"
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
      bts_submissions: {
        Row: {
          athlete_name: string
          brand_id: string | null
          campaign_id: string | null
          campaign_name_override: string | null
          created_at: string
          file_mime_type: string | null
          file_size_bytes: number | null
          hold_posting: boolean
          id: string
          original_filename: string | null
          sheet_sync_error: string | null
          sheet_synced_at: string | null
          submitted_at: string
          submitter_name: string | null
          updated_at: string
          video_path: string
          video_url: string
        }
        Insert: {
          athlete_name: string
          brand_id?: string | null
          campaign_id?: string | null
          campaign_name_override?: string | null
          created_at?: string
          file_mime_type?: string | null
          file_size_bytes?: number | null
          hold_posting?: boolean
          id?: string
          original_filename?: string | null
          sheet_sync_error?: string | null
          sheet_synced_at?: string | null
          submitted_at?: string
          submitter_name?: string | null
          updated_at?: string
          video_path: string
          video_url: string
        }
        Update: {
          athlete_name?: string
          brand_id?: string | null
          campaign_id?: string | null
          campaign_name_override?: string | null
          created_at?: string
          file_mime_type?: string | null
          file_size_bytes?: number | null
          hold_posting?: boolean
          id?: string
          original_filename?: string | null
          sheet_sync_error?: string | null
          sheet_synced_at?: string | null
          submitted_at?: string
          submitter_name?: string | null
          updated_at?: string
          video_path?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "bts_submissions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bts_submissions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bts_submissions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "bts_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bts_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bts_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_briefs: {
        Row: {
          athlete_targeting: Json | null
          brand_id: string
          brief_content: Json | null
          budget: number | null
          campaign_id: string | null
          campaign_type: Database["public"]["Enums"]["brief_campaign_type"]
          created_at: string
          created_by: string
          drive_folder_id: string | null
          id: string
          mandatories: string[] | null
          name: string
          parent_brief_id: string | null
          production_config: Database["public"]["Enums"]["brief_production_config"]
          restrictions: string[] | null
          start_date: string | null
          status: Database["public"]["Enums"]["brief_status"]
          target_launch_date: string | null
          updated_at: string
          version: number
        }
        Insert: {
          athlete_targeting?: Json | null
          brand_id: string
          brief_content?: Json | null
          budget?: number | null
          campaign_id?: string | null
          campaign_type?: Database["public"]["Enums"]["brief_campaign_type"]
          created_at?: string
          created_by: string
          drive_folder_id?: string | null
          id?: string
          mandatories?: string[] | null
          name: string
          parent_brief_id?: string | null
          production_config?: Database["public"]["Enums"]["brief_production_config"]
          restrictions?: string[] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          target_launch_date?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          athlete_targeting?: Json | null
          brand_id?: string
          brief_content?: Json | null
          budget?: number | null
          campaign_id?: string | null
          campaign_type?: Database["public"]["Enums"]["brief_campaign_type"]
          created_at?: string
          created_by?: string
          drive_folder_id?: string | null
          id?: string
          mandatories?: string[] | null
          name?: string
          parent_brief_id?: string | null
          production_config?: Database["public"]["Enums"]["brief_production_config"]
          restrictions?: string[] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["brief_status"]
          target_launch_date?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "campaign_briefs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_briefs_parent_brief_id_fkey"
            columns: ["parent_brief_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
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
          admin_created_on: string | null
          admin_synced_at: string | null
          brand_id: string | null
          brief_doc_id: string | null
          brief_url: string | null
          carousel_order: number | null
          client_logo_url: string | null
          client_name: string
          created_at: string | null
          description: string | null
          drive_folder_id: string | null
          featured: boolean | null
          grid_order: number | null
          hero_image_url: string | null
          hero_recap_generated_at: string | null
          hero_recap_prompt: string | null
          hero_recap_video_url: string | null
          homepage_featured: boolean
          homepage_order: number | null
          id: string
          media_type: string | null
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
          thumbnail_url: string | null
          tracker_sheet_id: string | null
          tracker_url: string | null
          type: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          admin_campaign_id?: string | null
          admin_created_on?: string | null
          admin_synced_at?: string | null
          brand_id?: string | null
          brief_doc_id?: string | null
          brief_url?: string | null
          carousel_order?: number | null
          client_logo_url?: string | null
          client_name: string
          created_at?: string | null
          description?: string | null
          drive_folder_id?: string | null
          featured?: boolean | null
          grid_order?: number | null
          hero_image_url?: string | null
          hero_recap_generated_at?: string | null
          hero_recap_prompt?: string | null
          hero_recap_video_url?: string | null
          homepage_featured?: boolean
          homepage_order?: number | null
          id?: string
          media_type?: string | null
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
          thumbnail_url?: string | null
          tracker_sheet_id?: string | null
          tracker_url?: string | null
          type?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          admin_campaign_id?: string | null
          admin_created_on?: string | null
          admin_synced_at?: string | null
          brand_id?: string | null
          brief_doc_id?: string | null
          brief_url?: string | null
          carousel_order?: number | null
          client_logo_url?: string | null
          client_name?: string
          created_at?: string | null
          description?: string | null
          drive_folder_id?: string | null
          featured?: boolean | null
          grid_order?: number | null
          hero_image_url?: string | null
          hero_recap_generated_at?: string | null
          hero_recap_prompt?: string | null
          hero_recap_video_url?: string | null
          homepage_featured?: boolean
          homepage_order?: number | null
          id?: string
          media_type?: string | null
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
          thumbnail_url?: string | null
          tracker_sheet_id?: string | null
          tracker_url?: string | null
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
          athlete_id: string | null
          campaign_id: string
          content_approved: boolean | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          id: string
          ig_followers: number | null
          ig_handle: string | null
          import_note: string | null
          imported_at: string | null
          last_name: string | null
          metrics: Json | null
          notes: string | null
          post_type: string | null
          post_url: string | null
          role: string | null
          school: string | null
          source_row: number | null
          sport: string | null
          tier: string | null
          tiktok_followers: number | null
          tiktok_handle: string | null
        }
        Insert: {
          athlete_id?: string | null
          campaign_id: string
          content_approved?: boolean | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          ig_followers?: number | null
          ig_handle?: string | null
          import_note?: string | null
          imported_at?: string | null
          last_name?: string | null
          metrics?: Json | null
          notes?: string | null
          post_type?: string | null
          post_url?: string | null
          role?: string | null
          school?: string | null
          source_row?: number | null
          sport?: string | null
          tier?: string | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
        }
        Update: {
          athlete_id?: string | null
          campaign_id?: string
          content_approved?: boolean | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          ig_followers?: number | null
          ig_handle?: string | null
          import_note?: string | null
          imported_at?: string | null
          last_name?: string | null
          metrics?: Json | null
          notes?: string | null
          post_type?: string | null
          post_url?: string | null
          role?: string | null
          school?: string | null
          source_row?: number | null
          sport?: string | null
          tier?: string | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_rosters_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_rosters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_rosters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_rosters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      case_studies: {
        Row: {
          athlete_names: string[] | null
          banner_video_urls: string[] | null
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
          banner_video_urls?: string[] | null
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
          banner_video_urls?: string[] | null
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
            referencedRelation: "campaigns"
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
      collab_container_athletes: {
        Row: {
          athlete_id: string
          container_id: string
          created_at: string
          id: string
          included: boolean
        }
        Insert: {
          athlete_id: string
          container_id: string
          created_at?: string
          id?: string
          included?: boolean
        }
        Update: {
          athlete_id?: string
          container_id?: string
          created_at?: string
          id?: string
          included?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "collab_container_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_container_athletes_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "collab_containers"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_containers: {
        Row: {
          campaign_id: string
          created_at: string
          drive_folder_id: string | null
          id: string
          platform: string | null
          post_url: string | null
          school: string | null
          source: string
          sport: string | null
          team_name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          platform?: string | null
          post_url?: string | null
          school?: string | null
          source?: string
          sport?: string | null
          team_name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          platform?: string | null
          post_url?: string | null
          school?: string | null
          source?: string
          sport?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_containers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_containers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_containers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          city: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          state: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id: number
          is_active?: boolean | null
          name: string
          state?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          state?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      concepts: {
        Row: {
          athlete_archetype: string | null
          athlete_name: string | null
          brief_id: string
          claude_run_id: string | null
          created_at: string
          estimated_assets: number | null
          generated_by: Database["public"]["Enums"]["concept_source"]
          hook: string
          id: string
          inspo_references: string[] | null
          iteration_history: Json | null
          name: string
          production_scope: Database["public"]["Enums"]["concept_production_scope"]
          reference_image_urls: Json | null
          rejection_feedback: string | null
          settings_suggestions: string[] | null
          status: Database["public"]["Enums"]["concept_status"]
          updated_at: string
        }
        Insert: {
          athlete_archetype?: string | null
          athlete_name?: string | null
          brief_id: string
          claude_run_id?: string | null
          created_at?: string
          estimated_assets?: number | null
          generated_by?: Database["public"]["Enums"]["concept_source"]
          hook: string
          id?: string
          inspo_references?: string[] | null
          iteration_history?: Json | null
          name: string
          production_scope?: Database["public"]["Enums"]["concept_production_scope"]
          reference_image_urls?: Json | null
          rejection_feedback?: string | null
          settings_suggestions?: string[] | null
          status?: Database["public"]["Enums"]["concept_status"]
          updated_at?: string
        }
        Update: {
          athlete_archetype?: string | null
          athlete_name?: string | null
          brief_id?: string
          claude_run_id?: string | null
          created_at?: string
          estimated_assets?: number | null
          generated_by?: Database["public"]["Enums"]["concept_source"]
          hook?: string
          id?: string
          inspo_references?: string[] | null
          iteration_history?: Json | null
          name?: string
          production_scope?: Database["public"]["Enums"]["concept_production_scope"]
          reference_image_urls?: Json | null
          rejection_feedback?: string | null
          settings_suggestions?: string[] | null
          status?: Database["public"]["Enums"]["concept_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concepts_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_claude_run_id_fkey"
            columns: ["claude_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_evaluations: {
        Row: {
          athlete_id: string | null
          compliance_flags: string[]
          compliance_pass: boolean
          created_at: string
          dedupe_group: number | null
          deliverable_id: string
          evaluated_at: string | null
          id: string
          is_preliminary: boolean
          is_top_pick: boolean
          model: string | null
          optin_campaign_id: string | null
          overall_score: number | null
          rank: number | null
          rationale: string | null
          scores: Json | null
        }
        Insert: {
          athlete_id?: string | null
          compliance_flags?: string[]
          compliance_pass?: boolean
          created_at?: string
          dedupe_group?: number | null
          deliverable_id: string
          evaluated_at?: string | null
          id?: string
          is_preliminary?: boolean
          is_top_pick?: boolean
          model?: string | null
          optin_campaign_id?: string | null
          overall_score?: number | null
          rank?: number | null
          rationale?: string | null
          scores?: Json | null
        }
        Update: {
          athlete_id?: string | null
          compliance_flags?: string[]
          compliance_pass?: boolean
          created_at?: string
          dedupe_group?: number | null
          deliverable_id?: string
          evaluated_at?: string | null
          id?: string
          is_preliminary?: boolean
          is_top_pick?: boolean
          model?: string | null
          optin_campaign_id?: string | null
          overall_score?: number | null
          rank?: number | null
          rationale?: string | null
          scores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "content_evaluations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_evaluations_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: true
            referencedRelation: "athlete_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_evaluations_optin_campaign_id_fkey"
            columns: ["optin_campaign_id"]
            isOneToOne: false
            referencedRelation: "optin_campaigns"
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
          athlete_name: string | null
          campaign_id: string | null
          caption: string | null
          channel: string
          created_at: string | null
          created_by: string | null
          final_asset_id: string | null
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
          athlete_name?: string | null
          campaign_id?: string | null
          caption?: string | null
          channel: string
          created_at?: string | null
          created_by?: string | null
          final_asset_id?: string | null
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
          athlete_name?: string | null
          campaign_id?: string | null
          caption?: string | null
          channel?: string
          created_at?: string | null
          created_by?: string | null
          final_asset_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "content_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_queue_final_asset_id_fkey"
            columns: ["final_asset_id"]
            isOneToOne: false
            referencedRelation: "final_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          athlete_id: string
          brand_id: string
          campaign_id: string
          contract_type: string | null
          created_at: string
          id: string
          optin_id: string | null
          pdf_storage_path: string | null
          signed_at: string | null
          status: string
          title: string
        }
        Insert: {
          athlete_id: string
          brand_id: string
          campaign_id: string
          contract_type?: string | null
          created_at?: string
          id?: string
          optin_id?: string | null
          pdf_storage_path?: string | null
          signed_at?: string | null
          status?: string
          title: string
        }
        Update: {
          athlete_id?: string
          brand_id?: string
          campaign_id?: string
          contract_type?: string | null
          created_at?: string
          id?: string
          optin_id?: string | null
          pdf_storage_path?: string | null
          signed_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "contracts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_optin_id_fkey"
            columns: ["optin_id"]
            isOneToOne: false
            referencedRelation: "athlete_campaign_optins"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_briefs: {
        Row: {
          athlete_name: string | null
          athlete_photo_focal_point: string | null
          athlete_photo_url: string | null
          athlete_profile: Json | null
          brand_color: string | null
          brand_id: string
          brand_logo_url: string | null
          brief_id: string
          concept_id: string
          created_at: string
          created_by: string
          drive_folder_id: string | null
          id: string
          location: string | null
          location_2: string | null
          postgame_contacts: Json | null
          published_at: string | null
          reference_images: Json | null
          sections: Json
          shoot_date: string | null
          shoot_time: string | null
          slug: string
          status: Database["public"]["Enums"]["creator_brief_status"]
          title: string
          updated_at: string
          videographer: Json | null
        }
        Insert: {
          athlete_name?: string | null
          athlete_photo_focal_point?: string | null
          athlete_photo_url?: string | null
          athlete_profile?: Json | null
          brand_color?: string | null
          brand_id: string
          brand_logo_url?: string | null
          brief_id: string
          concept_id: string
          created_at?: string
          created_by: string
          drive_folder_id?: string | null
          id?: string
          location?: string | null
          location_2?: string | null
          postgame_contacts?: Json | null
          published_at?: string | null
          reference_images?: Json | null
          sections?: Json
          shoot_date?: string | null
          shoot_time?: string | null
          slug: string
          status?: Database["public"]["Enums"]["creator_brief_status"]
          title: string
          updated_at?: string
          videographer?: Json | null
        }
        Update: {
          athlete_name?: string | null
          athlete_photo_focal_point?: string | null
          athlete_photo_url?: string | null
          athlete_profile?: Json | null
          brand_color?: string | null
          brand_id?: string
          brand_logo_url?: string | null
          brief_id?: string
          concept_id?: string
          created_at?: string
          created_by?: string
          drive_folder_id?: string | null
          id?: string
          location?: string | null
          location_2?: string | null
          postgame_contacts?: Json | null
          published_at?: string | null
          reference_images?: Json | null
          sections?: Json
          shoot_date?: string | null
          shoot_time?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["creator_brief_status"]
          title?: string
          updated_at?: string
          videographer?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "public_pages"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "creator_briefs_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_briefs_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
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
            referencedRelation: "campaigns"
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
      deliverable_assets: {
        Row: {
          created_at: string
          deliverable_id: string
          drive_file_id: string | null
          duration_seconds: number | null
          edit_job_id: string | null
          file_size_bytes: number | null
          file_url: string
          height: number | null
          id: string
          mime_type: string | null
          position: number
          role: string
          submission_id: string | null
          thumbnail_url: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          deliverable_id: string
          drive_file_id?: string | null
          duration_seconds?: number | null
          edit_job_id?: string | null
          file_size_bytes?: number | null
          file_url: string
          height?: number | null
          id?: string
          mime_type?: string | null
          position?: number
          role?: string
          submission_id?: string | null
          thumbnail_url?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          deliverable_id?: string
          drive_file_id?: string | null
          duration_seconds?: number | null
          edit_job_id?: string | null
          file_size_bytes?: number | null
          file_url?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          position?: number
          role?: string
          submission_id?: string | null
          thumbnail_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_assets_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "package_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_assets_edit_job_id_fkey"
            columns: ["edit_job_id"]
            isOneToOne: false
            referencedRelation: "edit_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_assets_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "tier3_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_jobs: {
        Row: {
          actual_cost_usd: number | null
          approved_by: string | null
          asset_id: string | null
          content_type: string
          created_at: string | null
          created_by: string
          edit_plan: Json | null
          estimated_cost_usd: number | null
          id: string
          instruction: string
          output_thumbnail_url: string | null
          output_url: string | null
          parent_job_id: string | null
          processing_time_seconds: number | null
          reference_image_url: string | null
          scene_map: Json | null
          source_url: string
          status: string
          submission_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_cost_usd?: number | null
          approved_by?: string | null
          asset_id?: string | null
          content_type: string
          created_at?: string | null
          created_by: string
          edit_plan?: Json | null
          estimated_cost_usd?: number | null
          id?: string
          instruction: string
          output_thumbnail_url?: string | null
          output_url?: string | null
          parent_job_id?: string | null
          processing_time_seconds?: number | null
          reference_image_url?: string | null
          scene_map?: Json | null
          source_url: string
          status?: string
          submission_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_cost_usd?: number | null
          approved_by?: string | null
          asset_id?: string | null
          content_type?: string
          created_at?: string | null
          created_by?: string
          edit_plan?: Json | null
          estimated_cost_usd?: number | null
          id?: string
          instruction?: string
          output_thumbnail_url?: string | null
          output_url?: string | null
          parent_job_id?: string | null
          processing_time_seconds?: number | null
          reference_image_url?: string | null
          scene_map?: Json | null
          source_url?: string
          status?: string
          submission_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edit_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "inspo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "edit_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_jobs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "tier3_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_steps: {
        Row: {
          action: string
          completed_at: string | null
          cost_usd: number | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          edit_job_id: string | null
          error_message: string | null
          external_job_id: string | null
          external_provider: string | null
          id: string
          input_url: string | null
          output_url: string | null
          params: Json | null
          started_at: string | null
          status: string
          step_number: number
          tool: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          edit_job_id?: string | null
          error_message?: string | null
          external_job_id?: string | null
          external_provider?: string | null
          id?: string
          input_url?: string | null
          output_url?: string | null
          params?: Json | null
          started_at?: string | null
          status?: string
          step_number: number
          tool: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          edit_job_id?: string | null
          error_message?: string | null
          external_job_id?: string | null
          external_provider?: string | null
          id?: string
          input_url?: string | null
          output_url?: string | null
          params?: Json | null
          started_at?: string | null
          status?: string
          step_number?: number
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_steps_edit_job_id_fkey"
            columns: ["edit_job_id"]
            isOneToOne: false
            referencedRelation: "edit_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_suggestions: {
        Row: {
          cost_credits: number | null
          created_at: string
          deliverable_id: string
          detail: string | null
          evaluation_id: string | null
          id: string
          kind: string
          severity: string
          status: string
          submission_id: string | null
          summary: string
        }
        Insert: {
          cost_credits?: number | null
          created_at?: string
          deliverable_id: string
          detail?: string | null
          evaluation_id?: string | null
          id?: string
          kind: string
          severity?: string
          status?: string
          submission_id?: string | null
          summary: string
        }
        Update: {
          cost_credits?: number | null
          created_at?: string
          deliverable_id?: string
          detail?: string | null
          evaluation_id?: string | null
          id?: string
          kind?: string
          severity?: string
          status?: string
          submission_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_suggestions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "athlete_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_suggestions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "content_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_suggestions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "tier3_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      final_assets: {
        Row: {
          asset_type: string
          athlete_name: string | null
          brand_name: string | null
          campaign_id: string | null
          concept_id: string | null
          created_at: string | null
          created_by: string | null
          creator_brief_id: string | null
          delivered_at: string | null
          delivered_to: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          file_url: string
          height: number | null
          id: string
          notes: string | null
          review_session_id: string | null
          status: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          width: number | null
        }
        Insert: {
          asset_type?: string
          athlete_name?: string | null
          brand_name?: string | null
          campaign_id?: string | null
          concept_id?: string | null
          created_at?: string | null
          created_by?: string | null
          creator_brief_id?: string | null
          delivered_at?: string | null
          delivered_to?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          file_url: string
          height?: number | null
          id?: string
          notes?: string | null
          review_session_id?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          asset_type?: string
          athlete_name?: string | null
          brand_name?: string | null
          campaign_id?: string | null
          concept_id?: string | null
          created_at?: string | null
          created_by?: string | null
          creator_brief_id?: string | null
          delivered_at?: string | null
          delivered_to?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          file_url?: string
          height?: number | null
          id?: string
          notes?: string | null
          review_session_id?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "final_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_assets_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_assets_creator_brief_id_fkey"
            columns: ["creator_brief_id"]
            isOneToOne: false
            referencedRelation: "creator_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_assets_review_session_id_fkey"
            columns: ["review_session_id"]
            isOneToOne: false
            referencedRelation: "review_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      house_checklist_items: {
        Row: {
          active: boolean
          applies_to: string[]
          category: string
          created_at: string
          id: string
          is_hard_gate: boolean
          rule: string
          sort_order: number
          weight: number
        }
        Insert: {
          active?: boolean
          applies_to?: string[]
          category: string
          created_at?: string
          id?: string
          is_hard_gate?: boolean
          rule: string
          sort_order?: number
          weight?: number
        }
        Update: {
          active?: boolean
          applies_to?: string[]
          category?: string
          created_at?: string
          id?: string
          is_hard_gate?: boolean
          rule?: string
          sort_order?: number
          weight?: number
        }
        Relationships: []
      }
      inspo_items: {
        Row: {
          action_description: string | null
          approved_at: string | null
          approved_by: string | null
          athlete_id: string | null
          athlete_name: string | null
          athlete_tier: number | null
          brand_approval_status: string | null
          brand_approved_at: string | null
          brand_approved_by: string | null
          brand_feedback: string | null
          brand_id: string | null
          brief_fit: string[] | null
          camera_model: string | null
          campaign_id: string | null
          clip_end_seconds: number | null
          clip_start_seconds: number | null
          codec: string | null
          color_space: string | null
          content_freshness:
            | Database["public"]["Enums"]["content_freshness_enum"]
            | null
          content_quality: string | null
          content_type: Database["public"]["Enums"]["content_type_enum"]
          context_tags: Json | null
          created_at: string | null
          drive_file_id: string | null
          drive_folder_path: string | null
          duration_seconds: number | null
          editing_status: string | null
          editor_name: string | null
          embedding: string | null
          fetch_status: string | null
          file_size_bytes: number | null
          file_url: string | null
          format: string | null
          frame_rate: string | null
          id: string
          is_atomic_clip: boolean | null
          is_hero: boolean | null
          live_url: string | null
          mime_type: string | null
          mood_tags: Json | null
          notes: string | null
          parent_asset_id: string | null
          people_count: number | null
          performance_tier:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform: string | null
          pro_tags: Json | null
          production_config:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          resolution: string | null
          rights_expiry: string | null
          scene_setting: string | null
          school: string | null
          search_phrases: string[] | null
          shot_type: string | null
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
          action_description?: string | null
          approved_at?: string | null
          approved_by?: string | null
          athlete_id?: string | null
          athlete_name?: string | null
          athlete_tier?: number | null
          brand_approval_status?: string | null
          brand_approved_at?: string | null
          brand_approved_by?: string | null
          brand_feedback?: string | null
          brand_id?: string | null
          brief_fit?: string[] | null
          camera_model?: string | null
          campaign_id?: string | null
          clip_end_seconds?: number | null
          clip_start_seconds?: number | null
          codec?: string | null
          color_space?: string | null
          content_freshness?:
            | Database["public"]["Enums"]["content_freshness_enum"]
            | null
          content_quality?: string | null
          content_type?: Database["public"]["Enums"]["content_type_enum"]
          context_tags?: Json | null
          created_at?: string | null
          drive_file_id?: string | null
          drive_folder_path?: string | null
          duration_seconds?: number | null
          editing_status?: string | null
          editor_name?: string | null
          embedding?: string | null
          fetch_status?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          format?: string | null
          frame_rate?: string | null
          id?: string
          is_atomic_clip?: boolean | null
          is_hero?: boolean | null
          live_url?: string | null
          mime_type?: string | null
          mood_tags?: Json | null
          notes?: string | null
          parent_asset_id?: string | null
          people_count?: number | null
          performance_tier?:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform?: string | null
          pro_tags?: Json | null
          production_config?:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          resolution?: string | null
          rights_expiry?: string | null
          scene_setting?: string | null
          school?: string | null
          search_phrases?: string[] | null
          shot_type?: string | null
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
          action_description?: string | null
          approved_at?: string | null
          approved_by?: string | null
          athlete_id?: string | null
          athlete_name?: string | null
          athlete_tier?: number | null
          brand_approval_status?: string | null
          brand_approved_at?: string | null
          brand_approved_by?: string | null
          brand_feedback?: string | null
          brand_id?: string | null
          brief_fit?: string[] | null
          camera_model?: string | null
          campaign_id?: string | null
          clip_end_seconds?: number | null
          clip_start_seconds?: number | null
          codec?: string | null
          color_space?: string | null
          content_freshness?:
            | Database["public"]["Enums"]["content_freshness_enum"]
            | null
          content_quality?: string | null
          content_type?: Database["public"]["Enums"]["content_type_enum"]
          context_tags?: Json | null
          created_at?: string | null
          drive_file_id?: string | null
          drive_folder_path?: string | null
          duration_seconds?: number | null
          editing_status?: string | null
          editor_name?: string | null
          embedding?: string | null
          fetch_status?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          format?: string | null
          frame_rate?: string | null
          id?: string
          is_atomic_clip?: boolean | null
          is_hero?: boolean | null
          live_url?: string | null
          mime_type?: string | null
          mood_tags?: Json | null
          notes?: string | null
          parent_asset_id?: string | null
          people_count?: number | null
          performance_tier?:
            | Database["public"]["Enums"]["performance_tier_enum"]
            | null
          platform?: string | null
          pro_tags?: Json | null
          production_config?:
            | Database["public"]["Enums"]["production_config_enum"]
            | null
          resolution?: string | null
          rights_expiry?: string | null
          scene_setting?: string | null
          school?: string | null
          search_phrases?: string[] | null
          shot_type?: string | null
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
          content_type: string | null
          created_at: string | null
          drive_file_id: string | null
          file_size_bytes: number | null
          file_url: string
          focal_x: number | null
          focal_y: number | null
          hero_order: number | null
          hero_render_look: string | null
          hero_rendered_url: string | null
          hero_scale: number | null
          hero_source: string
          id: string
          is_hero: boolean | null
          is_video_thumbnail: boolean | null
          phash: string | null
          quality_score: number | null
          resolution: string | null
          slot: string | null
          sort_order: number | null
          source_id: string | null
          source_system: string | null
          storage_bucket: string | null
          storage_path: string | null
          thumbnail_url: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          athlete_id?: string | null
          campaign_id: string
          content_type?: string | null
          created_at?: string | null
          drive_file_id?: string | null
          file_size_bytes?: number | null
          file_url: string
          focal_x?: number | null
          focal_y?: number | null
          hero_order?: number | null
          hero_render_look?: string | null
          hero_rendered_url?: string | null
          hero_scale?: number | null
          hero_source?: string
          id?: string
          is_hero?: boolean | null
          is_video_thumbnail?: boolean | null
          phash?: string | null
          quality_score?: number | null
          resolution?: string | null
          slot?: string | null
          sort_order?: number | null
          source_id?: string | null
          source_system?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string | null
          campaign_id?: string
          content_type?: string | null
          created_at?: string | null
          drive_file_id?: string | null
          file_size_bytes?: number | null
          file_url?: string
          focal_x?: number | null
          focal_y?: number | null
          hero_order?: number | null
          hero_render_look?: string | null
          hero_rendered_url?: string | null
          hero_scale?: number | null
          hero_source?: string
          id?: string
          is_hero?: boolean | null
          is_video_thumbnail?: boolean | null
          phash?: string | null
          quality_score?: number | null
          resolution?: string | null
          slot?: string | null
          sort_order?: number | null
          source_id?: string | null
          source_system?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
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
            referencedRelation: "campaigns"
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
      media_athletes: {
        Row: {
          athlete_id: string
          created_at: string | null
          id: string
          media_id: string
          role: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string | null
          id?: string
          media_id: string
          role?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string | null
          id?: string
          media_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_athletes_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_campaigns: {
        Row: {
          campaign_recap_id: string
          created_at: string | null
          display_order: number | null
          id: string
          media_id: string
          section: string | null
        }
        Insert: {
          campaign_recap_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          media_id: string
          section?: string | null
        }
        Update: {
          campaign_recap_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          media_id?: string
          section?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_campaigns_campaign_recap_id_fkey"
            columns: ["campaign_recap_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_campaigns_campaign_recap_id_fkey"
            columns: ["campaign_recap_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_campaigns_campaign_recap_id_fkey"
            columns: ["campaign_recap_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_campaigns_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
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
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link_url: string | null
          message: string | null
          notification_type: string
          related_campaign_id: string | null
          related_task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          message?: string | null
          notification_type?: string
          related_campaign_id?: string | null
          related_task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          message?: string | null
          notification_type?: string
          related_campaign_id?: string | null
          related_task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_campaign_id_fkey"
            columns: ["related_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_campaign_id_fkey"
            columns: ["related_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_campaign_id_fkey"
            columns: ["related_campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          required_deliverables: string[] | null
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
          required_deliverables?: string[] | null
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
          required_deliverables?: string[] | null
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
      package_deliverables: {
        Row: {
          caption: string | null
          created_at: string
          hashtags: string[] | null
          id: string
          link_sticker_url: string | null
          live_url: string | null
          mentions: string[] | null
          notes: string | null
          package_id: string
          position: number
          posted_at: string | null
          slot: string
          status: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          link_sticker_url?: string | null
          live_url?: string | null
          mentions?: string[] | null
          notes?: string | null
          package_id: string
          position?: number
          posted_at?: string | null
          slot: string
          status?: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          link_sticker_url?: string | null
          live_url?: string | null
          mentions?: string[] | null
          notes?: string | null
          package_id?: string
          position?: number
          posted_at?: string | null
          slot?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_deliverables_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "posting_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_talent: {
        Row: {
          created_at: string | null
          id: string
          name: string
          package_id: string
          slug: string | null
          sort_order: number | null
          status: string | null
          subtext: string | null
          tag_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          package_id: string
          slug?: string | null
          sort_order?: number | null
          status?: string | null
          subtext?: string | null
          tag_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          package_id?: string
          slug?: string | null
          sort_order?: number | null
          status?: string | null
          subtext?: string | null
          tag_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_talent_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "asset_packages"
            referencedColumns: ["id"]
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
      payouts: {
        Row: {
          amount_cents: number | null
          amount_label: string | null
          athlete_id: string
          created_at: string
          currency: string
          id: string
          optin_campaign_id: string
          optin_id: string
          paid_at: string | null
          paypal_email: string | null
          provider: string
          provider_ref: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          amount_label?: string | null
          athlete_id: string
          created_at?: string
          currency?: string
          id?: string
          optin_campaign_id: string
          optin_id: string
          paid_at?: string | null
          paypal_email?: string | null
          provider?: string
          provider_ref?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          amount_label?: string | null
          athlete_id?: string
          created_at?: string
          currency?: string
          id?: string
          optin_campaign_id?: string
          optin_id?: string
          paid_at?: string | null
          paypal_email?: string | null
          provider?: string
          provider_ref?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_optin_campaign_id_fkey"
            columns: ["optin_campaign_id"]
            isOneToOne: false
            referencedRelation: "optin_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_optin_id_fkey"
            columns: ["optin_id"]
            isOneToOne: true
            referencedRelation: "athlete_campaign_optins"
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
      people: {
        Row: {
          admin_created_at: string | null
          admin_profile_id: number | null
          admin_user_id: number
          college_city: string | null
          college_id: number | null
          college_raw: string | null
          college_state: string | null
          college_zip: string | null
          device: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          hometown_city: string | null
          hometown_state: string | null
          id: string
          imported_at: string | null
          instagram_followers: number | null
          instagram_handle: string | null
          is_active: boolean | null
          is_archived: boolean | null
          is_international: boolean | null
          last_name: string | null
          nil_value: number | null
          nil_value_synced_at: string | null
          person_type: string | null
          phone: string | null
          rating: string | null
          roster_status: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_state: string | null
          shipping_zip: string | null
          sport: string | null
          tiktok_followers: number | null
          tiktok_handle: string | null
        }
        Insert: {
          admin_created_at?: string | null
          admin_profile_id?: number | null
          admin_user_id: number
          college_city?: string | null
          college_id?: number | null
          college_raw?: string | null
          college_state?: string | null
          college_zip?: string | null
          device?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          hometown_city?: string | null
          hometown_state?: string | null
          id?: string
          imported_at?: string | null
          instagram_followers?: number | null
          instagram_handle?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_international?: boolean | null
          last_name?: string | null
          nil_value?: number | null
          nil_value_synced_at?: string | null
          person_type?: string | null
          phone?: string | null
          rating?: string | null
          roster_status?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          sport?: string | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
        }
        Update: {
          admin_created_at?: string | null
          admin_profile_id?: number | null
          admin_user_id?: number
          college_city?: string | null
          college_id?: number | null
          college_raw?: string | null
          college_state?: string | null
          college_zip?: string | null
          device?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          hometown_city?: string | null
          hometown_state?: string | null
          id?: string
          imported_at?: string | null
          instagram_followers?: number | null
          instagram_handle?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_international?: boolean | null
          last_name?: string | null
          nil_value?: number | null
          nil_value_synced_at?: string | null
          person_type?: string | null
          phone?: string | null
          rating?: string | null
          roster_status?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          sport?: string | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_collage_athletes: {
        Row: {
          athlete_name: string
          brand_name: string
          created_at: string | null
          cutout_image_url: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          sport: string
        }
        Insert: {
          athlete_name: string
          brand_name: string
          created_at?: string | null
          cutout_image_url?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          sport: string
        }
        Update: {
          athlete_name?: string
          brand_name?: string
          created_at?: string | null
          cutout_image_url?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          sport?: string
        }
        Relationships: []
      }
      pitch_opportunities: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      pitch_page_opportunities: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          opportunity_id: string
          pitch_page_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          opportunity_id: string
          pitch_page_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          opportunity_id?: string
          pitch_page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_page_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "pitch_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_page_opportunities_pitch_page_id_fkey"
            columns: ["pitch_page_id"]
            isOneToOne: false
            referencedRelation: "pitch_pages"
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
      pitch_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          sections: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: []
      }
      postgame_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      posting_packages: {
        Row: {
          am_notes: string | null
          athlete_id: string | null
          athlete_name: string
          brief_id: string | null
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
          brief_id?: string | null
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
          brief_id?: string | null
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
            foreignKeyName: "posting_packages_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
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
            referencedRelation: "campaigns"
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
      profiles: {
        Row: {
          avatar_url: string | null
          class_year: string | null
          created_at: string | null
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          ig_handle: string | null
          onboarded_at: string | null
          paypal_email: string | null
          paypal_linked: boolean
          reach_synced_at: string | null
          reach_total: number | null
          role: string
          school: string | null
          sport: string | null
          tiktok_handle: string | null
          updated_at: string | null
          w9_status: string | null
          w9_year: number | null
        }
        Insert: {
          avatar_url?: string | null
          class_year?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          ig_handle?: string | null
          onboarded_at?: string | null
          paypal_email?: string | null
          paypal_linked?: boolean
          reach_synced_at?: string | null
          reach_total?: number | null
          role?: string
          school?: string | null
          sport?: string | null
          tiktok_handle?: string | null
          updated_at?: string | null
          w9_status?: string | null
          w9_year?: number | null
        }
        Update: {
          avatar_url?: string | null
          class_year?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          ig_handle?: string | null
          onboarded_at?: string | null
          paypal_email?: string | null
          paypal_linked?: boolean
          reach_synced_at?: string | null
          reach_total?: number | null
          role?: string
          school?: string | null
          sport?: string | null
          tiktok_handle?: string | null
          updated_at?: string | null
          w9_status?: string | null
          w9_year?: number | null
        }
        Relationships: []
      }
      recap_intake_flags: {
        Row: {
          campaign_id: string | null
          flagged_at: string
          item_id: string
          reasons: string | null
        }
        Insert: {
          campaign_id?: string | null
          flagged_at?: string
          item_id: string
          reasons?: string | null
        }
        Update: {
          campaign_id?: string | null
          flagged_at?: string
          item_id?: string
          reasons?: string | null
        }
        Relationships: []
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
          athlete_name: string | null
          brand_decided_at: string | null
          brand_decision: string | null
          brand_token: string | null
          brief_id: string | null
          campaign_id: string | null
          created_at: string | null
          creator_brief_id: string | null
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
          athlete_name?: string | null
          brand_decided_at?: string | null
          brand_decision?: string | null
          brand_token?: string | null
          brief_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          creator_brief_id?: string | null
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
          athlete_name?: string | null
          brand_decided_at?: string | null
          brand_decision?: string | null
          brand_token?: string | null
          brief_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          creator_brief_id?: string | null
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
            foreignKeyName: "review_sessions_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "campaign_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_sessions_creator_brief_id_fkey"
            columns: ["creator_brief_id"]
            isOneToOne: false
            referencedRelation: "creator_briefs"
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
      school_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          school_name: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          school_name: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          school_name?: string
        }
        Relationships: []
      }
      slot_assignments: {
        Row: {
          created_at: string | null
          device_overrides: Json | null
          enabled: boolean | null
          file_url: string | null
          focal_x: number | null
          focal_y: number | null
          hero_render_look: string | null
          hero_rendered_url: string | null
          hero_source: string
          id: string
          logo_url: string | null
          media_id: string | null
          position: number
          recap_id: string | null
          scale: number | null
          scope_id: string | null
          slot_key: string
          text_value: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_overrides?: Json | null
          enabled?: boolean | null
          file_url?: string | null
          focal_x?: number | null
          focal_y?: number | null
          hero_render_look?: string | null
          hero_rendered_url?: string | null
          hero_source?: string
          id?: string
          logo_url?: string | null
          media_id?: string | null
          position?: number
          recap_id?: string | null
          scale?: number | null
          scope_id?: string | null
          slot_key: string
          text_value?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_overrides?: Json | null
          enabled?: boolean | null
          file_url?: string | null
          focal_x?: number | null
          focal_y?: number | null
          hero_render_look?: string | null
          hero_rendered_url?: string | null
          hero_source?: string
          id?: string
          logo_url?: string | null
          media_id?: string | null
          position?: number
          recap_id?: string | null
          scale?: number | null
          scope_id?: string | null
          slot_key?: string
          text_value?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slot_assignments_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_recap_id_fkey"
            columns: ["recap_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_recap_id_fkey"
            columns: ["recap_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_recap_id_fkey"
            columns: ["recap_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string | null
          account_type: string
          athlete_name: string | null
          created_at: string
          id: string
          ig_user_id: string | null
          ig_username: string | null
          is_active: boolean
          notes: string | null
          page_id: string | null
          platform: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_type?: string
          athlete_name?: string | null
          created_at?: string
          id?: string
          ig_user_id?: string | null
          ig_username?: string | null
          is_active?: boolean
          notes?: string | null
          page_id?: string | null
          platform: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_type?: string
          athlete_name?: string | null
          created_at?: string
          id?: string
          ig_user_id?: string | null
          ig_username?: string | null
          is_active?: boolean
          notes?: string | null
          page_id?: string | null
          platform?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      squad_invites: {
        Row: {
          id: string
          invited_at: string
          invitee_contact: string | null
          invitee_name: string
          inviter_id: string
          joined_at: string | null
          joined_profile_id: string | null
          status: string
        }
        Insert: {
          id?: string
          invited_at?: string
          invitee_contact?: string | null
          invitee_name: string
          inviter_id: string
          joined_at?: string | null
          joined_profile_id?: string | null
          status?: string
        }
        Update: {
          id?: string
          invited_at?: string
          invitee_contact?: string | null
          invitee_name?: string
          inviter_id?: string
          joined_at?: string | null
          joined_profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_invites_joined_profile_id_fkey"
            columns: ["joined_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_links: {
        Row: {
          active: boolean
          brief_url: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          deliverables: number | null
          expires_at: string | null
          max_files: number
          min_photos: number
          min_videos: number
          revoked_at: string | null
          sent_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brief_url?: string | null
          campaign_id: string
          created_at?: string
          created_by?: string | null
          deliverables?: number | null
          expires_at?: string | null
          max_files?: number
          min_photos?: number
          min_videos?: number
          revoked_at?: string | null
          sent_at?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brief_url?: string | null
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          deliverables?: number | null
          expires_at?: string | null
          max_files?: number
          min_photos?: number
          min_videos?: number
          revoked_at?: string | null
          sent_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          ack_instructions_at: string
          ack_music_at: string
          athlete_first_name: string
          athlete_folder_id: string | null
          athlete_id: string | null
          athlete_last_name: string
          campaign_id: string
          chased_at: string | null
          created_at: string
          email: string | null
          id: string
          ig_handle: string
          phone: string | null
          school: string | null
          submission_link_token: string
          submitted_at: string
          submitter_type: string
          updated_at: string
          videographer_ig: string | null
          videographer_name: string | null
        }
        Insert: {
          ack_instructions_at: string
          ack_music_at: string
          athlete_first_name: string
          athlete_folder_id?: string | null
          athlete_id?: string | null
          athlete_last_name: string
          campaign_id: string
          chased_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ig_handle: string
          phone?: string | null
          school?: string | null
          submission_link_token: string
          submitted_at?: string
          submitter_type?: string
          updated_at?: string
          videographer_ig?: string | null
          videographer_name?: string | null
        }
        Update: {
          ack_instructions_at?: string
          ack_music_at?: string
          athlete_first_name?: string
          athlete_folder_id?: string | null
          athlete_id?: string | null
          athlete_last_name?: string
          campaign_id?: string
          chased_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ig_handle?: string
          phone?: string | null
          school?: string | null
          submission_link_token?: string
          submitted_at?: string
          submitter_type?: string
          updated_at?: string
          videographer_ig?: string | null
          videographer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_submission_link_token_fkey"
            columns: ["submission_link_token"]
            isOneToOne: false
            referencedRelation: "submission_links"
            referencedColumns: ["token"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          task_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          file_class: string | null
          file_name: string | null
          file_size_bytes: number | null
          form_response_id: string | null
          id: string
          ig_handle: string | null
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
          submission_id: string | null
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
          file_class?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          form_response_id?: string | null
          id?: string
          ig_handle?: string | null
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
          submission_id?: string | null
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
          file_class?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          form_response_id?: string | null
          id?: string
          ig_handle?: string | null
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
          submission_id?: string | null
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
            referencedRelation: "campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier3_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier3_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
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
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier3_submissions_recap_id_fkey"
            columns: ["recap_id"]
            isOneToOne: false
            referencedRelation: "public_campaign_recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier3_submissions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_render_jobs: {
        Row: {
          athlete_name: string
          created_at: string
          error: string | null
          id: string
          links: Json
          status: string
          updated_at: string
        }
        Insert: {
          athlete_name: string
          created_at?: string
          error?: string | null
          id?: string
          links?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_name?: string
          created_at?: string
          error?: string | null
          id?: string
          links?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      videographer_details: {
        Row: {
          agency: string | null
          cost_max: number | null
          cost_min: number | null
          cost_raw: string | null
          is_editor: boolean | null
          notes: string | null
          person_id: string
          total_paid: number | null
          will_travel: boolean | null
        }
        Insert: {
          agency?: string | null
          cost_max?: number | null
          cost_min?: number | null
          cost_raw?: string | null
          is_editor?: boolean | null
          notes?: string | null
          person_id: string
          total_paid?: number | null
          will_travel?: boolean | null
        }
        Update: {
          agency?: string | null
          cost_max?: number | null
          cost_min?: number | null
          cost_raw?: string | null
          is_editor?: boolean | null
          notes?: string | null
          person_id?: string
          total_paid?: number | null
          will_travel?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "videographer_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      videographer_upload_links: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          optin_campaign_id: string
          revoked: boolean
          token: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          optin_campaign_id: string
          revoked?: boolean
          token: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          optin_campaign_id?: string
          revoked?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "videographer_upload_links_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videographer_upload_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videographer_upload_links_optin_campaign_id_fkey"
            columns: ["optin_campaign_id"]
            isOneToOne: false
            referencedRelation: "optin_campaigns"
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
      campaigns: {
        Row: {
          brand_id: string | null
          client_name: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          hero_image_url: string | null
          id: string | null
          media_type: string | null
          name: string | null
          public_sections: Json | null
          published: boolean | null
          settings: Json | null
          slug: string | null
          status: string | null
          tags: string[] | null
          thumbnail_url: string | null
          type: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          brand_id?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          hero_image_url?: string | null
          id?: string | null
          media_type?: string | null
          name?: string | null
          public_sections?: Json | null
          published?: boolean | null
          settings?: Json | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          brand_id?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          hero_image_url?: string | null
          id?: string | null
          media_type?: string | null
          name?: string | null
          public_sections?: Json | null
          published?: boolean | null
          settings?: Json | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          type?: string | null
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
      recap_card_cover: {
        Row: {
          campaign_id: string | null
          cover_url: string | null
        }
        Relationships: [
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
            referencedRelation: "campaigns"
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
    }
    Functions: {
      is_postgame_staff: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      match_inspo_items: {
        Args: {
          filter_brand_id?: string
          filter_content_type?: string
          filter_performance_tier?: string
          filter_source?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          athlete_name: string
          brand_id: string
          brief_fit: string[]
          campaign_id: string
          content_type: string
          context_tags: Json
          created_at: string
          file_url: string
          id: string
          performance_tier: string
          pro_tags: Json
          school: string
          search_phrases: string[]
          similarity: number
          social_tags: Json
          source: string
          sport: string
          tagging_status: string
          thumbnail_url: string
          triage_status: string
          visual_description: string
        }[]
      }
      resolve_brand: { Args: { p_admin_name: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      agent_name:
        | "creative_director"
        | "editor"
        | "distributor"
        | "intake"
        | "brief_writer"
        | "video_evaluator"
        | "edit_planner"
        | "editing_orchestrator"
      agent_run_status: "running" | "complete" | "failed"
      brief_campaign_type:
        | "standard"
        | "top_50"
        | "ambassador_program"
        | "gifting"
        | "experiential"
        | "recap_only"
      brief_production_config: "vid_is_editor" | "split_team" | "no_production"
      brief_status:
        | "draft"
        | "published"
        | "in_production"
        | "complete"
        | "cancelled"
      concept_production_scope: "ugc_only" | "hybrid" | "full_production"
      concept_source: "claude" | "manual"
      concept_status:
        | "proposed"
        | "approved"
        | "rejected"
        | "iterating"
        | "archived"
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
      creator_brief_status: "draft" | "published" | "archived"
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
      agent_name: [
        "creative_director",
        "editor",
        "distributor",
        "intake",
        "brief_writer",
        "video_evaluator",
        "edit_planner",
        "editing_orchestrator",
      ],
      agent_run_status: ["running", "complete", "failed"],
      brief_campaign_type: [
        "standard",
        "top_50",
        "ambassador_program",
        "gifting",
        "experiential",
        "recap_only",
      ],
      brief_production_config: ["vid_is_editor", "split_team", "no_production"],
      brief_status: [
        "draft",
        "published",
        "in_production",
        "complete",
        "cancelled",
      ],
      concept_production_scope: ["ugc_only", "hybrid", "full_production"],
      concept_source: ["claude", "manual"],
      concept_status: [
        "proposed",
        "approved",
        "rejected",
        "iterating",
        "archived",
      ],
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
      creator_brief_status: ["draft", "published", "archived"],
      performance_tier_enum: ["top", "solid", "learning", "unscored"],
      production_config_enum: ["vid_is_editor", "split_team"],
    },
  },
} as const
