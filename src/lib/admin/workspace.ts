// ============================================================
// Workspace (/admin home) queries — server only.
//
// One table: the open campaigns, who runs them, where they are and
// the next checklist step. Everything is read from the blended
// `campaigns` table joined to `brands` and `people`; optional columns
// (stage, due_date, director_person_id) and the checklist table are
// feature-detected so the screen is honest before any migration adds
// them: a missing column shows "—", never a made-up value.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/admin/auth";
import { BRAND_COLUMNS } from "@/lib/admin/campaigns/queries";
import type { BrandLite, PersonLite } from "@/lib/admin/campaigns/types";

type Db = SupabaseClient<any, "public", any>;

/** The 23-step campaign checklist (the ops team's Asana template), in order. */
export const CHECKLIST = [
  "Campaign created in admin",
  "Internal kickoff brief",
  "Kickoff call",
  "SOW complete, link in Slack channel",
  "Athlete contract, admin updated",
  "Campaign brief from brand",
  "Timeline to brand",
  "Coming soon card in app",
  "Opt-in page created, linked in admin",
  "Update card to opt-in",
  "Athlete selection to brand",
  "Instructions page created, linked in admin",
  "Instruction page to brand for review",
  "Athlete intro video created and posted",
  "Athletes locked in",
  "Send invoice",
  "Affiliate links created",
  "Creative brief for videographers",
  "Product timeline, delivery to athletes",
  "Weekly touchbase invite sent",
  "Metrics",
  "Final metrics",
  "Recap",
] as const;

/** Campaign stages in pipeline order (the Asana board's sections). */
export const STAGES = [
  "NEW DEAL",
  "CREATIVE BRIEF",
  "ATHLETE SELECTION",
  "RECRUITING",
  "CONTENT & POSTING",
  "TRACKING",
  "RECAP",
  "COMPLETE",
] as const;

