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
  created_at: string;
  updated_at: string;
}

// --- Agent run types ---

export type AgentName =
  | 'creative_director'
  | 'brief_writer'
  | 'editor'
  | 'distributor'
  | 'intake';

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

// --- Creator Brief types ---
// Creator briefs are the videographer-facing "mood board" documents
// generated from approved concepts. They live at public URLs
// like /creator-brief/[slug].

export type CreatorBriefStatus = 'draft' | 'published' | 'archived';

// A contact card — used for Postgame team members and videographers
export interface ShootContact {
  id: string;          // user id or videographer id
  name: string;
  phone: string;
  role: string;        // e.g. "AM", "Producer", "Videographer"
  email?: string;
}

// The shoot logistics section — always appears as the first section
// on a creator brief so the videographer sees it immediately.
export interface ShootLogisticsContent {
  shoot_date: string | null;     // ISO date "2026-06-15"
  shoot_time: string | null;     // e.g. "10:00 AM"
  location: string | null;       // free-text address/venue
  postgame_contacts: ShootContact[];  // up to 2-3 Postgame team members
  videographer: ShootContact | null;  // the assigned videographer
}

// --- Section type definitions for creator brief sections ---

export interface ConceptSectionContent {
  description: string;
  callout?: { title: string; text: string };
}

export interface PhotosSectionContent {
  description: string;
  images: { url: string; caption?: string }[];
}

export interface VideosSectionContent {
  description: string;
  videos: { url: string; caption?: string }[];
}

export interface DeliverablesSectionContent {
  video?: { title: string; count?: string; description: string; orientation?: string };
  photography?: { title: string; minimum?: string; style?: string };
}

export interface ProductReqsSectionContent {
  items: { name: string; requirements: string[] }[];
}

export interface AthleteReqsSectionContent {
  requirements: string[];
  tip?: { title: string; text: string };
}

export interface CreativeDirectionSectionContent {
  tone: string[];
  visual_style: string;
  lighting_notes?: string;
}

export interface CameraSpecsSectionContent {
  video_settings: Record<string, string>;
  photography_settings?: Record<string, string>;
  lens_recommendation?: string;
}

export interface WorkflowSectionContent {
  steps: { number: number; title: string; description: string }[];
}

export interface DosDontsSectionContent {
  dos: string[];
  donts: string[];
}

export interface FileDeliverySectionContent {
  video_specs: Record<string, string>;
  photo_specs?: Record<string, string>;
  delivery_method?: string;
  deadline?: string;
}

// All possible section types
export type CreatorBriefSectionType =
  | 'shoot_logistics'
  | 'concept'
  | 'photos'
  | 'videos'
  | 'deliverables'
  | 'product_reqs'
  | 'athlete_reqs'
  | 'creative_direction'
  | 'camera_specs'
  | 'workflow'
  | 'dos_donts'
  | 'file_delivery';

// A single section in a creator brief
export interface CreatorBriefSection {
  number: string;        // "00", "01", "02", etc.
  title: string;
  type: CreatorBriefSectionType;
  content:
    | ShootLogisticsContent
    | ConceptSectionContent
    | PhotosSectionContent
    | VideosSectionContent
    | DeliverablesSectionContent
    | ProductReqsSectionContent
    | AthleteReqsSectionContent
    | CreativeDirectionSectionContent
    | CameraSpecsSectionContent
    | WorkflowSectionContent
    | DosDontsSectionContent
    | FileDeliverySectionContent;
}

// The full creator brief record from Supabase
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
}

// --- Staff & Videographer types (for dropdown selectors) ---

export interface PostgameStaffMember {
  id: string;
  email: string;
  name: string;        // derived from email or user_metadata
}

export interface Videographer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  schools: string[];
  specialties: string[];
  portfolio_url: string | null;
  is_active: boolean;
}
