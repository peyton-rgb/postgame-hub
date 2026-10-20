// ============================================================
// Review & edit — server-only queries.
//
// Two pipelines feed the review list, and they live in different tables:
//
//   1. review_sessions — deliverable/inspo review sessions with the
//      two-gate flow (pending_internal → pending_brand → approved, or
//      revision_requested). campaign_id references brand_campaigns (NOT
//      campaign_recaps — see migration 050's note). The per-campaign
//      review page and the session panel read this table.
//
//   2. Submission forms — campaigns with a submission_links form, whose
//      files sit in tier3_submissions. That aggregate is already ported
//      in src/lib/reviews-index.ts (loadReviewsIndex) and is reused as-is;
//      those rows open the existing review hub.
//
// Nothing here writes. Session actions go through the existing
// /api/reviews/[id]/* routes from the session panel.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadReviewsIndex, type ReviewsIndexRow } from "@/lib/reviews-index";
import { BRAND_COLUMNS, brandLogo } from "@/lib/admin/campaigns/queries";
import type { BrandLite } from "@/lib/admin/campaigns/types";

type Db = SupabaseClient<any, "public", any>;

export type SessionStatus = "pending_internal" | "pending_brand" | "approved" | "revision_requested";

export const STATUS_LABEL: Record<string, string> = {
  pending_internal: "To review",
  pending_brand: "With brand",
  approved: "Final",
  revision_requested: "Editing",
};

export interface SessionRow {
  id: string;
  created_at: string;
  updated_at: string;
  campaign_id: string | null;
  deliverable_id: string | null;
  asset_url: string | null;
  video_url: string | null;
  media_type: string | null;
  version_number: number;
  revision_round: number;
  status: string;
  brand_decision: string | null;
  brand_decided_at: string | null;
  brand_token: string;
  asset_name: string | null;
  athlete_name: string | null;
  editor_deadline: string | null;
}

export const SESSION_COLUMNS =
  "id, created_at, updated_at, campaign_id, deliverable_id, asset_url, video_url, media_type, version_number, revision_round, status, brand_decision, brand_decided_at, brand_token, asset_name, athlete_name, editor_deadline";

/** One row of the review list, whichever pipeline it came from. */
export interface ReviewListRow {
  key: string;
  source: "sessions" | "forms";
  name: string;
  brandName: string | null;
  logo: string | null;
  toReview: number;
  editing: number;
  withBrand: number | null; // null = this pipeline doesn't track a brand gate
  final: number;
  sentBack: number;
  /** days the oldest open item has waited; null = nothing open */
  waitingDays: number | null;
  href: string | null;
  actionLabel: string;
}

/** The brand's "send it back" is written as changes_requested by /reject and revision_requested by /request-changes. */
export function isSentBack(decision: string | null): boolean {
  return decision === "changes_requested" || decision === "revision_requested";
}

