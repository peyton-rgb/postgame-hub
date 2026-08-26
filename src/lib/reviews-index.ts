// ============================================================
// Reviews index — what needs Postgame's attention, across all campaigns.
//
// The review hub (#218) can only be reached from one submission form. This is
// the view above it: every campaign that has a form, what is waiting, and how
// long it has been waiting.
//
// DELIBERATELY PLAIN. There is one real row today; anything elaborate looks
// wrong at n=1. A column earns its place only if someone decides something
// differently because of it.
//
// ── The query this page is a port of ────────────────────────
// Ported, not re-derived. PostgREST cannot express this GROUP BY and adding a
// database function would be a migration, so it is decomposed into four reads
// and aggregated below — the semantics are kept identical, and this is the
// reference they are checked against:
//
//   select cr.id, cr.admin_campaign_id::int as cid, cr.name, b.name as brand,
//          count(distinct s.id) as submissions,
//          count(t.id) filter (where not t.is_test_upload) as files,
//          count(t.id) filter (where t.status in ('scored','pending_review')
//                                and not t.is_test_upload) as to_review,
//          count(t.id) filter (where t.status='needs_edit'
//                                and not t.is_test_upload) as in_edit,
//          count(t.id) filter (where t.status='approved'
//                                and not t.is_test_upload) as approved,
//          min(s.submitted_at)::date as oldest
//   from campaign_recaps cr
//   left join brands b on b.id = cr.brand_id
//   left join submissions s on s.campaign_id = cr.id
//   left join tier3_submissions t on t.submission_id = s.id
//   where exists (select 1 from submission_links sl where sl.campaign_id = cr.id)
//   group by cr.id, cr.admin_campaign_id, cr.name, b.name
//
// Two things about it that are easy to get wrong when reimplementing:
//
//   is_test_upload is excluded from every file count. Without it SVA reads 54
//   files instead of 48. It is a staff dry-run — a real row with real scores,
//   so nothing but the flag tells it apart from an athlete's work.
//
//   `oldest` is min(s.submitted_at) over the campaign's submissions and is NOT
//   filtered by is_test_upload, because that flag lives on tier3_submissions,
//   not on submissions. Filtering the file counts must not change which
//   submissions the minimum is taken over — that is why the exclusions are
//   FILTER clauses on the aggregates rather than a WHERE on the join.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// Counts come back from PostgREST as numbers here because they are computed in
// TypeScript, but ids and any `numeric`/`bigint` read straight from Postgres
// arrive as STRINGS. Coerce at the boundary, once: `"0" ?? fallback` is truthy
// and `"9" < 10` is a string comparison, and both fail quietly.
export const int = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

// Statuses that mean a file is sitting in front of a reviewer.
const TO_REVIEW_STATUSES = ["scored", "pending_review"];

export interface ReviewsIndexRow {
  campaignId: string;
  adminCampaignId: number | null;
  name: string;
  brand: string | null;
  token: string | null;
  submissions: number;
  files: number;
  toReview: number;
  inEdit: number;
  approved: number;
  oldest: string | null;
  // A campaign with a form and nothing received is waiting on athletes, not on
  // Postgame. It is not the same queue and does not get the same action.
  waitingOnAthletes: boolean;
  needsUs: boolean;
}

// Days since a date, or null. Whole days, floored.
export function daysWaiting(oldest: string | null, now: Date = new Date()): number | null {
  if (!oldest) return null;
  const then = new Date(`${oldest}T00:00:00Z`).getTime();
  if (!Number.isFinite(then)) return null;
  const ms = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - then;
  return Math.max(0, Math.floor(ms / 86400000));
}

// Age is the point of this page, so it is the one thing that changes colour.
// Thresholds match the review hub's tokens: past a week is not fine, past a
// fortnight is bad. Under a week stays quiet so the loud ones stay loud.
export type AgeTone = "quiet" | "warn" | "bad";
export function ageTone(days: number | null): AgeTone {
  if (days === null) return "quiet";
  if (days >= 14) return "bad";
  if (days >= 7) return "warn";
  return "quiet";
}

