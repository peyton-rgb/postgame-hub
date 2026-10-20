// ============================================================
// Content area (/admin/content/*) — server-only loaders.
//
// Read-only. Every write on these screens goes through an existing,
// already-guarded API the Hub editors use today:
//   review actions  → POST /api/submission-forms/[token]/review
//   mark link sent  → PATCH /api/posting-packages/[id]
//
// Sources (verified against xqaybwhpgxillpbbqtks, 2026-10-20):
//   Review & edit   submission_links + campaign_recaps + tier3_submissions
//                   (the same rows /dashboard/reviews and the review hub
//                   read; loadReviewsIndex is reused as-is). review_sessions
//                   is empty and not shown.
//   Posting         posting_campaigns + posting_packages (+ files count)
//   Recaps          campaign_recaps (+ recap_readiness for the "ready" count)
//   Run of shows    run_of_shows + ros_shoots
//   Media           media (+ athletes, campaign_recaps for labels)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadReviewsIndex } from "@/lib/reviews-index";
import { BRAND_COLUMNS, brandLogo } from "@/lib/admin/campaigns/queries";
import type { BrandLite } from "@/lib/admin/campaigns/types";
import { buildAthletes, type FileRow, type Instruction } from "@/components/submission-forms/reviewHubLogic";
import {
  STAFF_PACKAGE_COLUMNS,
  deliverUrl,
  groupAthletes,
  isPosted,
  isSent,
  nextPostDate,
  postsOf,
  stageOf,
  formatPostDate,
  type StaffPackage,
} from "@/lib/posting-packages";
import {
  TO_REVIEW,
  type EditSuggestion,
  type EditVersion,
  type MediaTile,
  type PostingCampaignRow,
  type PostingRosterRow,
  type RecapCard,
  type ReviewAthleteRow,
  type ReviewCampaignRow,
  type ReviewWorkspaceData,
  type RosRow,
} from "./types";

type Db = SupabaseClient<any, "public", any>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function brandsById(supabase: Db, ids: (string | null | undefined)[]): Promise<Map<string, BrandLite>> {
  const uniq = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const map = new Map<string, BrandLite>();
  if (!uniq.length) return map;
  const { data } = await supabase.from("brands").select(BRAND_COLUMNS).in("id", uniq);
  for (const b of (data ?? []) as BrandLite[]) map.set(b.id, b);
  return map;
}

// ============================================================
// Review & edit
// ============================================================

export async function loadReviewCampaigns(
  supabase: Db
): Promise<{ rows: ReviewCampaignRow[]; error: string | null }> {
  let index;
  try {
    index = await loadReviewsIndex(supabase);
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "Couldn't load review campaigns." };
  }
  if (!index.length) return { rows: [], error: null };

  const ids = index.map((r) => r.campaignId);
  const [{ data: recaps }, { data: files }] = await Promise.all([
    supabase.from("campaign_recaps").select("id, brand_id").in("id", ids),
    supabase
      .from("tier3_submissions")
      .select("campaign_id, athlete_name")
      .in("campaign_id", ids)
      .eq("is_test_upload", false),
  ]);
  const brandOf = new Map<string, string | null>(
    (recaps ?? []).map((r: any) => [r.id as string, (r.brand_id as string | null) ?? null])
  );
  const brands = await brandsById(supabase, Array.from(brandOf.values()));
  const athletes = new Map<string, Set<string>>();
  for (const f of (files ?? []) as Array<{ campaign_id: string; athlete_name: string | null }>) {
    const set = athletes.get(f.campaign_id) ?? new Set<string>();
    set.add((f.athlete_name ?? "").trim().toLowerCase());
    athletes.set(f.campaign_id, set);
  }

  const today = Date.now();
  const rows: ReviewCampaignRow[] = index.map((r) => {
    const bid = brandOf.get(r.campaignId) ?? null;
    const brand = bid ? brands.get(bid) ?? null : null;
    const oldest = r.oldest ? new Date(`${r.oldest}T00:00:00Z`).getTime() : NaN;
    return {
      id: r.campaignId,
      adminCampaignId: r.adminCampaignId,
      name: r.name,
      brandName: brand?.name ?? r.brand,
      logo: brandLogo(brand, "light"),
      athletes: athletes.get(r.campaignId)?.size ?? 0,
      files: r.files,
      toReview: r.toReview,
      inEdit: r.inEdit,
      approved: r.approved,
      waitingDays:
        r.needsUs && Number.isFinite(oldest) ? Math.max(0, Math.floor((today - oldest) / 86400000)) : null,
      waitingOnAthletes: r.waitingOnAthletes,
      needsUs: r.needsUs,
    };
  });
  return { rows, error: null };
}

