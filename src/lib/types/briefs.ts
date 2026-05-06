// ============================================================
// Type definitions for Phase 1 (Briefs) and Phase 2 (Concepts)
// These tell TypeScript exactly what shape our data has,
// so the editor can catch mistakes before they hit production.
// ============================================================

// --- Brief types ---

export type BriefCampaignType =
  | 'standard'
  | 'top_50'
  | 'ambassador_program'
  | 'gifting'
  | 'experiential'
  | 'recap_only';

export type BriefProductionConfig =
  | 'vid_is_editor'
  | 'split_team'
  | 'no_production';

export type BriefStatus =
  | 'draft'
  | 'published'
  | 'in_production'
  | 'complete'
  | 'cancelled';

// The athlete targeting filter — used in the brief form
// to specify what kind of athletes the campaign is looking for
export interface AthleteTargeting {
  sports?: string[];
  genders?: string[];
  schools?: string[];
  follower_tiers?: string[];  // e.g. "micro", "mid", "macro", "mega"
  markets?: string[];
}

// A brief as it comes back from the database
export interface Brief {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  name: string;
  campaign_type: BriefCampaignType;
  start_date: string | null;
  target_launch_date: string | null;
  budget: number | null;
  production_config: BriefProductionConfig;
  brief_content: Record<string, unknown> | null;  // Tiptap JSON
  mandatories: string[];
  restrictions: string[];
  athlete_targeting: AthleteTargeting;
  drive_folder_id: string | null;
  status: BriefStatus;
  version: number;
  parent_brief_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields (sometimes included)
  brand?: { id: string; name: string };
}

// What we send to the server when creating a new brief
export interface CreateBriefInput {
  brand_id: string;
  name: string;
  campaign_type?: BriefCampaignType;
  start_date?: string;
  target_launch_date?: string;
  budget?: number;
  production_config?: BriefProductionConfig;
  brief_content?: Record<string, unknown>;
  mandatories?: string[];
  restrictions?: string[];
  athlete_targeting?: AthleteTargeting;
}

// What we send when updating a draft brief
export interface UpdateBriefInput {
  name?: string;
  campaign_type?: BriefCampaignType;
  start_date?: string;
  target_launch_date?: string;
  budget?: number;
  production_config?: BriefProductionConfig;
  brief_content?: Record<string, unknown>;
  mandatories?: string[];
  restrictions?: string[];
  athlete_targeting?: AthleteTargeting;
}

// --- Concept types ---

export type ConceptProductionScope =
  | 'ugc_only'
  | 'hybrid'
  | 'full_production';

export type ConceptStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'iterating'
  | 'archived';

export type ConceptSource = 'claude' | 'manual';

export interface IterationEntry {
  prompt: string;
  response: string;
  timestamp: string;
}

export interface Concept {
  id: string;
  brief_id: string;
  name: string;
  hook: string;
  athlete_archetype: string | null;
  settings_suggestions: string[];
  inspo_references: string[];  // UUIDs of inspo_items
  production_scope: ConceptProductionScope;
  estimated_assets: number | null;
  status: ConceptStatus;
  rejection_feedback: string | null;
  iteration_history: IterationEntry[];
  generated_by: ConceptSource;
  claude_run_id: string | null;
  // Phase 3: collaborative inputs
  athlete_name: string | null;
  reference_image_urls: string[];
  created_at: string;
  updated_at: string;
}

// CM-supplied creative seed used to bias concept generation (Phase 3).
export interface CreativeSeed {
  name: string;
  description: string;
}

// --- Creator brief types (Phase 3) ---

export type CreatorBriefStatus = 'draft' | 'published' | 'archived';

// Each section is a typed block; the union shape lets the renderer dispatch
// on `type`. Unknown types are safe to ignore.
export type CreatorBriefSection =
  | {
      number: string;
      title: string;
      type: 'concept';
      content: {
        description: string;
        callout?: { title: string; text: string };
      };
    }
  | {
      number: string;
      title: string;
      type: 'photos';
      content: {
        description: string;
        images: { url: string; caption?: string }[];
      };
    }
  | {
      number: string;
      title: string;
      type: 'videos';
      content: {
        description: string;
        videos: { url: string; caption?: string }[];
      };
    }
  | {
      number: string;
      title: string;
      type: 'deliverables';
      content: {
        video?: {
          title: string;
          count: string;
          description: string;
          orientation: string;
        };
        photography?: {
          title: string;
          minimum: string;
          style: string;
        };
      };
    }
  | {
      number: string;
      title: string;
      type: 'product_reqs';
      content: {
        items: { name: string; requirements: string[] }[];
      };
    }
  | {
      number: string;
      title: string;
      type: 'athlete_reqs';
      content: {
        requirements: string[];
        tip?: { title: string; text: string };
      };
    }
  | {
      number: string;
      title: string;
      type: 'creative_direction';
      content: {
        tone: string[];
        visual_style: string;
        lighting_notes: string;
      };
    }
  | {
      number: string;
      title: string;
      type: 'camera_specs';
      content: {
        video_settings: {
          frame_rate: string;
          resolution: string;
          orientation: string;
          stabilization: string;
          color_profile: string;
        };
        photography_settings: {
          format: string;
          shutter_speed: string;
          aperture: string;
          mode: string;
        };
        lens_recommendation: string;
      };
    }
  | {
      number: string;
      title: string;
      type: 'workflow';
      content: {
        steps: { number: number; title: string; description: string }[];
      };
    }
  | {
      number: string;
      title: string;
      type: 'dos_donts';
      content: {
        dos: string[];
        donts: string[];
      };
    }
  | {
      number: string;
      title: string;
      type: 'file_delivery';
      content: {
        video_specs: {
          format: string;
          resolution: string;
          color_profile: string;
        };
        photo_specs: {
          format: string;
          color_grading: string;
        };
        delivery_method: string;
        deadline: string;
      };
    };

export interface CreatorBrief {
  id: string;
  concept_id: string;
  brief_id: string;
  brand_id: string;
  slug: string;
  title: string;
  athlete_name: string | null;
  sections: CreatorBriefSection[];
  reference_images: { url: string; caption?: string }[];
  brand_color: string | null;
  brand_logo_url: string | null;
  status: CreatorBriefStatus;
  published_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  brand?: { id: string; name: string };
  campaign_brief?: { id: string; name: string };
}

// --- Agent run types ---

export type AgentName =
  | 'creative_director'
  | 'editor'
  | 'distributor'
  | 'intake'
  | 'brief_writer';

export type AgentRunStatus = 'running' | 'complete' | 'failed';

export interface AgentRun {
  id: string;
  agent_name: AgentName;
  triggered_by: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown> | null;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  status: AgentRunStatus;
  error_message: string | null;
  created_at: string;
}