interface LinkRow { campaign_id: string; token: string; created_at: string }
interface RecapRow { id: string; name: string | null; admin_campaign_id: unknown; brand: unknown }
interface SubRow { id: string; campaign_id: string; submitted_at: string }
interface FileRow { submission_id: string; status: string | null; is_test_upload: boolean | null }

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export async function loadReviewsIndex(svc: SupabaseClient): Promise<ReviewsIndexRow[]> {
  // 1. The WHERE EXISTS: only campaigns that have a submission form.
  const { data: links } = await svc
    .from("submission_links")
    .select("campaign_id, token, created_at")
    .not("campaign_id", "is", null);

  const linkRows = (links ?? []) as LinkRow[];
  if (!linkRows.length) return [];

  // A campaign may carry more than one form. The newest is the one a row links
  // to, chosen deterministically rather than by whatever order came back.
  const tokenFor = new Map<string, string>();
  for (const l of [...linkRows].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))) {
    tokenFor.set(l.campaign_id, l.token);
  }
  const campaignIds = Array.from(tokenFor.keys());

  // 2. cr + b: the campaign and its brand name.
  const { data: recaps } = await svc
    .from("campaign_recaps")
    .select("id, name, admin_campaign_id, brand:brands!campaigns_brand_id_fkey(name)")
    .in("id", campaignIds);

  // 3. s: the submissions, which carry the date the age is measured from.
  const { data: subs } = await svc
    .from("submissions")
    .select("id, campaign_id, submitted_at")
    .in("campaign_id", campaignIds);

  const subRows = (subs ?? []) as SubRow[];

  // 4. t: the files, joined to submissions by submission_id.
  const subIds = subRows.map((s) => s.id);
  let fileRows: FileRow[] = [];
  if (subIds.length) {
    const { data: files } = await svc
      .from("tier3_submissions")
      .select("submission_id, status, is_test_upload")
      .in("submission_id", subIds);
    fileRows = (files ?? []) as FileRow[];
  }

  // submission id -> campaign id, so files roll up the same way the join does.
  const campaignOfSub = new Map<string, string>();
  for (const s of subRows) campaignOfSub.set(s.id, s.campaign_id);

  const agg = new Map<
    string,
    { submissions: number; files: number; toReview: number; inEdit: number; approved: number; oldest: string | null }
  >();
  for (const id of campaignIds) {
    agg.set(id, { submissions: 0, files: 0, toReview: 0, inEdit: 0, approved: 0, oldest: null });
  }

  // count(distinct s.id), and min(s.submitted_at) over ALL submissions — the
  // test-upload flag lives on the file, so it cannot narrow this.
  for (const s of subRows) {
    const a = agg.get(s.campaign_id);
    if (!a) continue;
    a.submissions += 1;
    const d = (s.submitted_at ?? "").slice(0, 10);
    if (d && (a.oldest === null || d < a.oldest)) a.oldest = d;
  }

  // The FILTER clauses. Every one of them excludes staff dry-runs.
  for (const f of fileRows) {
    const cid = campaignOfSub.get(f.submission_id);
    if (!cid) continue;
    const a = agg.get(cid);
    if (!a || f.is_test_upload) continue;
    a.files += 1;
    if (f.status && TO_REVIEW_STATUSES.includes(f.status)) a.toReview += 1;
    else if (f.status === "needs_edit") a.inEdit += 1;
    else if (f.status === "approved") a.approved += 1;
  }

  const rows: ReviewsIndexRow[] = (recaps ?? []).map((r: any) => {
    const rec = r as RecapRow;
    const a = agg.get(rec.id)!;
    const waitingOnAthletes = a.submissions === 0;
    return {
      campaignId: rec.id,
      adminCampaignId: rec.admin_campaign_id === null ? null : int(rec.admin_campaign_id),
      name: rec.name ?? "Untitled campaign",
      brand: (one<any>(rec.brand)?.name as string | null) ?? null,
      token: tokenFor.get(rec.id) ?? null,
      submissions: a.submissions,
      files: a.files,
      toReview: a.toReview,
      inEdit: a.inEdit,
      approved: a.approved,
      oldest: a.oldest,
      waitingOnAthletes,
      // Needs us = there is something for Postgame to act on. A campaign with
      // nothing received is waiting on athletes and is not in this queue.
      needsUs: !waitingOnAthletes && (a.toReview > 0 || a.inEdit > 0),
    };
  });

  // Oldest first. Age is the point: four files waiting three weeks matter more
  // than forty waiting a day. Campaigns with nothing received have no age and
  // sort last, which is also where they belong by urgency.
  rows.sort((x, y) => {
    if (x.oldest === null && y.oldest === null) return x.name.localeCompare(y.name);
    if (x.oldest === null) return 1;
    if (y.oldest === null) return -1;
    return x.oldest < y.oldest ? -1 : x.oldest > y.oldest ? 1 : x.name.localeCompare(y.name);
  });

  return rows;
}