function days(oldestIso: string | null): number | null {
  if (!oldestIso) return null;
  const t = new Date(oldestIso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

async function loadBrandsByIds(supabase: Db, ids: string[]): Promise<Map<string, BrandLite>> {
  const map = new Map<string, BrandLite>();
  if (!ids.length) return map;
  const { data } = await supabase.from("brands").select(BRAND_COLUMNS).in("id", ids);
  for (const b of (data ?? []) as BrandLite[]) map.set(b.id, b);
  return map;
}

/** Group review_sessions by campaign. Empty list (not an error) when the table is empty. */
export async function loadSessionCampaigns(
  supabase: Db
): Promise<{ rows: ReviewListRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("review_sessions")
    .select("id, campaign_id, status, brand_decision, created_at, updated_at");
  if (error) return { rows: [], error: error.message };

  type Agg = { toReview: number; editing: number; withBrand: number; final: number; sentBack: number; oldest: string | null };
  const agg = new Map<string, Agg>();
  for (const s of (data ?? []) as Array<Pick<SessionRow, "id" | "campaign_id" | "status" | "brand_decision" | "created_at" | "updated_at">>) {
    const key = s.campaign_id ?? "none";
    const a = agg.get(key) ?? { toReview: 0, editing: 0, withBrand: 0, final: 0, sentBack: 0, oldest: null };
    if (s.status === "pending_internal") a.toReview += 1;
    else if (s.status === "revision_requested") a.editing += 1;
    else if (s.status === "pending_brand") a.withBrand += 1;
    else if (s.status === "approved") a.final += 1;
    if (s.status === "revision_requested" && isSentBack(s.brand_decision)) a.sentBack += 1;
    if (s.status === "pending_internal" || s.status === "revision_requested") {
      const t = s.updated_at ?? s.created_at;
      if (t && (a.oldest === null || t < a.oldest)) a.oldest = t;
    }
    agg.set(key, a);
  }

  const campaignIds = Array.from(agg.keys()).filter((k) => k !== "none");
  const { data: camps } = campaignIds.length
    ? await supabase.from("brand_campaigns").select("id, name, brand_id").in("id", campaignIds)
    : { data: [] as Array<{ id: string; name: string | null; brand_id: string | null }> };
  const campById = new Map((camps ?? []).map((c: any) => [c.id as string, c as { id: string; name: string | null; brand_id: string | null }]));
  const brands = await loadBrandsByIds(
    supabase,
    Array.from(new Set((camps ?? []).map((c: any) => c.brand_id).filter((x: any): x is string => !!x)))
  );

  const rows: ReviewListRow[] = Array.from(agg.entries()).map(([key, a]) => {
    const camp = campById.get(key);
    const brand = camp?.brand_id ? brands.get(camp.brand_id) ?? null : null;
    return {
      key: `s:${key}`,
      source: "sessions",
      name: key === "none" ? "Sessions with no campaign" : camp?.name || "Untitled campaign",
      brandName: brand?.name ?? null,
      logo: brandLogo(brand, "light"),
      toReview: a.toReview,
      editing: a.editing,
      withBrand: a.withBrand,
      final: a.final,
      sentBack: a.sentBack,
      waitingDays: days(a.oldest),
      href: `/admin/content/review/${key}`,
      actionLabel: a.toReview > 0 ? "Start review" : "Open",
    };
  });
  return { rows, error: null };
}

/** Submission-form campaigns, through the existing reviews-index port. */
export async function loadFormCampaigns(supabase: Db): Promise<{ rows: ReviewListRow[]; error: string | null }> {
  let index: ReviewsIndexRow[];
  try {
    index = await loadReviewsIndex(supabase);
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "Couldn't load the submission-form campaigns." };
  }
  if (!index.length) return { rows: [], error: null };

  // Brand marks: the index carries only the brand NAME; look the logo up by it.
  const names = Array.from(new Set(index.map((r) => r.brand).filter((x): x is string => !!x)));
  const byName = new Map<string, BrandLite>();
  if (names.length) {
    const { data } = await supabase.from("brands").select(BRAND_COLUMNS).in("name", names);
    for (const b of (data ?? []) as BrandLite[]) if (b.name) byName.set(b.name, b);
  }

  const rows: ReviewListRow[] = index.map((r) => {
    const brand = r.brand ? byName.get(r.brand) ?? null : null;
    return {
      key: `f:${r.campaignId}`,
      source: "forms",
      name: r.name,
      brandName: r.brand,
      logo: brandLogo(brand, "light"),
      toReview: r.toReview,
      editing: r.inEdit,
      withBrand: null,
      final: r.approved,
      sentBack: 0,
      waitingDays: r.waitingOnAthletes ? null : days(r.oldest ? `${r.oldest}T00:00:00Z` : null),
      href: !r.token
        ? null
        : r.waitingOnAthletes
          ? `/submit/${r.token}`
          : `/dashboard/submission-forms/${r.token}/review`,
      actionLabel: r.waitingOnAthletes ? "View form" : r.toReview > 0 ? "Start review" : "Open hub",
    };
  });
  return { rows, error: null };
}

/** Sessions for one brand_campaigns id (or "none" for unlinked sessions), newest first. */
export async function loadCampaignSessions(
  supabase: Db,
  campaignKey: string
): Promise<{ sessions: SessionRow[]; error: string | null }> {
  let q = supabase.from("review_sessions").select(SESSION_COLUMNS).order("created_at", { ascending: false });
  q = campaignKey === "none" ? q.is("campaign_id", null) : q.eq("campaign_id", campaignKey);
  const { data, error } = await q;
  if (error) return { sessions: [], error: error.message };
  return { sessions: (data ?? []) as SessionRow[], error: null };
}

export async function loadCampaignHeader(
  supabase: Db,
  campaignKey: string
): Promise<{ name: string; brand: BrandLite | null; status: string | null }> {
  if (campaignKey === "none") return { name: "Sessions with no campaign", brand: null, status: null };
  const { data } = await supabase
    .from("brand_campaigns")
    .select("id, name, status, brand_id")
    .eq("id", campaignKey)
    .maybeSingle();
  if (!data) return { name: "Campaign", brand: null, status: null };
  const brands = await loadBrandsByIds(supabase, data.brand_id ? [data.brand_id] : []);
  return {
    name: (data.name as string) || "Untitled campaign",
    brand: data.brand_id ? brands.get(data.brand_id) ?? null : null,
    status: (data.status as string | null) ?? null,
  };
}

/** The brand-approval gate column, from the session's own brand_decision columns. */
export function brandGate(s: Pick<SessionRow, "status" | "brand_decision" | "brand_decided_at">): {
  label: string;
  tone: "ok" | "warn" | "bad" | "info" | "muted";
  when: string | null;
} {
  if (s.brand_decision === "approved") return { label: "Approved by brand", tone: "ok", when: s.brand_decided_at };
  if (isSentBack(s.brand_decision))
    return { label: "Sent back by brand", tone: "bad", when: s.brand_decided_at };
  if (s.status === "pending_brand") return { label: "Waiting on brand", tone: "info", when: null };
  if (s.status === "approved") return { label: "Approved", tone: "ok", when: s.brand_decided_at };
  return { label: "Not sent yet", tone: "muted", when: null };
}
