// ============================================================
// Types for the AI editing pipeline.
//
// This file is the contract between the UI, the API routes, and
// the agent code. The integration code (ffmpeg/gemini/orchestrator)
// is being written by the Cowork session and will plug into these
// shapes — until then, the API routes return 501 and the UI runs
// in a degraded state.
// ============================================================

// --- Status enums ---

export type EditJobStatus =
  | 'pending'      // job created, nothing started yet
  | 'analyzing'    // video evaluator is running (Gemini scene-mapping)
  | 'planning'     // edit planner is running (Claude EDL generation)
  | 'confirming'   // plan ready, awaiting CM approval before execution
  | 'editing'      // orchestrator is running tools
  | 'review'       // execution complete, output ready for human review
  | 'approved'     // CM approved the result
  | 'rejected'     // CM rejected the result
  | 'failed';      // unrecoverable error during pipeline

export type EditStepStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'skipped';

// --- Tools + actions ---

export type EditTool = 'ffmpeg' | 'void' | 'higgsfield' | 'firefly';

// Sixteen supported edit actions. ffmpeg covers the 9 deterministic ones;
// the rest are dispatched to AI tools (void/higgsfield/firefly) via MCP.
export type EditAction =
  // FFmpeg (deterministic)
  | 'cut'
  | 'trim'
  | 'resize'
  | 'overlay_text'
  | 'overlay_image'
  | 'color_adjust'
  | 'speed_change'
  | 'audio_strip'
  | 'format_convert'
  // AI tool dispatch
  | 'generate_image'
  | 'generate_video'
  | 'video_inpaint'
  | 'remove_background'
  | 'add_music'
  | 'voiceover'
  | 'transition';

// --- Scene mapping (Video Evaluator output) ---

export interface Scene {
  index: number;
  start_time: number;        // seconds
  end_time: number;          // seconds
  description: string;       // free-text summary of what's happening
  visual_tags?: string[];
  audio_tags?: string[];
  shot_type?: string;        // wide / medium / close / etc.
  notable_objects?: string[];
}

export interface SceneMap {
  duration_seconds: number;
  resolution?: string;       // e.g. "1920x1080"
  frame_rate?: number;
  scenes: Scene[];
  global_notes?: string;     // anything that spans the whole clip
}

// --- Edit Decision List (Edit Planner output) ---

export interface EDLStep {
  id: string;                // local id, used to express dependencies
  step_number: number;       // sequential ordering hint
  action: EditAction;
  tool: EditTool;
  description: string;       // human-readable summary shown in the UI
  params: Record<string, unknown>;
  depends_on: string[];      // ids of EDLSteps that must finish first
  estimated_cost_usd?: number;
}

export interface EditDecisionList {
  steps: EDLStep[];
  estimated_total_cost_usd: number;
  notes?: string;
}

// --- DB rows ---

export type ContentType = 'video' | 'image';

export interface EditJob {
  id: string;
  asset_id: string | null;        // links to inspo_items if from library
  source_url: string;             // input file URL
  content_type: ContentType;
  instruction: string;            // CM's free-text "what they want"
  reference_image_url: string | null;
  status: EditJobStatus;
  scene_map: SceneMap | null;
  edit_plan: EditDecisionList | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  output_url: string | null;
  parent_job_id: string | null;   // set when this job is a "request changes" iteration
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EditStep {
  id: string;
  edit_job_id: string;
  step_number: number;
  action: EditAction;
  tool: EditTool;
  description: string;
  params: Record<string, unknown>;
  status: EditStepStatus;
  input_url: string | null;
  output_url: string | null;
  error_message: string | null;
  cost_usd: number | null;
  duration_seconds: number | null;
  external_job_id: string | null;     // remote job id for void/higgsfield/etc.
  external_provider: EditTool | null;
  created_at: string;
  updated_at: string;
}

// --- Tool I/O contracts ---

export interface ToolResult {
  output_url?: string;
  cost_usd?: number;
  duration_seconds?: number;
  external_job_id?: string;
  external_provider?: EditTool;
  // The orchestrator pauses on this sentinel when waiting for an
  // async MCP-driven tool to finish.
  awaiting_mcp?: boolean;
  metadata?: Record<string, unknown>;
}

export interface VideoEvaluatorInput {
  job_id: string;
  source_url: string;
  content_type: ContentType;
  instruction: string;
  reference_image_url?: string | null;
}

export interface EditPlannerInput {
  job_id: string;
  scene_map: SceneMap;
  instruction: string;
  reference_image_url?: string | null;
  // Iteration context — present when this is a "request changes" run.
  prior_plan?: EditDecisionList;
  change_request?: string;
}
