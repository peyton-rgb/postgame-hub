// ============================================================
// Types for the AI Editing Pipeline
//
// These types define the data structures flowing through the
// 5-step editing pipeline:
//   1. User Input  → EditJob
//   2. The Brain   → SceneMap (Gemini output)
//   3. Edit Plan   → EditDecisionList (Claude output)
//   4. The Hands   → EditStep execution records
//   5. Output      → Updated EditJob with output_url
// ============================================================

// --- Status enums ---

/** Where the edit job is in the pipeline */
export type EditJobStatus =
  | 'pending'      // just created, waiting to start
  | 'analyzing'    // Gemini is watching the video
  | 'planning'     // Claude is building the edit plan
  | 'confirming'   // waiting for CM to approve cost/plan
  | 'editing'      // orchestrator is executing steps
  | 'review'       // done editing, waiting for human review
  | 'approved'     // CM approved the result
  | 'rejected'     // CM rejected
  | 'failed';      // something broke

/** Where an individual edit step is */
export type EditStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

// --- Action & Tool types ---

/** Every kind of edit action the system can perform */
export type EditAction =
  | 'object_removal'      // remove logos, people, objects from video
  | 'background_replace'  // swap out the background
  | 'background_remove'   // remove background (transparent/white)
  | 'style_transfer'      // change visual style / color grade
  | 'video_generation'    // generate new video from text prompt
  | 'cut'                 // remove a segment of video
  | 'trim'                // keep only a time range
  | 'resize'              // change aspect ratio
  | 'overlay_text'        // add text overlays
  | 'overlay_image'       // add watermarks, logos, graphics
  | 'color_adjust'        // brightness, contrast, saturation, LUT
  | 'speed_change'        // slow-mo or speed-up
  | 'audio_strip'         // remove audio
  | 'format_convert'      // change container/codec
  | 'generative_fill'     // AI-fill removed areas (images)
  | 'image_expand';       // extend image canvas with AI

/** Which external tool handles the action */
export type EditTool =
  | 'ffmpeg'       // free, deterministic video edits
  | 'void'         // Netflix VOID via Replicate — video object removal
  | 'firefly'      // Adobe Firefly — image AI edits
  | 'higgsfield';  // Higgsfield AI — video generation & transformation

// --- Gemini Scene Map (Step 2 output) ---

/** A single object detected within a scene */
export interface SceneObject {
  label: string;
  type: 'logo' | 'person' | 'text' | 'object' | 'background' | 'clothing' | 'equipment';
  location: string;
  visible_from: string;   // timestamp HH:MM:SS
  visible_to: string;
  bounding_box_estimate?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

/** A single scene in the video, identified by Gemini */
export interface Scene {
  scene_id: number;
  start_time: string;     // HH:MM:SS
  end_time: string;
  description: string;
  subjects: string[];     // references to subjects map keys
  objects: SceneObject[];
  camera_motion: string;
  lighting: string;
}

/** A tracked subject (person, animal, etc.) across scenes */
export interface Subject {
  description: string;
  appears_in_scenes: number[];
}

/** Full output from Gemini video analysis */
export interface SceneMap {
  duration_seconds: number;
  resolution: string;
  fps: number;
  scenes: Scene[];
  subjects: Record<string, Subject>;
}

// --- Edit Decision List (Step 3 output) ---

/** One step in the edit plan */
export interface EDLStep {
  step_id: number;
  action: EditAction;
  tool: EditTool;
  description: string;
  params: Record<string, unknown>;
  depends_on: number[];   // step_ids that must complete first
}

/** The full edit plan produced by Claude */
export interface EditDecisionList {
  edit_job_id: string;
  steps: EDLStep[];
  estimated_duration_minutes: number;
  estimated_cost_usd: number;
  warnings: string[];
}

// --- Database row types ---

/** A row from the edit_jobs table */
export interface EditJob {
  id: string;
  asset_id: string | null;
  source_url: string;
  content_type: 'video' | 'image';
  instruction: string;
  reference_image_url: string | null;
  status: EditJobStatus;
  scene_map: SceneMap | null;
  edit_plan: EditDecisionList | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  processing_time_seconds: number | null;
  output_url: string | null;
  output_thumbnail_url: string | null;
  parent_job_id: string | null;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A row from the edit_steps table */
export interface EditStep {
  id: string;
  edit_job_id: string;
  step_number: number;
  action: string;
  tool: string;
  description: string | null;
  params: Record<string, unknown> | null;
  status: EditStepStatus;
  input_url: string | null;
  output_url: string | null;
  error_message: string | null;
  cost_usd: number | null;
  duration_seconds: number | null;
  external_job_id: string | null;
  external_provider: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// --- Tool wrapper return types ---

/** What a tool wrapper returns after processing */
export interface ToolResult {
  success: boolean;
  output_url: string | null;
  cost_usd: number;
  duration_seconds: number;
  external_job_id?: string;
  error?: string;
}

/** Input to the video evaluator agent */
export interface VideoEvaluatorInput {
  edit_job_id: string;
  source_url: string;
  content_type: 'video' | 'image';
  instruction: string;
}

/** Input to the edit planner agent */
export interface EditPlannerInput {
  edit_job_id: string;
  instruction: string;
  scene_map: SceneMap;
  content_type: 'video' | 'image';
  reference_image_url?: string;
}

/** What the full pipeline returns */
export interface EditPipelineResult {
  success: boolean;
  job_id: string;
  output_url?: string;
  error?: string;
}
