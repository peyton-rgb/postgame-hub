// ============================================================
// /board — row type for public.board_tasks
//
// Mirrors the existing table (no schema changes). `source` /
// `source_url` are carried through untouched (some rows are created
// by other tooling); the UI reads them but v1 only surfaces a link.
// ============================================================

export interface BoardTask {
  id: string;
  user_id: string;
  title: string;
  detail: string | null;
  lane: string;
  priority: string;
  status: string;
  due_date: string | null; // ISO date (yyyy-mm-dd)
  source: string | null;
  source_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Fields a user can edit through the board UI.
export interface TaskDraft {
  title: string;
  detail: string;
  lane: string;
  priority: string;
  status: string; // canonical ColumnKey slug
  due_date: string | null;
}