const FILE_COLUMNS =
  "id, submission_id, athlete_name, school, asset_type, file_name, drive_file_url, drive_thumbnail_url, score_composite, score_composition, score_lighting, score_subject, score_brand_visibility, score_hook, tags, status, reviewed_at, review_notes, review_instructions, reviewed_at_stage, created_at";

function toFileRow(r: any): FileRow {
  return {
    id: r.id,
    athleteName: r.athlete_name || "Unknown",
    school: r.school ?? null,
    assetType: r.asset_type === "video" ? "video" : r.asset_type === "photo" ? "photo" : "unknown",
    fileName: r.file_name ?? "Untitled",
    fileUrl: r.drive_file_url ?? null,
    thumbUrl: r.drive_thumbnail_url ?? null,
    composite: num(r.score_composite),
    composition: num(r.score_composition),
    lighting: num(r.score_lighting),
    subject: num(r.score_subject),
    brandVisibility: num(r.score_brand_visibility),
    hook: num(r.score_hook),
    tags: (r.tags as string[] | null) ?? [],
    status: r.status ?? "scored",
    reviewedAt: r.reviewed_at ?? null,
    reviewNotes: r.review_notes ?? null,
    reviewInstructions: (r.review_instructions as Instruction[] | null) ?? null,
    reviewedAtStage: r.reviewed_at_stage ?? null,
  };
}

export interface ReviewCampaignHeader {
  id: string;
  name: string;
  brandName: string | null;
  logo: string | null;
  token: string | null;
  adminCampaignId: number | null;
  minPhotos: number;
  minVideos: number;
}

