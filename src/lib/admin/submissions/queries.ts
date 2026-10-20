// ============================================================
// Submission forms — server-only loaders for /admin/content/submissions.
//
// Two generations of tables feed these screens and both are read:
//   · content_submission_forms / content_submissions /
//     content_submission_files (migration 083, blended) — the form row
//     and the uploads the desktop app and worker write.
//   · submission_links / tier3_submissions (live today) — the public
//     /submit/[token] page still runs on these, keyed by campaign_recaps.id.
//     083 adds campaign_recaps.campaign_id, which is the bridge from a
//     blended campaign to its live link and legacy uploads.
// Every read is feature-detected: a missing table or column degrades to
// pending/"—", never to a crash or an invented number.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/admin/auth";
import { BRAND_COLUMNS } from "@/lib/admin/campaigns/queries";
import type { BrandLite, PersonLite } from "@/lib/admin/campaigns/types";
import { EMPTY_FORM, parseSubmissionForm, type SubmissionFormData } from "./form";

type Db = SupabaseClient<any, "public", any>;

const PERSON_COLUMNS = "id, first_name, last_name, instagram_handle, instagram_followers, college_raw, sport, agency, profilepicurl";

export const LUCID_ACCESS_LABEL: Record<string, string> = {
  pending: "Pending",
  granted: "Granted",
  failed: "Failed",
};

const norm = (h: string | null | undefined) => (h ?? "").trim().replace(/^@+/, "").toLowerCase();

// ------------------------------------------------------------
// Worker heartbeat (the office Mac that moves files into LucidLink)
// ------------------------------------------------------------

export interface WorkerStatus {
  state: "online" | "offline" | "unknown";
  lastSeen: string | null;
}

export async function loadWorkerStatus(supabase: Db): Promise<WorkerStatus> {
  try {
    const { data, error } = await supabase.from("worker_heartbeats").select("worker_id, last_seen").order("last_seen", { ascending: false }).limit(1);
    if (error || !data?.length) return { state: "unknown", lastSeen: null };
    const last = data[0].last_seen as string;
    const age = Date.now() - new Date(last).getTime();
    return { state: age < 5 * 60 * 1000 ? "online" : "offline", lastSeen: last };
  } catch {
    return { state: "unknown", lastSeen: null };
  }
}

// ------------------------------------------------------------
// Legacy bridge: campaign_id → campaign_recaps.id → submission_links / tier3
// ------------------------------------------------------------

interface LegacyUpload {
  recapId: string;
  handle: string;
  assetType: string;
  createdAt: string;
  fileClass: string | null;
}

interface LegacyBridge {
  /** campaign_id → recap ids */
  recaps: Map<number, string[]>;
  /** campaign_id → first active token */
  tokens: Map<number, string>;
  /** campaign_id → legacy file rows */
  uploads: Map<number, LegacyUpload[]>;
}

async function loadLegacyBridge(supabase: Db, campaignIds: number[]): Promise<LegacyBridge> {
  const out: LegacyBridge = { recaps: new Map(), tokens: new Map(), uploads: new Map() };
  if (campaignIds.length === 0) return out;
  const { data, error } = await supabase.from("campaign_recaps").select("id, campaign_id").in("campaign_id", campaignIds);
  if (error || !data?.length) return out;
  const recapToCampaign = new Map<string, number>();
  for (const r of data as { id: string; campaign_id: number }[]) {
    recapToCampaign.set(r.id, r.campaign_id);
    out.recaps.set(r.campaign_id, [...(out.recaps.get(r.campaign_id) ?? []), r.id]);
  }
  const recapIds = Array.from(recapToCampaign.keys());

  const [links, subs] = await Promise.all([
    supabase.from("submission_links").select("token, campaign_id, active, created_at").in("campaign_id", recapIds).order("created_at", { ascending: false }),
    supabase.from("tier3_submissions").select("campaign_id, ig_handle, asset_type, created_at, file_class").in("campaign_id", recapIds).limit(5000),
  ]);
  for (const l of (links.data ?? []) as { token: string; campaign_id: string; active: boolean }[]) {
    const cid = recapToCampaign.get(l.campaign_id);
    if (cid == null || !l.active || out.tokens.has(cid)) continue;
    out.tokens.set(cid, l.token);
  }
  for (const s of (subs.data ?? []) as { campaign_id: string; ig_handle: string | null; asset_type: string; created_at: string; file_class: string | null }[]) {
    const cid = recapToCampaign.get(s.campaign_id);
    if (cid == null) continue;
    const list = out.uploads.get(cid) ?? [];
    list.push({ recapId: s.campaign_id, handle: norm(s.ig_handle), assetType: s.asset_type, createdAt: s.created_at, fileClass: s.file_class });
    out.uploads.set(cid, list);
  }
  return out;
}

