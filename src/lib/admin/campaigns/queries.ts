// ============================================================
// Campaign page queries — server only.
//
// Everything the /admin/campaigns/[id] screens show comes from here:
// the campaign row (+ the migration-084 columns, feature-detected),
// its brand + staff, the athlete stage lists, the playbook/page
// statuses and the attached audiences. Each loader degrades to an
// honest empty/pending state when a table or column is missing.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/admin/auth";
import { applyAudienceFilters, buildAudienceFilters, savedFiltersToParams } from "@/lib/admin/audience";
import { sanitizeFilterValue } from "@/lib/admin/db";
import {
  EMPTY_EXTRAS,
  EXTRA_COLUMNS,
  type BrandLite,
  type CampaignExtras,
  type CampaignRow,
  type PersonLite,
} from "./types";
import { fromRow as optinFromRow, type OptinPageRow } from "./optin-page";

type Db = SupabaseClient<any, "public", any>;

export const BRAND_COLUMNS =
  "id, name, logo_dark_url, logo_light_url, logo_white_url, logo_primary_url, logo_mark_url";

const PERSON_COLUMNS =
  "id, first_name, last_name, instagram_handle, instagram_followers, college_raw, sport, agency, profilepicurl";

// ------------------------------------------------------------
// Campaign + extras + brand + staff
// ------------------------------------------------------------

export interface CampaignBundle {
  campaign: CampaignRow;
  extras: CampaignExtras;
  /** true = migration 084 not applied; extras are the defaults */
  extrasPending: boolean;
  brand: BrandLite | null;
  manager: PersonLite | null;
  assistant: PersonLite | null;
}

export async function loadCampaign(
  supabase: Db,
  id: number
): Promise<{ bundle: CampaignBundle | null; error: string | null }> {
  if (!Number.isInteger(id) || id <= 0) return { bundle: null, error: null };
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("campaign_id", id)
    .maybeSingle();
  if (error) return { bundle: null, error: error.message };
  if (!data) return { bundle: null, error: null };

  const row = data as Record<string, unknown>;
  // select("*") returns the 084 columns once the migration is applied, so
  // presence of `campaign_type` on the row is the feature flag.
  const extrasPending = !("campaign_type" in row);
  const extras: CampaignExtras = { ...EMPTY_EXTRAS };
  if (!extrasPending) {
    for (const k of EXTRA_COLUMNS) {
      const v = row[k];
      if (k === "campaign_type") extras.campaign_type = v === "event" ? "event" : "social";
      else (extras as unknown as Record<string, unknown>)[k] = typeof v === "string" ? v : null;
    }
  }

  const campaign = row as unknown as CampaignRow;
  const personIds = [campaign.manager_person_id, campaign.assistant_person_id].filter(
    (x): x is string => !!x
  );

  const [brandRes, peopleRes] = await Promise.all([
    campaign.brand_id
      ? supabase.from("brands").select(BRAND_COLUMNS).eq("id", campaign.brand_id).maybeSingle()
      : Promise.resolve({ data: null }),
    personIds.length
      ? supabase.from("people").select("id, first_name, last_name").in("id", personIds)
      : Promise.resolve({ data: [] as PersonLite[] }),
  ]);
  const people = (peopleRes.data ?? []) as PersonLite[];

  return {
    bundle: {
      campaign,
      extras,
      extrasPending,
      brand: (brandRes.data as BrandLite | null) ?? null,
      manager: people.find((p) => p.id === campaign.manager_person_id) ?? null,
      assistant: people.find((p) => p.id === campaign.assistant_person_id) ?? null,
    },
    error: null,
  };
}

/** Pick the right brand mark for a light (admin) or dark (app) background. */
export function brandLogo(brand: BrandLite | null, on: "light" | "dark"): string | null {
  if (!brand) return null;
  return on === "light"
    ? brand.logo_dark_url || brand.logo_primary_url || brand.logo_mark_url || null
    : brand.logo_light_url || brand.logo_white_url || brand.logo_primary_url || null;
}

// ------------------------------------------------------------
// Athlete stages
// ------------------------------------------------------------

