// ============================================================
// /board — "THE BOARD" v5 configuration
//
// Sections, source/lane maps, filter predicates, and small helpers.
// Mirrors docs/board-v5-reference.html (the design source of truth).
// ============================================================

import type { BoardTask } from "./types";

// ── Sections (render order) ──
export interface SectionDef {
  key: string;
  num: string;
  title: string;
  accent?: boolean;
}

export const SECTIONS: SectionDef[] = [
  { key: "urgent", num: "01", title: "DO THIS WEEK", accent: true },
  { key: "you", num: "02", title: "WAITING ON YOU" },
  { key: "ready", num: "03", title: "READY TO GO" },
  { key: "flight", num: "04", title: "IN FLIGHT" },
  { key: "shipped", num: "05", title: "SHIPPED — TAILS" },
  { key: "park", num: "06", title: "PARKING LOT" },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);
export const SHIPPED_KEY = "shipped";

// Any legacy/unknown section falls into Parking Lot so a row is never lost.
export function sectionForKey(section: string | null | undefined): string {
  const k = (section || "").trim();
  return SECTION_KEYS.includes(k) ? k : "park";
}

// ── Source platform keys (icon + label) ──
export const SOURCE_KEYS = [
  "slack",
  "gmail",
  "gcal",
  "github",
  "asana",
  "frameio",
  "hub",
  "planning",
] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export const SOURCE_LABEL: Record<SourceKey, string> = {
  slack: "Slack",
  gmail: "Gmail",
  gcal: "Calendar",
  github: "GitHub",
  asana: "Asana",
  frameio: "Frame.io",
  hub: "Hub",
  planning: "Planning",
};

// Normalize a free-form `source` value to a known icon key (default: planning).
export function sourceKey(source: string | null | undefined): SourceKey {
  const k = (source || "").trim().toLowerCase();
  return (SOURCE_KEYS as readonly string[]).includes(k) ? (k as SourceKey) : "planning";
}

// ── Lanes ──
export const LANES = ["BUILD", "CONTENT", "OPS"] as const;

// ── Priority ──
export function isHot(priority: string | null | undefined): boolean {
  const p = (priority || "").toLowerCase();
  return p === "urgent" || p === "high";
}

// ── Court ──
export const COURTS = ["You", "You + me", "Me + Code", "Rolling", "Done", "Later"];

// Filter chips (label + key), matching the v5 reference.
export interface FilterDef {
  key: string;
  label: string;
}
export const FILTERS: FilterDef[] = [
  { key: "all", label: "All" },
  { key: "week", label: "This Week" },
  { key: "you", label: "Waiting on You" },
  { key: "hub", label: "Hub Builds" },
  { key: "content", label: "Content" },
];

// A task counts for "This Week" when it has a due date within the next 7 days.
export function isThisWeek(t: BoardTask): boolean {
  const du = daysUntil(t.due_date);
  return du !== null && du >= 0 && du <= 7;
}

export function matchesFilter(t: BoardTask, filter: string): boolean {
  switch (filter) {
    case "week":
      return isThisWeek(t);
    case "you":
      return t.court === "You" || t.court === "You + me";
    case "hub":
      return (t.lane || "").toUpperCase() === "BUILD";
    case "content":
      return (t.lane || "").toUpperCase() === "CONTENT";
    case "all":
    default:
      return true;
  }
}

// Whole days from local "today" to an ISO yyyy-mm-dd (null if no date).
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// Real Postgame mark (brand-kits bucket) — never typography.
export const POSTGAME_LOGO_URL =
  "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/brand-kits/1774632055938-16gy1u2t.PNG";