// ------------------------------------------------------------
// Form row (083 base + 087 fields, feature-detected)
// ------------------------------------------------------------

export interface FormRow {
  id: string;
  campaign_id: number;
  status: string;
  public_token: string | null;
  min_photos: number;
  min_videos: number;
  max_files_per_athlete: number | null;
  brief_url: string | null;
  /** 087 fields; defaults when the migration is unapplied */
  data: SubmissionFormData;
  lucidlink_path: string | null;
  /** true = 087 not applied (the `title` column is absent) */
  fieldsPending: boolean;
  updated_at: string | null;
}

function formFromRow(row: Record<string, unknown>): FormRow {
  const fieldsPending = !("title" in row);
  return {
    id: String(row.id),
    campaign_id: Number(row.campaign_id),
    status: typeof row.status === "string" ? row.status : "draft",
    public_token: typeof row.public_token === "string" ? row.public_token : null,
    min_photos: Number(row.min_photos ?? 0),
    min_videos: Number(row.min_videos ?? 0),
    max_files_per_athlete: row.max_files_per_athlete == null ? null : Number(row.max_files_per_athlete),
    brief_url: typeof row.brief_url === "string" ? row.brief_url : null,
    data: fieldsPending ? { ...EMPTY_FORM } : parseSubmissionForm(row),
    lucidlink_path: typeof row.lucidlink_path === "string" ? row.lucidlink_path : null,
    fieldsPending,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

// ------------------------------------------------------------
// The list
// ------------------------------------------------------------

export interface FormListRow {
  campaignId: number;
  form: FormRow;
  campaignName: string | null;
  isActive: boolean | null;
  brand: BrandLite | null;
  /** site-relative athlete link, when a live submission_links token exists */
  athleteLink: string | null;
  uploaded: number;
  /** selected athletes on the campaign */
  total: number;
  nudges: number;
  /** null = migration 087 (campaign_videographers) not applied */
  videographers: number | null;
  lucidPath: string | null;
  lucidStatus: string | null;
}

export interface FormList {
  pending083: boolean;
  pending087: boolean;
  error: string | null;
  rows: FormListRow[];
  worker: WorkerStatus;
}

export async function listSubmissionForms(supabase: Db, opts: { q?: string } = {}): Promise<FormList> {
  const worker = await loadWorkerStatus(supabase);
  const empty: FormList = { pending083: false, pending087: false, error: null, rows: [], worker };

  const formsRes = await supabase.from("content_submission_forms").select("*").order("updated_at", { ascending: false }).limit(500);
  if (formsRes.error) {
    if (isMissingSchemaError(formsRes.error)) return { ...empty, pending083: true };
    return { ...empty, error: formsRes.error.message };
  }
  const forms = ((formsRes.data ?? []) as Record<string, unknown>[]).map(formFromRow);
  const pending087 = forms.length > 0 && forms[0].fieldsPending;
  const ids = forms.map((f) => f.campaign_id);
  if (ids.length === 0) return { ...empty, pending087 };

  const [campRes, selRes, subRes, vgRes, legacy] = await Promise.all([
    supabase
      .from("campaigns")
      .select(`campaign_id, campaign_name, is_active, brand:brands!brand_id(${BRAND_COLUMNS}), storage:campaign_storage(lucid_root_path, lucid_status)`)
      .in("campaign_id", ids),
    supabase.from("campaign_opt_ins").select("campaign_id").in("campaign_id", ids).eq("is_selected", true).or("flag_delete.is.null,flag_delete.eq.false").limit(10000),
    supabase.from("content_submissions").select("campaign_id, instagram_handle, first_upload_at").in("campaign_id", ids).limit(10000),
    supabase.from("campaign_videographers").select("campaign_id").in("campaign_id", ids).eq("status", "assigned").limit(5000),
    loadLegacyBridge(supabase, ids),
  ]);
  if (campRes.error && isMissingSchemaError(campRes.error)) return { ...empty, pending083: true };
  if (campRes.error) return { ...empty, error: campRes.error.message };

  type CampRow = {
    campaign_id: number;
    campaign_name: string | null;
    is_active: boolean | null;
    brand: BrandLite | null;
    storage: { lucid_root_path: string | null; lucid_status: string | null } | { lucid_root_path: string | null; lucid_status: string | null }[] | null;
  };
  const camps = new Map<number, CampRow>();
  for (const c of (campRes.data ?? []) as unknown as CampRow[]) camps.set(c.campaign_id, c);

  const selected = new Map<number, number>();
  for (const r of (selRes.data ?? []) as { campaign_id: number }[]) selected.set(r.campaign_id, (selected.get(r.campaign_id) ?? 0) + 1);

  const uploaded = new Map<number, Set<string>>();
  for (const s of (subRes.data ?? []) as { campaign_id: number; instagram_handle: string; first_upload_at: string | null }[]) {
    if (!s.first_upload_at) continue;
    const set = uploaded.get(s.campaign_id) ?? new Set<string>();
    set.add(norm(s.instagram_handle));
    uploaded.set(s.campaign_id, set);
  }
  for (const [cid, list] of legacy.uploads) {
    const set = uploaded.get(cid) ?? new Set<string>();
    for (const u of list) if (u.handle) set.add(u.handle);
    uploaded.set(cid, set);
  }

  const vgPending = !!vgRes.error && isMissingSchemaError(vgRes.error);
  const vg = new Map<number, number>();
  for (const r of (vgRes.data ?? []) as { campaign_id: number }[]) vg.set(r.campaign_id, (vg.get(r.campaign_id) ?? 0) + 1);

  const q = (opts.q ?? "").trim().toLowerCase();
  const rows: FormListRow[] = [];
  for (const form of forms) {
    const c = camps.get(form.campaign_id);
    const storage = Array.isArray(c?.storage) ? c?.storage[0] ?? null : c?.storage ?? null;
    const name = c?.campaign_name ?? null;
    const brand = c?.brand ?? null;
    if (q && !`${name ?? ""} ${brand?.name ?? ""}`.toLowerCase().includes(q)) continue;
    const total = selected.get(form.campaign_id) ?? 0;
    const up = uploaded.get(form.campaign_id)?.size ?? 0;
    const token = legacy.tokens.get(form.campaign_id) ?? null;
    rows.push({
      campaignId: form.campaign_id,
      form,
      campaignName: name,
      isActive: c?.is_active ?? null,
      brand,
      athleteLink: token ? `/submit/${token}` : null,
      uploaded: up,
      total,
      nudges: Math.max(0, total - up),
      videographers: vgPending ? null : vg.get(form.campaign_id) ?? 0,
      lucidPath: form.lucidlink_path || storage?.lucid_root_path || null,
      lucidStatus: storage?.lucid_status ?? null,
    });
  }
  return { ...empty, pending087: pending087 || vgPending, rows };
}

/** Active campaigns that have no form yet — for the "start a form" picker. */
export async function listCampaignsWithoutForm(supabase: Db): Promise<{ campaign_id: number; campaign_name: string | null; brand_name: string | null }[]> {
  const [camps, forms] = await Promise.all([
    supabase.from("campaigns").select("campaign_id, campaign_name, brand:brands!brand_id(name)").eq("is_active", true).order("campaign_name").limit(500),
    supabase.from("content_submission_forms").select("campaign_id").limit(1000),
  ]);
  if (camps.error) return [];
  const has = new Set(((forms.data ?? []) as { campaign_id: number }[]).map((f) => f.campaign_id));
  return ((camps.data ?? []) as unknown as { campaign_id: number; campaign_name: string | null; brand: { name: string | null } | null }[])
    .filter((c) => !has.has(c.campaign_id))
    .map((c) => ({ campaign_id: c.campaign_id, campaign_name: c.campaign_name, brand_name: c.brand?.name ?? null }));
}

// ------------------------------------------------------------
// One campaign: athletes, videographers, form
// ------------------------------------------------------------

export type ReviewLabel = "To review" | "In review" | "Sent back" | "Approved";

export interface AthleteUploadRow {
  key: string;
  optInId: number | null;
  person: PersonLite | null;
  handle: string | null;
  photos: number;
  videos: number;
  raw: number;
  lastUpload: string | null;
  /** files the worker has copied into LucidLink */
  lucid: "synced" | "partial" | null;
  review: ReviewLabel | null;
  viaVideographer: boolean;
  remindedAt: string | null;
  /** matched to a profiles row (app account) by Instagram handle */
  hasApp: boolean;
}

export interface VideographerRow {
  id: string;
  profileId: string;
  name: string;
  email: string;
  accountStatus: string;
  lucidAccess: string;
  assignedAt: string;
}

export interface CampaignSubmission {
  form: FormRow | null;
  /** true = content_submission_forms table missing (083) */
  pending083: boolean;
  /** true = 087 columns / campaign_videographers missing */
  pending087: boolean;
  athletes: { pending: boolean; error: string | null; rows: AthleteUploadRow[] };
  videographers: { pending: boolean; rows: VideographerRow[]; available: { id: string; full_name: string; email: string; status: string }[] };
  athleteLink: string | null;
  lucidPath: string | null;
  lucidStatus: string | null;
  filesInLucid: number;
  worker: WorkerStatus;
}

function reviewFromStatuses(statuses: string[]): ReviewLabel | null {
  if (statuses.length === 0) return null;
  if (statuses.some((s) => s === "sent_back" || s === "athlete_redo")) return "Sent back";
  if (statuses.every((s) => s === "approved")) return "Approved";
  if (statuses.some((s) => s === "editing" || s === "edit_ready" || s === "with_brand")) return "In review";
  return "To review";
}

export async function loadCampaignSubmission(supabase: Db, campaignId: number): Promise<CampaignSubmission> {
  const worker = await loadWorkerStatus(supabase);
  const out: CampaignSubmission = {
    form: null,
    pending083: false,
    pending087: false,
    athletes: { pending: false, error: null, rows: [] },
    videographers: { pending: false, rows: [], available: [] },
    athleteLink: null,
    lucidPath: null,
    lucidStatus: null,
    filesInLucid: 0,
    worker,
  };

  const [formRes, selRes, subRes, storageRes, vgRes, profilesRes, legacy] = await Promise.all([
    supabase.from("content_submission_forms").select("*").eq("campaign_id", campaignId).maybeSingle(),
    supabase
      .from("campaign_opt_ins")
      .select(`campaign_opt_in_id, person_id, instagram_username, reminded_at, person:people!person_id(${PERSON_COLUMNS})`)
      .eq("campaign_id", campaignId)
      .eq("is_selected", true)
      .or("flag_delete.is.null,flag_delete.eq.false")
      .limit(2000),
    supabase
      .from("content_submissions")
      .select("id, person_id, instagram_handle, instagram_handle_display, first_name, last_name, uploaded_by, first_upload_at, last_upload_at, files:content_submission_files(asset_type, uploaded_by, uploaded_at, review_status, lucid_path, status)")
      .eq("campaign_id", campaignId)
      .limit(2000),
    supabase.from("campaign_storage").select("lucid_root_path, lucid_status").eq("campaign_id", campaignId).maybeSingle(),
    supabase
      .from("campaign_videographers")
      .select("id, user_id, status, lucid_access, assigned_at, profile:videographer_profiles!user_id(id, full_name, email, status)")
      .eq("campaign_id", campaignId)
      .eq("status", "assigned")
      .order("assigned_at", { ascending: false }),
    supabase.from("videographer_profiles").select("id, full_name, email, status").neq("status", "inactive").order("full_name").limit(500),
    loadLegacyBridge(supabase, [campaignId]),
  ]);

  if (formRes.error && isMissingSchemaError(formRes.error)) out.pending083 = true;
  else if (formRes.data) out.form = formFromRow(formRes.data as Record<string, unknown>);
  if (out.form?.fieldsPending) out.pending087 = true;

  out.athleteLink = legacy.tokens.get(campaignId) ? `/submit/${legacy.tokens.get(campaignId)}` : null;
  out.lucidPath = out.form?.lucidlink_path || (storageRes.data as { lucid_root_path: string | null } | null)?.lucid_root_path || null;
  out.lucidStatus = (storageRes.data as { lucid_status: string | null } | null)?.lucid_status ?? null;

  // ---- athletes
  if (selRes.error) {
    if (isMissingSchemaError(selRes.error)) out.athletes.pending = true;
    else out.athletes.error = selRes.error.message;
  }
  type SelRow = { campaign_opt_in_id: number; person_id: string | null; instagram_username: string | null; reminded_at: string | null; person: PersonLite | null };
  type FileRow = { asset_type: string; uploaded_by: string; uploaded_at: string; review_status: string; lucid_path: string | null; status: string };
  type SubRow = { id: string; person_id: string | null; instagram_handle: string; instagram_handle_display: string | null; first_name: string | null; last_name: string | null; uploaded_by: string; first_upload_at: string | null; last_upload_at: string | null; files: FileRow[] | null };

  const selected = (selRes.data ?? []) as unknown as SelRow[];
  const subs = (subRes.error ? [] : (subRes.data ?? [])) as unknown as SubRow[];
  const legacyUploads = legacy.uploads.get(campaignId) ?? [];

  // Index uploads by person id and by normalised handle.
  const byPerson = new Map<string, SubRow>();
  const byHandle = new Map<string, SubRow>();
  for (const s of subs) {
    if (s.person_id) byPerson.set(s.person_id, s);
    byHandle.set(norm(s.instagram_handle), s);
  }
  const legacyByHandle = new Map<string, LegacyUpload[]>();
  for (const u of legacyUploads) {
    if (!u.handle) continue;
    legacyByHandle.set(u.handle, [...(legacyByHandle.get(u.handle) ?? []), u]);
  }

  // App accounts: profiles.ig_handle matched case-insensitively.
  const handles = new Set<string>();
  for (const r of selected) {
    const h = norm(r.person?.instagram_handle ?? r.instagram_username);
    if (h) handles.add(h);
  }
  const appHandles = new Set<string>();
  if (handles.size) {
    const { data: profs } = await supabase.from("profiles").select("ig_handle").in("ig_handle", Array.from(handles)).limit(2000);
    for (const p of (profs ?? []) as { ig_handle: string | null }[]) appHandles.add(norm(p.ig_handle));
  }

  const used = new Set<string>();
  const rows: AthleteUploadRow[] = [];
  const build = (key: string, optInId: number | null, person: PersonLite | null, handle: string | null, remindedAt: string | null, sub: SubRow | null, legacyRows: LegacyUpload[]): AthleteUploadRow => {
    const files = (sub?.files ?? []).filter((f) => f.status !== "failed");
    let photos = 0;
    let videos = 0;
    let raw = 0;
    let last: string | null = null;
    let lucidCount = 0;
    const statuses: string[] = [];
    let viaVideographer = sub?.uploaded_by === "videographer";
    for (const f of files) {
      if (f.asset_type === "video") videos++;
      else photos++;
      if (f.lucid_path) lucidCount++;
      if (f.uploaded_by === "videographer") viaVideographer = true;
      statuses.push(f.review_status);
      if (!last || f.uploaded_at > last) last = f.uploaded_at;
    }
    for (const u of legacyRows) {
      if (u.fileClass === "raw") raw++;
      else if (u.assetType === "video") videos++;
      else photos++;
      if (!last || u.createdAt > last) last = u.createdAt;
    }
    if (!last && sub?.last_upload_at) last = sub.last_upload_at;
    const total = files.length;
    return {
      key,
      optInId,
      person,
      handle,
      photos,
      videos,
      raw,
      lastUpload: last,
      lucid: total === 0 ? null : lucidCount === total ? "synced" : lucidCount > 0 ? "partial" : null,
      review: reviewFromStatuses(statuses),
      viaVideographer,
      remindedAt,
      hasApp: !!handle && appHandles.has(handle),
    };
  };

  for (const r of selected) {
    const handle = norm(r.person?.instagram_handle ?? r.instagram_username) || null;
    const sub = (r.person_id && byPerson.get(r.person_id)) || (handle && byHandle.get(handle)) || null;
    if (sub) used.add(sub.id);
    if (handle) used.add(`legacy:${handle}`);
    rows.push(build(`optin-${r.campaign_opt_in_id}`, r.campaign_opt_in_id, r.person, handle, r.reminded_at, sub, handle ? legacyByHandle.get(handle) ?? [] : []));
  }
  // Uploads from athletes who are not on the selected list (typed their own handle).
  for (const s of subs) {
    if (used.has(s.id)) continue;
    const handle = norm(s.instagram_handle) || null;
    if (handle) used.add(`legacy:${handle}`);
    const person: PersonLite | null = s.first_name || s.last_name ? ({ id: s.person_id ?? s.id, first_name: s.first_name, last_name: s.last_name, instagram_handle: s.instagram_handle_display ?? s.instagram_handle, instagram_followers: null, college_raw: null, sport: null, agency: null, profilepicurl: null } as PersonLite) : null;
    rows.push(build(`sub-${s.id}`, null, person, handle, null, s, handle ? legacyByHandle.get(handle) ?? [] : []));
  }
  for (const [handle, list] of legacyByHandle) {
    if (used.has(`legacy:${handle}`)) continue;
    rows.push(build(`legacy-${handle}`, null, null, handle, null, null, list));
  }
  // Uploaded first (newest), then the ones still waiting.
  rows.sort((a, b) => {
    if (!!a.lastUpload !== !!b.lastUpload) return a.lastUpload ? -1 : 1;
    if (a.lastUpload && b.lastUpload) return a.lastUpload < b.lastUpload ? 1 : -1;
    return 0;
  });
  out.athletes.rows = rows;
  out.filesInLucid = rows.reduce((t, r) => t + (r.lucid === "synced" ? r.photos + r.videos : 0), 0);

  // ---- videographers
  if (vgRes.error) {
    if (isMissingSchemaError(vgRes.error)) {
      out.videographers.pending = true;
      out.pending087 = true;
    }
  } else {
    type VgRow = { id: string; user_id: string; status: string; lucid_access: string; assigned_at: string; profile: { id: string; full_name: string; email: string; status: string } | null };
    out.videographers.rows = ((vgRes.data ?? []) as unknown as VgRow[]).map((v) => ({
      id: v.id,
      profileId: v.user_id,
      name: v.profile?.full_name ?? "Unknown account",
      email: v.profile?.email ?? "",
      accountStatus: v.profile?.status ?? "signed_up",
      lucidAccess: v.lucid_access,
      assignedAt: v.assigned_at,
    }));
  }
  if (!profilesRes.error) {
    const assigned = new Set(out.videographers.rows.map((r) => r.profileId));
    out.videographers.available = ((profilesRes.data ?? []) as { id: string; full_name: string; email: string; status: string }[]).filter((p) => !assigned.has(p.id));
  }

  return out;
}