export type Stage = "audience" | "optins" | "selected" | "affiliates" | "paid";
export const STAGES: { key: Stage; label: string }[] = [
  { key: "audience", label: "Campaign audience" },
  { key: "optins", label: "Opt-ins" },
  { key: "selected", label: "Selected" },
  { key: "affiliates", label: "Affiliates" },
  { key: "paid", label: "Paid" },
];

export interface OptInRow {
  campaign_opt_in_id: number;
  person_id: string | null;
  is_invited: boolean | null;
  is_optin: boolean | null;
  is_selected: boolean | null;
  date_invited: string | null;
  date_optin: string | null;
  date_selected: string | null;
  date_contract_sign: string | null;
  date_paid: string | null;
  amount_paid: number | null;
  method_paid: string | null;
  payment_id: number | null;
  instagram_username: string | null;
  person: PersonLite | null;
  payment: { payout_batch_id: string | null; transaction_status: string | null } | null;
}

export interface AffiliateRow {
  affiliate_id: number;
  person_id: string | null;
  link: string | null;
  short_url: string | null;
  clicks: number | null;
  ig: string | null;
  person: PersonLite | null;
  /** affiliate_payments.payment summed for this person on this campaign */
  paid_out: number;
}

export interface AthleteStages {
  pending: boolean;
  error: string | null;
  /** every opt-in row on the campaign */
  all: OptInRow[];
  /** invited but not opted in */
  audience: OptInRow[];
  /** opted in, not selected */
  optins: OptInRow[];
  selected: OptInRow[];
  affiliates: AffiliateRow[];
  paid: OptInRow[];
  counts: Record<Stage, number>;
  totals: { optins: number; selected: number; signed: number; paidAmount: number };
  /** person ids with a signed-contract file on this campaign */
  contractFiles: Set<string>;
  /** person id -> submission status */
  submissions: Map<string, string>;
}

export async function loadAthleteStages(supabase: Db, id: number): Promise<AthleteStages> {
  const empty: AthleteStages = {
    pending: false,
    error: null,
    all: [],
    audience: [],
    optins: [],
    selected: [],
    affiliates: [],
    paid: [],
    counts: { audience: 0, optins: 0, selected: 0, affiliates: 0, paid: 0 },
    totals: { optins: 0, selected: 0, signed: 0, paidAmount: 0 },
    contractFiles: new Set(),
    submissions: new Map(),
  };

  const [optRes, affRes, affPayRes, contractRes, subRes] = await Promise.all([
    supabase
      .from("campaign_opt_ins")
      .select(
        "campaign_opt_in_id, person_id, is_invited, is_optin, is_selected, date_invited, date_optin, " +
          "date_selected, date_contract_sign, date_paid, amount_paid, method_paid, payment_id, instagram_username, " +
          `person:people!person_id(${PERSON_COLUMNS}), payment:payments!payment_id(payout_batch_id, transaction_status)`
      )
      .eq("campaign_id", id)
      .or("flag_delete.is.null,flag_delete.eq.false")
      .order("date_optin", { ascending: false, nullsFirst: false })
      .limit(1000),
    supabase
      .from("affiliate_links")
      .select(`affiliate_id, person_id, link, short_url, clicks, ig, person:people!person_id(${PERSON_COLUMNS})`)
      .eq("campaign_id", id)
      .limit(1000),
    supabase.from("affiliate_payments").select("person_id, payment").eq("campaign_id", id).limit(2000),
    supabase.from("campaign_contracts").select("person_id").eq("campaign_id", id).limit(2000),
    supabase.from("content_submissions").select("person_id, status").eq("campaign_id", id).limit(2000),
  ]);

  if (optRes.error) {
    if (isMissingSchemaError(optRes.error)) return { ...empty, pending: true };
    return { ...empty, error: optRes.error.message };
  }

  const rows = (optRes.data ?? []) as unknown as OptInRow[];
  const audience = rows.filter((r) => !r.is_optin && (r.is_invited || r.date_invited));
  const optins = rows.filter((r) => r.is_optin && !r.is_selected);
  const selected = rows.filter((r) => !!r.is_selected);
  const paid = rows.filter((r) => !!r.date_paid || (r.amount_paid ?? 0) > 0);

  const paidOut = new Map<string, number>();
  for (const p of (affPayRes.data ?? []) as { person_id: string | null; payment: number | null }[]) {
    if (!p.person_id) continue;
    paidOut.set(p.person_id, (paidOut.get(p.person_id) ?? 0) + Number(p.payment ?? 0));
  }
  const affiliates = ((affRes.data ?? []) as unknown as Omit<AffiliateRow, "paid_out">[]).map((a) => ({
    ...a,
    paid_out: a.person_id ? paidOut.get(a.person_id) ?? 0 : 0,
  }));

  const contractFiles = new Set<string>();
  for (const c of (contractRes.data ?? []) as { person_id: string | null }[]) if (c.person_id) contractFiles.add(c.person_id);
  const submissions = new Map<string, string>();
  for (const s of (subRes.data ?? []) as { person_id: string | null; status: string | null }[])
    if (s.person_id) submissions.set(s.person_id, s.status ?? "receiving");

  const signed = rows.filter((r) => !!r.date_contract_sign || (r.person_id ? contractFiles.has(r.person_id) : false)).length;

  return {
    ...empty,
    all: rows,
    audience,
    optins,
    selected,
    affiliates,
    paid,
    counts: {
      audience: audience.length,
      optins: optins.length,
      selected: selected.length,
      affiliates: affiliates.length,
      paid: paid.length,
    },
    totals: {
      optins: rows.filter((r) => !!r.is_optin).length,
      selected: selected.length,
      signed,
      paidAmount: paid.reduce((t, r) => t + Number(r.amount_paid ?? 0), 0),
    },
    contractFiles,
    submissions,
  };
}