export function stageLabel(s: string | null): string {
  if (!s) return "No stage";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function stageTone(s: string | null): "ok" | "info" | "muted" {
  if (s === "CONTENT & POSTING" || s === "TRACKING") return "ok";
  if (s === "NEW DEAL") return "info";
  return "muted";
}

export function stageIndex(s: string | null): number {
  const i = s ? (STAGES as readonly string[]).indexOf(s) : -1;
  return i < 0 ? STAGES.length : i;
}

/** "bad" = past due, "warn" = due within 7 days, "" = later / none. */
export function dueTone(due: string | null, today = new Date()): "bad" | "warn" | "" {
  if (!due) return "";
  const d = new Date(due + (due.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return "";
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
  const days = (d.getTime() - t0) / 864e5;
  return days < 0 ? "bad" : days <= 7 ? "warn" : "";
}

// ------------------------------------------------------------
// Staff (the "Viewing as" list)
// ------------------------------------------------------------

export interface StaffMember {
  id: string;
  label: string;
  email: string | null;
  level: string;
}

export interface StaffList {
  staff: StaffMember[];
  /** true = neither user_roles nor profiles.access_level is available */
  pending: boolean;
}

const levelLabel = (l: string | null | undefined) =>
  l === "exec" ? "Exec" : l === "admin" ? "Admin" : l === "staff" ? "Staff" : "Staff";

export async function loadStaff(supabase: Db): Promise<StaffList> {
  // Preferred: a user_roles table (role per login), if the Hub has one.
  const roles = await supabase
    .from("user_roles")
    .select("user_id, role, profile:profiles!user_id(id, full_name, display_name, email)")
    .limit(200);
  if (!roles.error && roles.data) {
    type R = {
      user_id: string;
      role: string | null;
      profile: { id: string; full_name: string | null; display_name: string | null; email: string | null } | null;
    };
    const staff = (roles.data as unknown as R[])
      .filter((r) => r.profile && r.role !== "athlete" && r.role !== "brand")
      .map((r) => ({
        id: r.profile!.id,
        label: (r.profile!.full_name || r.profile!.display_name || r.profile!.email || r.profile!.id).trim(),
        email: r.profile!.email,
        level: r.role ? r.role.charAt(0).toUpperCase() + r.role.slice(1) : "Staff",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (staff.length) return { staff, pending: false };
  }

  // Otherwise: profiles with a staff-or-above access level (migration 022).
  const profs = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email, access_level")
    .in("access_level", ["staff", "admin", "exec"])
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(200);
  if (profs.error) {
    if (isMissingSchemaError(profs.error)) return { staff: [], pending: true };
    return { staff: [], pending: false };
  }
  type P = { id: string; full_name: string | null; display_name: string | null; email: string | null; access_level: string | null };
  const staff = ((profs.data ?? []) as P[]).map((p) => ({
    id: p.id,
    label: (p.full_name || p.display_name || p.email || p.id).trim(),
    email: p.email,
    level: levelLabel(p.access_level),
  }));
  return { staff, pending: false };
}

/** people.id values that belong to a staff login (matched by email). */
export async function loadPersonIdsForEmail(supabase: Db, email: string | null): Promise<string[]> {
  if (!email) return [];
  const { data, error } = await supabase.from("people").select("id").ilike("email", email.trim()).limit(20);
  if (error || !data) return [];
  return (data as { id: string }[]).map((p) => p.id);
}

// ------------------------------------------------------------
// Open campaigns
// ------------------------------------------------------------

export interface WorkspaceRow {
  id: number;
  name: string;
  brand: BrandLite | null;
  manager: PersonLite | null;
  assistant: PersonLite | null;
  director: PersonLite | null;
  stage: string | null;
  due: string | null;
  created: string | null;
}

export interface OpenCampaigns {
  rows: WorkspaceRow[];
  error: string | null;
  /** optional columns present on public.campaigns */
  hasStage: boolean;
  hasDue: boolean;
  hasDirector: boolean;
}

const PERSON = "id, first_name, last_name";

export async function loadOpenCampaigns(supabase: Db): Promise<OpenCampaigns> {
  const empty: OpenCampaigns = { rows: [], error: null, hasStage: false, hasDue: false, hasDirector: false };
  // select("*") so the optional columns (stage, due_date, director_person_id)
  // come back when they exist and are simply absent when they don't.
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      `*, brand:brands!brand_id(${BRAND_COLUMNS}), manager:people!manager_person_id(${PERSON}), assistant:people!assistant_person_id(${PERSON})`
    )
    .eq("is_active", true)
    .order("campaign_name", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) return { ...empty, error: error.message };

  const raw = (data ?? []) as Record<string, unknown>[];
  const first = raw[0] ?? {};
  const hasStage = "stage" in first;
  const hasDue = "due_date" in first;
  const hasDirector = "director_person_id" in first;

  // Directors are resolved in a second pass only when the column exists.
  const directorIds = hasDirector
    ? Array.from(new Set(raw.map((r) => r.director_person_id).filter((x): x is string => typeof x === "string")))
    : [];
  const directors = new Map<string, PersonLite>();
  if (directorIds.length) {
    const { data: ppl } = await supabase.from("people").select(PERSON).in("id", directorIds);
    for (const p of (ppl ?? []) as PersonLite[]) directors.set(p.id, p);
  }

  const rows: WorkspaceRow[] = raw.map((r) => ({
    id: Number(r.campaign_id),
    name: typeof r.campaign_name === "string" && r.campaign_name.trim() ? r.campaign_name.trim() : "Untitled campaign",
    brand: (r.brand as BrandLite | null) ?? null,
    manager: (r.manager as PersonLite | null) ?? null,
    assistant: (r.assistant as PersonLite | null) ?? null,
    director: hasDirector && typeof r.director_person_id === "string" ? directors.get(r.director_person_id) ?? null : null,
    stage: hasStage && typeof r.stage === "string" ? r.stage : null,
    due: hasDue && typeof r.due_date === "string" ? r.due_date : null,
    created: typeof r.date_stamp === "string" ? r.date_stamp : typeof r.created_at === "string" ? r.created_at : null,
  }));

  return { rows, error: null, hasStage, hasDue, hasDirector };
}

// ------------------------------------------------------------
// Checklist: first unchecked step per campaign
//
// Expected table (not in the schema yet — the screen says so until it
// is): campaign_checklist_steps(campaign_id bigint, step_index int
// 0-based into CHECKLIST, done boolean).
// ------------------------------------------------------------

export interface ChecklistNext {
  /** false = the checklist table does not exist yet */
  connected: boolean;
  /** campaign id → index of the first unchecked step (CHECKLIST.length = all done) */
  next: Map<number, number>;
}

export async function loadChecklistNext(supabase: Db, campaignIds: number[]): Promise<ChecklistNext> {
  const none: ChecklistNext = { connected: false, next: new Map() };
  if (!campaignIds.length) return { connected: false, next: new Map() };
  const { data, error } = await supabase
    .from("campaign_checklist_steps")
    .select("campaign_id, step_index, done")
    .in("campaign_id", campaignIds)
    .limit(campaignIds.length * CHECKLIST.length);
  if (error) return none;

  type S = { campaign_id: number; step_index: number; done: boolean | null };
  const doneBy = new Map<number, Set<number>>();
  for (const s of (data ?? []) as S[]) {
    if (!s.done) continue;
    if (!doneBy.has(s.campaign_id)) doneBy.set(s.campaign_id, new Set());
    doneBy.get(s.campaign_id)!.add(s.step_index);
  }
  const next = new Map<number, number>();
  for (const id of campaignIds) {
    const done = doneBy.get(id) ?? new Set<number>();
    let i = 0;
    while (i < CHECKLIST.length && done.has(i)) i++;
    next.set(id, i);
  }
  return { connected: true, next };
}
