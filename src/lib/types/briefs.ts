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