// ------------------------------------------------------------
// Playbook: files + athlete pages + brand & team pages
// ------------------------------------------------------------

export type PageStatus = "live" | "draft" | "none";

export interface Playbook {
  optinPage: { exists: boolean; updated_at: string | null; data: ReturnType<typeof optinFromRow> };
  appCard: { id: string; status: string; name: string; video_url: string | null; image_url: string | null } | null;
  submissionForm: { id: string; status: string; public_token: string } | null;
  postingSettings: boolean;
  creatorBrief: boolean;
  recap: { id: string; slug: string | null } | null;
  storage: {
    campaign_folder_url: string | null;
    campaign_folder_id: string | null;
    performance_tracker_url: string | null;
    internal_sheet_id: string | null;
    external_sheet_id: string | null;
    lucid_root_path: string | null;
  } | null;
}

export async function loadPlaybook(supabase: Db, id: number): Promise<Playbook> {
  const [optin, card, form, posting, brief, recap, storage] = await Promise.all([
    supabase.from("campaign_optin_pages").select("*").eq("campaign_id", id).maybeSingle(),
    supabase
      .from("mobile_app_cards")
      .select("id, status, name, video_url, image_url")
      .or(`campaign_id.eq.${id},link_campaign_id.eq.${id}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("content_submission_forms").select("id, status, public_token").eq("campaign_id", id).maybeSingle(),
    supabase.from("content_posting_settings").select("campaign_id").eq("campaign_id", id).maybeSingle(),
    supabase.from("campaign_creator_briefs").select("campaign_id").eq("campaign_id", id).maybeSingle(),
    supabase.from("campaign_recaps").select("id, slug").eq("campaign_id", id).limit(1).maybeSingle(),
    supabase
      .from("campaign_storage")
      .select("campaign_folder_url, campaign_folder_id, performance_tracker_url, internal_sheet_id, external_sheet_id, lucid_root_path")
      .eq("campaign_id", id)
      .maybeSingle(),
  ]);

  const optinRow = (optin.data ?? null) as OptinPageRow | null;
  return {
    optinPage: { exists: !!optinRow, updated_at: optinRow?.updated_at ?? null, data: optinFromRow(optinRow) },
    appCard: (card.data as Playbook["appCard"]) ?? null,
    submissionForm: (form.data as Playbook["submissionForm"]) ?? null,
    postingSettings: !!posting.data,
    creatorBrief: !!brief.data,
    recap: (recap.data as Playbook["recap"]) ?? null,
    storage: (storage.data as Playbook["storage"]) ?? null,
  };
}

/** Google Sheets URL from a sheet id, or null. */
export function sheetUrl(id: string | null | undefined): string | null {
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : null;
}
export function driveFolderUrl(id: string | null | undefined): string | null {
  return id ? `https://drive.google.com/drive/folders/${id}` : null;
}

// ------------------------------------------------------------
// Attached audiences (campaign_audiences, migration 084)
// ------------------------------------------------------------

export interface AttachedAudience {
  audience_id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  attached_at: string;
  invited_at: string | null;
  invited_count: number | null;
  optin_count: number | null;
  /** athletes matching the saved filters right now */
  size: number;
}

export interface AudiencePane {
  /** campaign_audiences table missing (migration 084 unapplied) */
  pending: boolean;
  attached: AttachedAudience[];
  /** saved audiences not yet attached (for the attach picker) */
  available: { id: string; name: string }[];
  /** athletes in the selected audience (first 50), or null when none selected */
  members: PersonLite[] | null;
  membersTotal: number;
}

function filtersToParams(f: Record<string, unknown>): Record<string, string | undefined> {
  // Pass every saved key through (levels, include, handles, leave-outs…),
  // not just the original single-value ones.
  return savedFiltersToParams(f);
}

export async function loadAudiencePane(
  supabase: Db,
  id: number,
  selectedAudienceId: string | null,
  search: string
): Promise<AudiencePane> {
  const empty: AudiencePane = { pending: false, attached: [], available: [], members: null, membersTotal: 0 };

  const { data, error } = await supabase
    .from("campaign_audiences")
    .select("audience_id, attached_at, invited_at, invited_count, optin_count, audience:saved_audiences!audience_id(id, name, description, filters)")
    .eq("campaign_id", id)
    .order("attached_at", { ascending: false });
  if (error) {
    if (isMissingSchemaError(error)) return { ...empty, pending: true };
    return empty;
  }

  type Raw = {
    audience_id: string;
    attached_at: string;
    invited_at: string | null;
    invited_count: number | null;
    optin_count: number | null;
    audience: { id: string; name: string; description: string | null; filters: Record<string, unknown> | null } | null;
  };
  const raw = (data ?? []) as unknown as Raw[];

  const attached: AttachedAudience[] = await Promise.all(
    raw.map(async (r) => {
      const filters = r.audience?.filters ?? {};
      const f = buildAudienceFilters(filtersToParams(filters));
      const { count } = await applyAudienceFilters(
        supabase.from("people").select("id", { count: "exact", head: true }),
        f
      );
      return {
        audience_id: r.audience_id,
        name: r.audience?.name ?? "Audience",
        description: r.audience?.description ?? null,
        filters,
        attached_at: r.attached_at,
        invited_at: r.invited_at,
        invited_count: r.invited_count,
        optin_count: r.optin_count,
        size: count ?? 0,
      };
    })
  );

  const { data: saved } = await supabase.from("saved_audiences").select("id, name").order("name").limit(500);
  const attachedIds = new Set(attached.map((a) => a.audience_id));
  const available = ((saved ?? []) as { id: string; name: string }[]).filter((a) => !attachedIds.has(a.id));

  let members: PersonLite[] | null = null;
  let membersTotal = 0;
  const sel = selectedAudienceId ? attached.find((a) => a.audience_id === selectedAudienceId) : null;
  if (sel) {
    const f = buildAudienceFilters(filtersToParams(sel.filters));
    const q = sanitizeFilterValue(search);
    let list = applyAudienceFilters(supabase.from("people").select(PERSON_COLUMNS), f);
    let cnt = applyAudienceFilters(supabase.from("people").select("id", { count: "exact", head: true }), f);
    if (q) {
      const like = `first_name.ilike.%${q}%,last_name.ilike.%${q}%,instagram_handle.ilike.%${q}%,college_raw.ilike.%${q}%`;
      list = list.or(like);
      cnt = cnt.or(like);
    }
    const [l, c] = await Promise.all([
      list.order("instagram_followers", { ascending: false, nullsFirst: false }).limit(50),
      cnt,
    ]);
    members = (l.data ?? []) as PersonLite[];
    membersTotal = c.count ?? 0;
  }

  return { pending: false, attached, available, members, membersTotal };
}
