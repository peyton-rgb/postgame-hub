// ============================================================
// /board — task-manager configuration
//
// Single source of truth for columns, the legacy→column status
// read-map, canonical status slugs, lanes, and priority styling.
//
// v1 is a PERSONAL board (just the signed-in user). Nothing here
// hardcodes single-user assumptions — widening to a team later is a
// fetch/RLS change, not a rewrite of this file.
// ============================================================

export type ColumnKey =
  | "to_do"
  | "in_progress"
  | "waiting_on_me"
  | "blocked"
  | "done";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
}

// Kanban columns — order matters (left → right).
export const COLUMNS: ColumnDef[] = [
  { key: "to_do", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "waiting_on_me", label: "Waiting on Me" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export const COLUMN_KEYS: ColumnKey[] = COLUMNS.map((c) => c.key);

// Legacy free-form `status` values → column. Applied in the UI only;
// no DB migration. New/edited rows write the canonical ColumnKey slug
// (see statusForColumn), but we keep reading legacy values forever.
const LEGACY_STATUS_MAP: Record<string, ColumnKey> = {
  ready: "to_do",
  scoped: "to_do",
  "spec-ready": "to_do",
  "pr-ready": "to_do",
  housekeeping: "to_do",
  "in-progress": "in_progress",
  "waiting-on-you": "waiting_on_me",
  "needs-design-pick": "waiting_on_me",
  blocked: "blocked",
  done: "done",
};

// Resolve any stored status (canonical slug OR legacy value) to a column.
// Unknown values fall back to To Do so a task is never lost off-board.
export function columnForStatus(status: string | null | undefined): ColumnKey {
  if (!status) return "to_do";
  const raw = status.trim();
  if ((COLUMN_KEYS as string[]).includes(raw)) return raw as ColumnKey;
  const lower = raw.toLowerCase();
  return LEGACY_STATUS_MAP[lower] ?? "to_do";
}

// The canonical value we WRITE when a task lands in a column.
export function statusForColumn(key: ColumnKey): string {
  return key;
}

// ── Lanes (colored tag chip + top-of-board filter) ──
export type Lane = "BUILD" | "CONTENT" | "OPS";

export const LANES: Lane[] = ["BUILD", "CONTENT", "OPS"];

export const LANE_STYLE: Record<Lane, { label: string; color: string; bg: string; border: string }> = {
  BUILD: {
    label: "BUILD",
    color: "#D73F09",
    bg: "rgba(215, 63, 9, 0.14)",
    border: "rgba(215, 63, 9, 0.42)",
  },
  CONTENT: {
    label: "CONTENT",
    color: "#8b7cf6",
    bg: "rgba(139, 124, 246, 0.14)",
    border: "rgba(139, 124, 246, 0.42)",
  },
  OPS: {
    label: "OPS",
    color: "#2dd4a7",
    bg: "rgba(45, 212, 167, 0.13)",
    border: "rgba(45, 212, 167, 0.4)",
  },
};

export function laneStyle(lane: string | null | undefined) {
  const key = (lane || "").toUpperCase() as Lane;
  return LANE_STYLE[key] ?? {
    label: lane || "—",
    color: "rgba(255,255,255,0.55)",
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.14)",
  };
}

// ── Priority (visual treatment on each card) ──
export type Priority = "urgent" | "high" | "normal" | "low";

export const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];

export const PRIORITY_STYLE: Record<Priority, { label: string; color: string; accent: string }> = {
  urgent: { label: "Urgent", color: "#ff4d4d", accent: "#ff4d4d" },
  high: { label: "High", color: "#ff9f45", accent: "#ff9f45" },
  normal: { label: "Normal", color: "rgba(255,255,255,0.55)", accent: "rgba(255,255,255,0.28)" },
  low: { label: "Low", color: "rgba(255,255,255,0.4)", accent: "rgba(255,255,255,0.16)" },
};

export function priorityStyle(priority: string | null | undefined) {
  const key = (priority || "normal").toLowerCase() as Priority;
  return PRIORITY_STYLE[key] ?? PRIORITY_STYLE.normal;
}

// Sort urgent → low for any priority-aware ordering/UX.
export const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};