export async function loadReviewCampaignHeader(supabase: Db, campaignId: string): Promise<ReviewCampaignHeader | null> {
  const [{ data: recap }, { data: links }] = await Promise.all([
    supabase.from("campaign_recaps").select("id, name, brand_id, admin_campaign_id").eq("id", campaignId).maybeSingle(),
    supabase
      .from("submission_links")
      .select("token, min_photos, min_videos, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (!recap) return null;
  const brands = await brandsById(supabase, [recap.brand_id as string | null]);
  const brand = recap.brand_id ? brands.get(recap.brand_id as string) ?? null : null;
  const link = (links ?? [])[0] as { token: string; min_photos: number | null; min_videos: number | null } | undefined;
  return {
    id: recap.id as string,
    name: (recap.name as string) || "Untitled campaign",
    brandName: brand?.name ?? null,
    logo: brandLogo(brand, "light"),
    token: link?.token ?? null,
    adminCampaignId: num(recap.admin_campaign_id),
    minPhotos: link?.min_photos ?? 0,
    minVideos: link?.min_videos ?? 0,
  };
}

/** Reviewable files for a campaign — the same filter as the review hub API. */
export async function loadCampaignFiles(supabase: Db, campaignId: string): Promise<FileRow[]> {
  const { data } = await supabase
    .from("tier3_submissions")
    .select(FILE_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("is_test_upload", false)
    .neq("status", "scoring_failed")
    .order("created_at", { ascending: true });
  return (data ?? []).map(toFileRow);
}

/** Rail order: to-review first, then edits, sent back, approved; upload order inside each. */
function railRank(status: string): number {
  if (TO_REVIEW.has(status)) return 0;
  if (status === "needs_edit") return 1;
  if (status === "rejected") return 2;
  if (status === "approved") return 3;
  return 4;
}
export function railOrder(files: FileRow[]): FileRow[] {
  return files
    .map((f, i) => ({ f, i }))
    .sort((a, b) => railRank(a.f.status) - railRank(b.f.status) || a.i - b.i)
    .map((x) => x.f);
}

export function reviewAthletes(files: FileRow[], header: ReviewCampaignHeader): ReviewAthleteRow[] {
  const req = { minPhotos: header.minPhotos, minVideos: header.minVideos };
  return buildAthletes(files, req)
    .map((a) => {
      const toReview = a.files.filter((f) => TO_REVIEW.has(f.status)).length;
      const inEdit = a.files.filter((f) => f.status === "needs_edit").length;
      const sentBack = a.files.filter((f) => f.status === "rejected").length;
      const approved = a.files.filter((f) => f.status === "approved").length;
      const missingPhotos = Math.max(0, req.minPhotos - a.photos);
      const missingVideos = Math.max(0, req.minVideos - a.videos);
      const required = Math.max(a.files.length, req.minPhotos + req.minVideos);
      const first = railOrder(a.files)[0] ?? null;
      const missingText = [
        missingPhotos ? `${missingPhotos} photo${missingPhotos === 1 ? "" : "s"}` : "",
        missingVideos ? `${missingVideos} video${missingVideos === 1 ? "" : "s"}` : "",
      ]
        .filter(Boolean)
        .join(" and ");

      let next: string;
      let cta: string;
      let ctaPrimary = false;
      let tab: ReviewAthleteRow["tab"];
      if (toReview > 0) {
        next = `${toReview} file${toReview === 1 ? "" : "s"} to review${missingText ? ` · still missing ${missingText}` : ""}`;
        cta = "Review";
        ctaPrimary = true;
        tab = "needs";
      } else if (inEdit > 0) {
        next = `${inEdit} file${inEdit === 1 ? "" : "s"} in the edit queue`;
        cta = "Open";
        tab = "needs";
      } else if (sentBack > 0 || missingText) {
        next = sentBack
          ? `Waiting on the athlete · ${sentBack} sent back for a reshoot`
          : `Waiting on the athlete · missing ${missingText}`;
        cta = "Open";
        tab = "waiting";
      } else {
        next = "Every file approved";
        cta = "Open";
        tab = "done";
      }
      return {
        key: a.key,
        name: a.name,
        school: a.school,
        total: a.files.length,
        required,
        approved,
        toReview,
        inEdit,
        sentBack,
        missingPhotos,
        missingVideos,
        firstFileId: first?.id ?? null,
        next,
        cta,
        ctaPrimary,
        tab,
      };
    })
    .sort((x, y) => y.toReview - x.toReview || y.inEdit - x.inEdit || x.name.localeCompare(y.name));
}

export async function loadReviewWorkspace(
  supabase: Db,
  campaignId: string,
  fileId: string
): Promise<{ data: ReviewWorkspaceData | null; header: ReviewCampaignHeader | null }> {
  const header = await loadReviewCampaignHeader(supabase, campaignId);
  if (!header) return { data: null, header: null };
  const files = await loadCampaignFiles(supabase, campaignId);
  const file = files.find((f) => f.id === fileId);
  if (!file) return { data: null, header };
  const key = file.athleteName.trim().toLowerCase();
  const siblings = railOrder(files.filter((f) => f.athleteName.trim().toLowerCase() === key));

  const [{ data: jobs }, { data: sugg }] = await Promise.all([
    supabase
      .from("edit_jobs")
      .select("id, status, instruction, output_url, output_thumbnail_url, created_at")
      .eq("submission_id", fileId)
      .order("created_at", { ascending: true }),
    supabase
      .from("edit_suggestions")
      .select("id, kind, summary, detail, severity, status")
      .eq("submission_id", fileId)
      .order("created_at", { ascending: true }),
  ]);

  const versions: EditVersion[] = (jobs ?? []).map((j: any) => ({
    id: j.id,
    status: j.status,
    instruction: j.instruction ?? null,
    outputUrl: j.output_url ?? null,
    outputThumb: j.output_thumbnail_url ?? null,
    createdAt: j.created_at,
  }));
  const suggestions: EditSuggestion[] = (sugg ?? []).map((s: any) => ({
    id: s.id,
    kind: s.kind ?? null,
    summary: s.summary ?? null,
    detail: s.detail ?? null,
    severity: s.severity ?? null,
    status: s.status ?? null,
  }));

  return {
    header,
    data: {
      campaignId,
      campaignName: header.name,
      brandName: header.brandName,
      token: header.token,
      athleteName: file.athleteName,
      file,
      siblings,
      versions,
      suggestions,
    },
  };
}

// ============================================================
// Posting instructions
// ============================================================

export async function loadPostingCampaigns(
  supabase: Db
): Promise<{ rows: PostingCampaignRow[]; error: string | null }> {
  const [{ data: camps, error }, { data: pkgs, error: pErr }] = await Promise.all([
    supabase
      .from("posting_campaigns")
      .select("id, brand_id, title, season_label, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("posting_packages").select("posting_campaign_id, athlete_name, status, sent_at, posted_at"),
  ]);
  if (error || pErr) return { rows: [], error: (error ?? pErr)!.message };
  const brands = await brandsById(supabase, (camps ?? []).map((c: any) => c.brand_id));
  const rows = (camps ?? []).map((c: any) => {
    const mine = (pkgs ?? []).filter((p: any) => p.posting_campaign_id === c.id);
    const brand = c.brand_id ? brands.get(c.brand_id) ?? null : null;
    return {
      id: c.id,
      title: [c.title, c.season_label].filter(Boolean).join(" · ") || "Untitled campaign",
      brandName: brand?.name ?? null,
      logo: brandLogo(brand, "light"),
      athletes: new Set(mine.map((p: any) => String(p.athlete_name ?? "").trim().toLowerCase())).size,
      posts: mine.length,
      sent: mine.filter((p: any) => isSent(p)).length,
      posted: mine.filter((p: any) => isPosted(p)).length,
    };
  });
  return { rows, error: null };
}

export interface PostingCampaignDetail {
  id: string;
  title: string;
  brandName: string | null;
  logo: string | null;
  tag: string | null;
  hashtag: string | null;
  ftc: string | null;
  rows: PostingRosterRow[];
}

export async function loadPostingRoster(supabase: Db, id: string): Promise<PostingCampaignDetail | null> {
  const { data: camp } = await supabase
    .from("posting_campaigns")
    .select("id, brand_id, title, season_label, tag_handle, hashtag, ftc_note")
    .eq("id", id)
    .maybeSingle();
  if (!camp) return null;
  const [brands, { data: pkgs }] = await Promise.all([
    brandsById(supabase, [camp.brand_id as string | null]),
    supabase.from("posting_packages").select(STAFF_PACKAGE_COLUMNS).eq("posting_campaign_id", id),
  ]);
  const packages = (pkgs ?? []) as unknown as StaffPackage[];
  const pkgIds = packages.map((p) => p.id);
  const photos = new Map<string, number>();
  if (pkgIds.length) {
    const { data: files } = await supabase.from("posting_package_files")
      .select("package_id")
      .in("package_id", pkgIds)
      .eq("kind", "photo");
    for (const f of (files ?? []) as Array<{ package_id: string }>) photos.set(f.package_id, (photos.get(f.package_id) ?? 0) + 1);
  }
  const brand = camp.brand_id ? brands.get(camp.brand_id as string) ?? null : null;

  const rows: PostingRosterRow[] = groupAthletes(packages).map((a) => {
    const posts = postsOf(a);
    const stages = posts.map((p) => stageOf(p, photos.get(p.id) ?? 0));
    const allPosted = stages.every((s) => s === "posted");
    const anySent = stages.some((s) => s === "sent" || s === "posted");
    const allReady = stages.every((s) => s === "ready" || s === "sent" || s === "posted");
    const status: PostingRosterRow["status"] = allPosted
      ? "posted"
      : anySent && allReady
        ? "sent"
        : allReady
          ? "ready"
          : "not_ready";
    const label = { posted: "Posted", sent: "Sent", ready: "Ready to send", not_ready: "Not ready" }[status];
    const parts: string[] = [];
    if (a.reel) parts.push(a.reel.video_url ? (a.reel.cover_url ? "Reel + cover" : "Reel, no cover") : "Reel missing");
    if (a.feed) {
      const n = photos.get(a.feed.id) ?? 0;
      parts.push(n ? `${n} photo${n === 1 ? "" : "s"}` : "Photos missing");
    }
    for (const o of a.other) parts.push(o.deliverable_key ?? "Post");
    const filesOk =
      (!a.reel || (!!a.reel.video_url && !!a.reel.cover_url)) && (!a.feed || (photos.get(a.feed.id) ?? 0) > 0);
    const next = nextPostDate(a);
    return {
      key: a.key,
      name: a.name,
      school: a.school,
      handle: a.handle,
      postDate: next ? formatPostDate(next) : null,
      files: parts.join(" · ") || "—",
      filesOk,
      status,
      statusLabel: label,
      link: deliverUrl(a.link.delivery_token),
      draftIds: posts.filter((p) => p.status === "draft" && !isSent(p)).map((p) => p.id),
    };
  });
  rows.sort((x, y) => (x.postDate ?? "~").localeCompare(y.postDate ?? "~") || x.name.localeCompare(y.name));

  return {
    id: camp.id as string,
    title: [camp.title, camp.season_label].filter(Boolean).join(" · ") || "Untitled campaign",
    brandName: brand?.name ?? null,
    logo: brandLogo(brand, "light"),
    tag: (camp.tag_handle as string | null) ?? null,
    hashtag: (camp.hashtag as string | null) ?? null,
    ftc: (camp.ftc_note as string | null) ?? null,
    rows,
  };
}

// ============================================================
// Recaps
// ============================================================

export const RECAP_PAGE = 24;

export async function loadRecaps(
  supabase: Db,
  opts: { q?: string; brand?: string; status?: string; page: number }
): Promise<{
  cards: RecapCard[];
  total: number;
  all: number;
  readyCount: number | null;
  brands: { id: string; name: string }[];
  error: string | null;
}> {
  const apply = (query: any) => {
    if (opts.q) query = query.or(`name.ilike.%${opts.q}%,client_name.ilike.%${opts.q}%`);
    if (opts.brand) query = query.eq("brand_id", opts.brand);
    if (opts.status === "published") query = query.eq("published", true);
    else if (opts.status === "draft") query = query.eq("published", false).neq("status", "archived");
    else if (opts.status === "archived") query = query.eq("status", "archived");
    return query;
  };
  const from = (opts.page - 1) * RECAP_PAGE;
  const [list, allRes, brandIds, ready] = await Promise.all([
    apply(
      supabase
        .from("campaign_recaps")
        .select(
          "id, name, slug, client_name, brand_id, status, published, thumbnail_url, hero_image_url, og_image, created_at",
          { count: "exact" }
        )
    )
      .order("created_at", { ascending: false })
      .range(from, from + RECAP_PAGE - 1),
    supabase.from("campaign_recaps").select("id", { count: "exact", head: true }),
    supabase.from("campaign_recaps").select("brand_id").not("brand_id", "is", null),
    supabase.from("recap_readiness").select("id", { count: "exact", head: true }).eq("ready", true),
  ]);
  if (list.error) return { cards: [], total: 0, all: 0, readyCount: null, brands: [], error: list.error.message };

  const allBrandIds = Array.from(new Set(((brandIds.data ?? []) as Array<{ brand_id: string }>).map((b) => b.brand_id)));
  const brandMap = await brandsById(supabase, allBrandIds);
  const cards: RecapCard[] = ((list.data ?? []) as any[]).map((r) => {
    const brand = r.brand_id ? brandMap.get(r.brand_id) ?? null : null;
    return {
      id: r.id,
      name: r.name || "Untitled recap",
      slug: r.slug ?? null,
      brandName: brand?.name ?? r.client_name ?? null,
      logo: brandLogo(brand, "dark"),
      status: r.status ?? (r.published ? "published" : "draft"),
      published: !!r.published,
      image: r.thumbnail_url || r.hero_image_url || r.og_image || null,
      createdAt: r.created_at,
    };
  });
  const brands = Array.from(brandMap.values())
    .map((b) => ({ id: b.id, name: b.name ?? "Unnamed brand" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    cards,
    total: list.count ?? cards.length,
    all: allRes.count ?? 0,
    readyCount: ready.error ? null : (ready.count ?? 0),
    brands,
    error: null,
  };
}

// ============================================================
// Run of shows
// ============================================================

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** ros_shoots.date is free text ("Oct 24", "10/24/2026", "Friday, October 24"). Best-effort parse. */
function parseShootDate(text: string | null): number | null {
  if (!text) return null;
  const direct = Date.parse(text);
  if (Number.isFinite(direct)) return direct;
  const m = text.toLowerCase().match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})/);
  if (m) {
    const mi = MONTHS.indexOf(m[1]);
    if (mi >= 0) {
      const y = new Date().getFullYear();
      return new Date(y, mi, Number(m[2])).getTime();
    }
  }
  return null;
}

export async function loadRunOfShows(supabase: Db): Promise<{ rows: RosRow[]; error: string | null }> {
  const [{ data: shows, error }, { data: shoots }] = await Promise.all([
    supabase
      .from("run_of_shows")
      .select("id, name, slug, client_name, client_logo_url, brand_id, published, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("ros_shoots").select("run_of_show_id, date, city, state, sort_order"),
  ]);
  if (error) return { rows: [], error: error.message };
  const brands = await brandsById(supabase, (shows ?? []).map((s: any) => s.brand_id));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows: RosRow[] = (shows ?? []).map((s: any) => {
    const mine = ((shoots ?? []) as any[]).filter((x) => x.run_of_show_id === s.id);
    const dated = mine
      .map((x) => ({ x, t: parseShootDate(x.date) }))
      .sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity) || (a.x.sort_order ?? 0) - (b.x.sort_order ?? 0));
    const upcoming = dated.find((d) => d.t !== null && d.t >= today.getTime()) ?? dated[0] ?? null;
    const where = upcoming ? [upcoming.x.city, upcoming.x.state].filter(Boolean).join(", ") : "";
    const brand = s.brand_id ? brands.get(s.brand_id) ?? null : null;
    return {
      id: s.id,
      name: s.name || "Untitled run of show",
      client: brand?.name ?? s.client_name ?? null,
      logo: brandLogo(brand, "light"),
      shoots: mine.length,
      nextShoot: upcoming ? [upcoming.x.date, where].filter(Boolean).join(" · ") || null : null,
      published: !!s.published,
      slug: s.slug ?? null,
    };
  });
  return { rows, error: null };
}

// ============================================================
// Media library
// ============================================================

export const MEDIA_PAGE = 48;

export async function loadMedia(
  supabase: Db,
  opts: { q?: string; brand?: string; campaign?: string; type?: string; page: number }
): Promise<{
  tiles: MediaTile[];
  total: number;
  campaigns: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  error: string | null;
}> {
  // Campaign + brand options: only campaigns that own media.
  const { data: owned } = await supabase.from("campaign_recaps").select("id, name, brand_id");
  const recapRows = (owned ?? []) as Array<{ id: string; name: string | null; brand_id: string | null }>;
  const recapById = new Map(recapRows.map((r) => [r.id, r]));
  const brandMap = await brandsById(supabase, recapRows.map((r) => r.brand_id));

  let campaignFilter: string[] | null = null;
  if (opts.campaign) campaignFilter = [opts.campaign];
  else if (opts.brand) campaignFilter = recapRows.filter((r) => r.brand_id === opts.brand).map((r) => r.id);

  let athleteFilter: string[] | null = null;
  let campaignSearch: string[] | null = null;
  if (opts.q) {
    const { data: ath } = await supabase
      .from("athletes")
      .select("id")
      .or(`name.ilike.%${opts.q}%,school.ilike.%${opts.q}%,sport.ilike.%${opts.q}%,ig_handle.ilike.%${opts.q}%`)
      .limit(200);
    athleteFilter = ((ath ?? []) as Array<{ id: string }>).map((a) => a.id);
    const ql = opts.q.toLowerCase();
    campaignSearch = recapRows
      .filter((r) => {
        const b = r.brand_id ? brandMap.get(r.brand_id)?.name ?? "" : "";
        return (r.name ?? "").toLowerCase().includes(ql) || b.toLowerCase().includes(ql);
      })
      .map((r) => r.id);
  }

  const apply = (query: any) => {
    query = query.eq("is_video_thumbnail", false);
    if (opts.type === "image" || opts.type === "video") query = query.eq("type", opts.type);
    if (campaignFilter) query = query.in("campaign_id", campaignFilter.length ? campaignFilter : ["00000000-0000-0000-0000-000000000000"]);
    if (athleteFilter && campaignSearch) {
      const ors: string[] = [];
      if (athleteFilter.length) ors.push(`athlete_id.in.(${athleteFilter.join(",")})`);
      if (campaignSearch.length) ors.push(`campaign_id.in.(${campaignSearch.join(",")})`);
      query = ors.length ? query.or(ors.join(",")) : query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
    return query;
  };

  const from = (opts.page - 1) * MEDIA_PAGE;
  const { data, count, error } = await apply(
    supabase.from("media").select("id, type, file_url, thumbnail_url, athlete_id, campaign_id, created_at", {
      count: "exact",
    })
  )
    .order("created_at", { ascending: false })
    .range(from, from + MEDIA_PAGE - 1);
  if (error) return { tiles: [], total: 0, campaigns: [], brands: [], error: error.message };

  const rows = (data ?? []) as Array<{
    id: string;
    type: string;
    file_url: string;
    thumbnail_url: string | null;
    athlete_id: string | null;
    campaign_id: string | null;
  }>;
  const athIds = Array.from(new Set(rows.map((r) => r.athlete_id).filter((x): x is string => !!x)));
  const athMap = new Map<string, { name: string | null; school: string | null }>();
  if (athIds.length) {
    const { data: ath } = await supabase.from("athletes").select("id, name, school").in("id", athIds);
    for (const a of (ath ?? []) as any[]) athMap.set(a.id, { name: a.name ?? null, school: a.school ?? null });
  }

  const tiles: MediaTile[] = rows.map((r) => {
    const camp = r.campaign_id ? recapById.get(r.campaign_id) ?? null : null;
    const brand = camp?.brand_id ? brandMap.get(camp.brand_id) ?? null : null;
    const ath = r.athlete_id ? athMap.get(r.athlete_id) ?? null : null;
    const isVideo = r.type === "video";
    return {
      id: r.id,
      type: isVideo ? "video" : "image",
      thumb: r.thumbnail_url || (isVideo ? null : r.file_url),
      fileUrl: r.file_url,
      athleteName: ath?.name ?? null,
      school: ath?.school ?? null,
      campaignName: camp?.name ?? null,
      brandName: brand?.name ?? null,
    };
  });

  // Options: campaigns that appear in media (cheap distinct over the ownership column).
  // PostgREST caps a read at 1,000 rows, so page through the one column.
  const withMedia = new Set<string>();
  for (let off = 0; off < 20000; off += 1000) {
    const { data: mc } = await supabase
      .from("media")
      .select("campaign_id")
      .order("id", { ascending: true })
      .range(off, off + 999);
    const batch = (mc ?? []) as Array<{ campaign_id: string | null }>;
    for (const m of batch) if (m.campaign_id) withMedia.add(m.campaign_id);
    if (batch.length < 1000) break;
  }
  const campaigns = recapRows
    .filter((r) => withMedia.has(r.id) && (!opts.brand || r.brand_id === opts.brand))
    .map((r) => ({ id: r.id, name: r.name ?? "Untitled" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const brandIdsWithMedia = new Set(recapRows.filter((r) => withMedia.has(r.id)).map((r) => r.brand_id));
  const brands = Array.from(brandMap.values())
    .filter((b) => brandIdsWithMedia.has(b.id))
    .map((b) => ({ id: b.id, name: b.name ?? "Unnamed brand" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { tiles, total: count ?? tiles.length, campaigns, brands, error: null };
}

