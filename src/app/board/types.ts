// ============================================================
// /board — row type for public.board_tasks (v5 "THE BOARD")
//
// Mirrors the table after the planner's v5 columns were added
// (section / court / timing / next_step / is_agent). No schema is
// owned here — these fields are read/written, never created.
// ============================================================

export interface BoardTask {
  id: string;
  user_id: string;
  title: string;
  detail: string | null; // → card context ("ctx")
  lane: string; // BUILD / CONTENT / OPS
  priority: string; // urgent / high / normal / low  (hot = urgent|high)
  status: string; // legacy free-form; not surfaced in v5
  due_date: string | null; // ISO yyyy-mm-dd → due-soon pulse / stamp
  source: string | null; // platform key for the icon (slack/gmail/…)
  source_url: string | null; // link target for the source chip
  sort_order: number; // order within a section
  created_at: string;
  updated_at: string;

  // v5 columns
  section: string | null; // urgent / you / ready / flight / shipped / park
  court: string | null; // You / You + me / Me + Code / Rolling / Done / Later
  timing: string | null; // free-text timing label
  next_step: string | null; // the "Next Action" note
  is_agent: boolean | null; // show the AGENT deploy flag
}

// Fields editable through the board UI.
export interface TaskDraft {
  title: string;
  detail: string;
  lane: string;
  priority: string;
  section: string;
  court: string;
  timing: string;
  next_step: string;
  due_date: string | null;
  source: string;
  source_url: string;
  is_agent: boolean;
}
