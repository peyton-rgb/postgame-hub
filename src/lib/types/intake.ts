// ============================================================
// Type definitions for Station 1 — Content Intake System
//
// This covers two things:
//   1. Footage ingest & tag — uploading raw footage/photos,
//      tagging them with Claude Vision across 13 categories,
//      and storing them in the inspo_items table (the brain's memory).
//   2. Brief intake — parsing a raw brief PDF/doc into structured
//      campaign_briefs fields using the Intake agent.
//
// The 13 tag categories come from the Blueprint v2.
// They're split across three JSONB columns in inspo_items:
//   - pro_tags: technical/production tags
//   - social_tags: social media & audience tags
//   - context_tags: content & context tags
// Plus search_phrases (text[]) for vibe words and
// visual_description (text) for Claude's written description.
// ============================================================

// --- Pro Tags (technical/production) ---
// These describe HOW the content was shot

export interface ProTags {
  camera_movement: string[];    // e.g. "handheld", "dolly", "static", "tracking", "drone"
  lighting: string[];           // e.g. "golden_hour", "studio", "natural", "neon", "overcast"
  lens_shot_type: string[];     // e.g. "wide", "close_up", "medium", "overhead", "macro"
  grade_post_style: string[];   // e.g. "warm_film", "clean_digital", "desaturated", "high_contrast"
}

// --- Social Tags (social media & audience) ---
// These describe how the content FEELS on social platforms

export interface SocialTags {
  trend_format: string[];       // e.g. "get_ready_with_me", "day_in_life", "transition", "outfit_check"
  platform_feel: string[];      // e.g. "tiktok_native", "ig_editorial", "youtube_cinematic"
  audience_energy: string[];    // e.g. "hype", "chill", "aspirational", "relatable", "bold"
}

// --- Context Tags (content & context) ---
// These describe WHAT the content is about

export interface ContextTags {
  sport: string[];              // e.g. "football", "basketball", "soccer", "track", "volleyball"
  setting: string[];            // e.g. "campus", "gym", "outdoor_court", "studio", "urban"
  product_category: string[];   // e.g. "footwear", "apparel", "equipment", "food_bev", "tech"
  athlete_identity: string[];   // e.g. "solo", "duo", "team", "lifestyle", "action"
  content_purpose: string[];    // e.g. "brand_campaign", "bts", "product_showcase", "lifestyle"
}

// --- The full tag output from Claude Vision ---

export interface IntakeTagResult {
  pro_tags: ProTags;
  social_tags: SocialTags;
  context_tags: ContextTags;
  vibe_words: string[];         // stored in search_phrases column
  visual_description: string;   // Claude's written description of the content
  brief_fit: string[];          // what kind of briefs this content could serve
}

// --- Tagging status for inspo_items ---

export type TaggingStatus = 'pending' | 'processing' | 'tagged' | 'failed' | 'reviewed';

// --- Content type and source enums (match the DB enums) ---

export type ContentType =
  | 'produced'
  | 'athlete_ugc'
  | 'bts'
  | 'raw_footage'
  | 'photography'
  | 'talking_head'
  | 'inspo_external';

export type ContentSource =
  | 'inspo'
  | 'produced_catalog'
  | 'live_athlete_post';

// --- An inspo_items row as it comes back from the database ---

export interface InspoItem {
  id: string;
  created_at: string;
  updated_at: string;
  brand_id: string | null;
  campaign_id: string | null;
  athlete_id: string | null;
  athlete_name: string | null;
  school: string | null;
  sport: string | null;
  content_type: ContentType;
  source: ContentSource;
  file_url: string | null;
  drive_file_id: string | null;
  drive_folder_path: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  format: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  videographer_id: string | null;
  videographer_name: string | null;
  editor_name: string | null;
  production_config: string | null;
  tech_notes: string | null;
  rights_expiry: string | null;
  content_freshness: 'evergreen' | 'timely' | 'expired' | null;
  is_hero: boolean;
  visual_description: string | null;
  pro_tags: ProTags;
  social_tags: SocialTags;
  context_tags: ContextTags;
  search_phrases: string[];
  brief_fit: string[];
  embedding: number[] | null;
  performance_tier: 'top' | 'solid' | 'learning' | 'unscored' | null;
  live_url: string | null;
  platform: string | null;
  parent_asset_id: string | null;
  clip_start_seconds: number | null;
  clip_end_seconds: number | null;
  is_atomic_clip: boolean | null;
  tagging_status: TaggingStatus;
  triage_status: string | null;
  notes: string | null;
}

// --- What we send when creating a new inspo_item from an upload ---

export interface CreateInspoItemInput {
  content_type: ContentType;
  source: ContentSource;
  file_url: string;
  thumbnail_url?: string;
  mime_type: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  format?: string;
  brand_id?: string;
  campaign_id?: string;
  athlete_name?: string;
  sport?: string;
  school?: string;
  tagging_status?: TaggingStatus;
}

// --- Brief parsing result (what the Intake agent extracts from a PDF/doc) ---

export interface ParsedBriefFields {
  name: string;                            // extracted campaign/brief name
  campaign_type: string | null;            // best guess at the campaign type
  brand_name: string | null;               // brand mentioned in the brief
  campaign_goal: string | null;            // what the brand wants to achieve
  deliverables: string[];                  // list of required deliverables
  vibe_descriptors: string[];              // tone/mood words
  mandatories: string[];                   // must-include items
  restrictions: string[];                  // do-not-mention items
  deadlines: Record<string, string>;       // key dates found
  athlete_notes: string | null;            // any athlete preferences mentioned
  budget_notes: string | null;             // any budget info found
  color_palette: string[];                 // brand colors mentioned
  raw_summary: string;                     // Claude's plain-English summary
  confidence_flags: ConfidenceFlag[];      // things Claude wasn't sure about
}

// When Claude can't confidently extract a field, it flags it
export interface ConfidenceFlag {
  field: string;        // which field has low confidence
  reason: string;       // why (e.g. "brief mentions 'flexible budget' but no number")
  suggestion: string;   // what the AM should check
}
