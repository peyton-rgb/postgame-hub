/**
 * recap-intake — turn a parsed Slack "Recap Request" into a draft campaign_recaps
 * row (+ imported tracker athletes), validated against the pstgm admin campaign
 * cache, reusing the same parsing/save logic the recap editor uses.
 *
 * Disposition per request: CREATE | SKIP(exists) | FLAG(reason). Admin is the
 * naming authority; the Slack row's name/brand are advisory and any disagreement
 * is surfaced. A safety brake refuses to auto-create half-formed / mis-filed rows.
 *
 * Reuse map (nothing rebuilt):
 *  - Slack list + Details parsing  → @/lib/slack-recap-queue
 *  - Admin cache + fuzzy matching  → @/lib/admin-campaigns
 *  - Tracker CSV parsing           → parseMetricsCSV  (@/lib/csv-parser)
 *  - Metric auto-fill              → autoFillMetrics  (@/lib/metrics-helpers)
 *  - Hero stat computation         → computeStats     (@/lib/recap-helpers)
 *  - Google auth                   → getGoogleAuth    (@/lib/google-auth)
 *  - Recap create shape / slug     → mirrors createCampaign() in CampaignList.tsx
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Athlete, HeroMetricOverrideKey, KpiTargets } from "@/lib/types";
import { parseMetricsCSV, detectCollabGroups } from "@/lib/csv-parser";
import { autoFillMetrics } from "@/lib/metrics-helpers";
import { computeStats } from "@/lib/recap-helpers";
import { getGoogleAuth } from "@/lib/google-auth";
import {
  parseSheetIdAndGid,
  type RecapRequest,
  type ParsedDetails,
} from "@/lib/slack-recap-queue";
import {
  getAdminCampaign,
  matchBrandInList,
  findFuzzyExistingRecap,
  knownBrandSet,
  normLoose,
  type AdminCampaign,
  type BrandMatch,
  type BrandRow,
  type RecapRow,
} from "@/lib/admin-campaigns";

// ── TipTap HTML ───────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wrap plain text as TipTap/StarterKit HTML: one <p> per paragraph, single
 *  newlines → <br>. Empty input → "" (matches how the editor stores empties). */
export function toTipTapHtml(text: string | undefined | null): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  return t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ── Slug (mirrors createCampaign in CampaignList.tsx) ─────────────────────────

export function makeSlug(name: string): string {
  const base = (name || "recap")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "recap"}-${Date.now().toString(36)}`;
}

// ── Athlete rows (mirrors createCampaign's CSV import mapping) ─────────────────

export interface AthleteRowBase {
  name: string;
  ig_handle: string;
  ig_followers: number;
  school: string;
  sport: string;
  gender: string;
  notes: string;
  post_type: string;
  post_url: string | null;
  metrics: any;
  sort_order: number;
}

/** Parse tracker CSV → athlete row objects, exactly as the editor's create-flow
 *  CSV import does (parseMetricsCSV → autoFillMetrics → same field mapping). */
export function parseTrackerAthletes(csv: string): AthleteRowBase[] {
  const { athletes: parsed } = parseMetricsCSV(csv);
  return parsed.map((pa, i) => ({
    name: pa.name,
    ig_handle: pa.ig_handle || "",
    ig_followers: pa.ig_followers || 0,
    school: pa.school || "",
    sport: pa.sport || "",
    gender: pa.gender || "",
    notes: pa.notes || "",
    post_type: pa.metrics.ig_reel?.post_url
      ? "IG Reel"
      : pa.metrics.tiktok?.post_url
        ? "TikTok"
        : "IG Feed",
    post_url: pa.metrics.ig_feed?.post_url || pa.metrics.ig_reel?.post_url || null,
    metrics: autoFillMetrics(pa.metrics),
    sort_order: i,
  }));
}

// ── Google Sheets → CSV ───────────────────────────────────────────────────────

export interface TrackerFetchResult {
  ok: boolean;
  reason?: string;
  csv?: string;
  sheetId?: string;
  gid?: string;
  exportUrl?: string;
}

/**
 * Fetch a Google Sheet tab as CSV using the existing DrivePicker Google creds.
 * Preserves the gid (tab) from the URL. Never throws; returns {ok:false} on any
 * failure so recap creation is never blocked on the tracker.
 */
export async function fetchTrackerCsv(trackerUrl: string | undefined): Promise<TrackerFetchResult> {
  if (!trackerUrl) return { ok: false, reason: "no tracker URL on the request" };
  const { id, gid } = parseSheetIdAndGid(trackerUrl);
  if (!id) return { ok: false, reason: "could not parse sheet id from URL" };

  const exportUrl =
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv` + (gid ? `&gid=${gid}` : "");

  try {
    const at = await getGoogleAuth().getAccessToken();
    const token = typeof at === "string" ? at : at?.token;
    if (!token) return { ok: false, reason: "could not obtain Google access token", sheetId: id, gid, exportUrl };

    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `sheet fetch HTTP ${res.status}`, sheetId: id, gid, exportUrl };

    const ct = res.headers.get("content-type") || "";
    const body = await res.text();
    if (ct.includes("text/html") || body.trimStart().startsWith("<")) {
      return { ok: false, reason: "no access to sheet (got HTML, not CSV)", sheetId: id, gid, exportUrl };
    }
    if (!body.trim()) return { ok: false, reason: "sheet exported empty", sheetId: id, gid, exportUrl };
    return { ok: true, csv: body, sheetId: id, gid, exportUrl };
  } catch (e: any) {
    return { ok: false, reason: `fetch error: ${String(e?.message || e)}`, sheetId: id, gid, exportUrl };
  }
}

// ── Zero-metric hero auto-off ─────────────────────────────────────────────────

/**
 * Compute each hero metric the renderer can show (CampaignRecap.tsx:1439-1454)
 * and return the keys that compute to 0 / null so they can be hidden. No athletes
 * ⇒ every data-driven hero is 0 ⇒ all hidden (never a wall of zeros).
 */
export function computeHiddenHeroes(athleteRows: AthleteRowBase[]): {
  hidden: HeroMetricOverrideKey[];
  heroValues: Record<HeroMetricOverrideKey, number>;
} {
  const athletes = athleteRows.map((r, i) => ({
    id: String(i),
    name: r.name,
    school: r.school,
    sport: r.sport,
    ig_followers: r.ig_followers,
    post_url: r.post_url,
    metrics: r.metrics,
  })) as unknown as Athlete[];

  const { collabGroups } = detectCollabGroups(athletes, (a) => a.id);
  const s = computeStats(athletes, collabGroups);

  const heroValues: Record<HeroMetricOverrideKey, number> = {
    athlete_count: s.athleteCount,
    school_count: s.schoolCount,
    sport_count: s.sportCount,
    total_posts: s.totalPosts,
    combined_followers: s.combinedFollowers,
    total_impressions: s.totalImpressions,
    total_engagements: s.totalEngagements,
    ig_avg_engagement_rate: s.igFeedPosts > 0 || s.igReelPosts > 0 ? s.igAvgEngRate : 0,
    tiktok_avg_engagement_rate: s.tiktokPosts > 0 ? s.tiktokAvgEngRate : 0,
    total_clicks: s.clicks.link_clicks,
    total_orders: s.clicks.orders || s.sales.conversions,
    total_sales: s.clicks.salesAmount || s.sales.revenue,
  };

  const hidden = (Object.keys(heroValues) as HeroMetricOverrideKey[]).filter((k) => {
    const v = heroValues[k];
    return v == null || Number.isNaN(v) || v === 0;
  });
  return { hidden, heroValues };
}

// ── KPI targets ───────────────────────────────────────────────────────────────

function num(s?: string): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? undefined : n;
}

export function buildKpiTargets(d: ParsedDetails): KpiTargets {
  const t: KpiTargets = {};
  const set = (k: keyof KpiTargets, v: number | undefined) => {
    if (v !== undefined) (t as Record<string, number>)[k] = v;
  };
  set("athlete_quantity", num(d.athleteTarget));
  set("content_units", num(d.contentUnitTarget));
  set("impressions", num(d.impressionTarget));
  set("engagements", num(d.engagementTarget));
  set("engagement_rate", num(d.engagementRateTarget));
  set("cpm", num(d.cpmTarget));
  if (d.otherKpis && d.otherKpis.trim()) t.other_kpis = d.otherKpis.trim();
  return t;
}

// ── Settings (full default shape + parsed overlays) ───────────────────────────

const DEFAULT_VISIBLE_SECTIONS = {
  brief: true,
  roster: true,
  metrics: true,
  kpi_targets: true,
  key_takeaways: true,
  top_performers: true,
  content_gallery: true,
  platform_breakdown: true,
};

export function buildSettings(
  details: ParsedDetails,
  brand: BrandMatch,
  hiddenHeroes: HeroMetricOverrideKey[],
): Record<string, unknown> {
  const descriptionSource = details.campaignGoals ?? details.rawUnstructured ?? "";
  return {
    primary_color: "#D73F09",
    layout: "masonry",
    columns: 4,
    quarter: "",
    content_type: "",
    visible_sections: { ...DEFAULT_VISIBLE_SECTIONS },
    hidden_platform_cards: [],
    campaign_type: details.campaignType?.[0] ?? "",
    platform: (details.platforms ?? []).join(", "),
    tags: details.campaignType ?? [],
    description: toTipTapHtml(descriptionSource),
    key_takeaways: toTipTapHtml(details.takeaways),
    kpi_targets: buildKpiTargets(details),
    brand_logo_url: brand.brand_logo_url || "",
    hidden_heroes: hiddenHeroes,
  };
}

// ── Intake context (loaded once per run) ──────────────────────────────────────

export interface IntakeContext {
  brands: BrandRow[];
  recaps: RecapRow[];
  knownBrands: Set<string>;
}

export async function loadIntakeContext(supabase: SupabaseClient): Promise<IntakeContext> {
  const [brandsRes, recapsRes, adminBrandsRes] = await Promise.all([
    supabase.from("brands").select("id, name, logo_url"),
    supabase.from("campaign_recaps").select("id, name, slug, client_name, admin_campaign_id").eq("type", "recap"),
    supabase.from("admin_campaigns").select("brand"),
  ]);
  const brands = (brandsRes.data as BrandRow[]) || [];
  const recaps = (recapsRes.data as RecapRow[]) || [];
  const adminBrands = ((adminBrandsRes.data as { brand: string | null }[]) || []).map((a) => a.brand);
  return { brands, recaps, knownBrands: knownBrandSet(brands.map((b) => b.name), adminBrands) };
}

// ── Plan assembly ─────────────────────────────────────────────────────────────

export type Disposition = "create" | "skip" | "flag";

export interface RecapPlan {
  campaignId?: string;
  itemId: string;
  slackName: string;
  slackBrand: string;

  disposition: Disposition;
  skipReason?: string;     // when disposition==='skip'
  flagReasons: string[];   // when disposition==='flag' (hard brakes)
  warnings: string[];      // soft notes surfaced on the created recap

  admin: { found: boolean; missingId: boolean; nonNumericId: boolean; name?: string; brand?: string; status?: string };
  existingRecapId?: string;
  fuzzyExisting?: { id: string; slug: string; name: string } | null;

  // Build artifacts (present when disposition==='create' OR forceBuild)
  name?: string;
  brand?: BrandMatch;
  slug?: string;
  driveFolderId?: string | null;
  tracker?: TrackerFetchResult;
  athletes?: AthleteRowBase[];
  athleteCount?: number;
  hiddenHeroes?: HeroMetricOverrideKey[];
  heroValues?: Record<HeroMetricOverrideKey, number>;
  recapInsert?: Record<string, unknown>;
}

function detailsHaveContent(d: ParsedDetails): boolean {
  return !!(
    d.campaignGoals ||
    d.takeaways ||
    d.rawUnstructured ||
    (d.campaignType && d.campaignType.length) ||
    (d.platforms && d.platforms.length) ||
    d.athleteTarget || d.contentUnitTarget || d.impressionTarget ||
    d.engagementTarget || d.engagementRateTarget || d.cpmTarget || d.otherKpis
  );
}

/**
 * Assess + build the plan for one request. `forceBuild` builds the full payload
 * (tracker fetch, athletes, hidden heroes, recapInsert) even when the disposition
 * is skip/flag — used by dry-run so a human can see what WOULD be written.
 */
export async function buildRecapPlan(
  supabase: SupabaseClient,
  request: RecapRequest,
  ctx: IntakeContext,
  opts: { forceBuild?: boolean } = {},
): Promise<RecapPlan> {
  const slackName = request.campaignName || "";
  const slackBrand = request.brand || "";
  const idStr = (request.campaignId || "").trim();
  const missingId = idStr === "";
  const idNum = parseInt(idStr, 10);
  const nonNumericId = !missingId && String(idNum) !== idStr;

  const flagReasons: string[] = [];
  const warnings: string[] = [];

  // ── Admin validation (Fix 3) ──
  const adminRow: AdminCampaign | null = !missingId && !nonNumericId ? await getAdminCampaign(supabase, idNum) : null;
  const admin = {
    found: !!adminRow,
    missingId,
    nonNumericId,
    name: adminRow?.name,
    brand: adminRow?.brand ?? undefined,
    status: adminRow?.status ?? undefined,
  };

  // ── Dedup: exact admin_campaign_id (Fix 2 step 1) ──
  const existing = !missingId ? ctx.recaps.find((r) => r.admin_campaign_id === idStr) : undefined;
  const existingRecapId = existing?.id;

  // ── Fuzzy existing-recap (Fix 2 step 2) ──
  const fuzzyName = adminRow?.name || slackName;
  const fuzzyBrand = adminRow?.brand || slackBrand;
  const fuzzyExisting =
    !existingRecapId && fuzzyName
      ? findFuzzyExistingRecap(ctx.recaps, fuzzyName, fuzzyBrand)
      : null;

  // ── Safety brake (Fix 4) ──
  if (missingId) flagReasons.push("campaign ID missing");
  else if (nonNumericId) flagReasons.push(`campaign ID "${idStr}" is not numeric`);
  else if (!adminRow) flagReasons.push(`campaign ID ${idStr} not found in admin — cannot verify`);
  if (slackName && ctx.knownBrands.has(normLoose(slackName))) {
    flagReasons.push(`Slack campaign name "${slackName}" is a known brand — likely a mis-filed row`);
  }
  if (!detailsHaveContent(request.details) && !request.performanceTrackerUrl) {
    flagReasons.push("empty Details and no tracker link — nothing to build a recap from");
  }
  if (fuzzyExisting) {
    flagReasons.push(`possible existing recap: ${editorUrlFor(fuzzyExisting.id)} ("${fuzzyExisting.name}")`);
  }

  // ── Disposition ──
  let disposition: Disposition;
  let skipReason: string | undefined;
  if (existingRecapId) {
    disposition = "skip";
    skipReason = `already exists (recap ${editorUrlFor(existingRecapId)})`;
  } else if (flagReasons.length > 0) {
    disposition = "flag";
  } else {
    disposition = "create";
  }

  const plan: RecapPlan = {
    campaignId: request.campaignId,
    itemId: request.itemId,
    slackName,
    slackBrand,
    disposition,
    skipReason,
    flagReasons,
    warnings,
    admin,
    existingRecapId,
    fuzzyExisting,
  };

  // ── Build payload (when creating, or when a dry-run wants to preview) ──
  const shouldBuild = disposition === "create" || opts.forceBuild;
  if (!shouldBuild) return plan;

  // Admin is the naming authority; fall back to Slack values only when unverified.
  const authoritativeName = adminRow?.name || slackName;
  const brandSource = adminRow?.brand || slackBrand;
  const brand = matchBrandInList(ctx.brands, brandSource);

  // Disagreement notes (Fix 3 step 3) — only meaningful when admin verified.
  if (adminRow) {
    if (slackName && normLoose(slackName) !== normLoose(adminRow.name)) {
      warnings.push(`Slack row said name "${slackName}", admin says "${adminRow.name}" — used admin. Verify in editor.`);
    }
    if (slackBrand && adminRow.brand && normLoose(slackBrand) !== normLoose(adminRow.brand)) {
      warnings.push(`Slack row said brand "${slackBrand}", admin says "${adminRow.brand}" — used admin. Verify in editor.`);
    }
  }
  if (!brand.matched) warnings.push("brand not matched — set brand in the editor");
  else if (brand.confidence === "fuzzy") warnings.push(`brand matched fuzzily to "${brand.client_name}" — verify in editor`);

  const tracker = await fetchTrackerCsv(request.performanceTrackerUrl);
  let athletes: AthleteRowBase[] = [];
  if (tracker.ok && tracker.csv) {
    try {
      athletes = parseTrackerAthletes(tracker.csv);
      if (athletes.length === 0) warnings.push("tracker parsed to 0 athletes");
    } catch (e: any) {
      tracker.ok = false;
      tracker.reason = `parse error: ${String(e?.message || e)}`;
    }
  }
  if (!tracker.ok) warnings.push(`tracker import skipped (${tracker.reason})`);

  const { hidden, heroValues } = computeHiddenHeroes(athletes);
  const settings = buildSettings(request.details, brand, hidden);
  const slug = makeSlug(authoritativeName);
  const driveFolderId = request.contentFolderId ?? null;

  const recapInsert: Record<string, unknown> = {
    name: authoritativeName,
    slug,
    client_name: brand.matched ? brand.client_name : brandSource || authoritativeName,
    brand_id: brand.brand_id,
    type: "recap",
    admin_campaign_id: request.campaignId ?? null,
    drive_folder_id: driveFolderId,
    published: false,
    status: "draft",
    settings,
  };

  return {
    ...plan,
    name: authoritativeName,
    brand,
    slug,
    driveFolderId,
    tracker,
    athletes,
    athleteCount: athletes.length,
    hiddenHeroes: hidden,
    heroValues,
    recapInsert,
  };
}

// ── Commit (live write) ───────────────────────────────────────────────────────

export interface CommitResult {
  recapId: string;
  athletesInserted: number;
  editorUrl: string;
}

/** INSERT the draft recap + its athletes. INSERT-only; never touches existing rows. */
export async function commitRecap(supabase: SupabaseClient, plan: RecapPlan): Promise<CommitResult> {
  if (!plan.recapInsert) throw new Error("plan has no recapInsert (not a create disposition)");
  const { data: recap, error } = await supabase
    .from("campaign_recaps")
    .insert(plan.recapInsert)
    .select("id")
    .single();
  if (error || !recap) throw new Error(`recap insert failed: ${error?.message || "no row returned"}`);
  const recapId = recap.id as string;

  let athletesInserted = 0;
  const athletes = plan.athletes || [];
  if (athletes.length > 0) {
    const rows = athletes.map((a) => ({ ...a, campaign_id: recapId }));
    const { error: aerr, count } = await supabase.from("athletes").insert(rows, { count: "exact" });
    if (aerr) throw new Error(`recap ${recapId} created, but athlete insert failed: ${aerr.message}`);
    athletesInserted = count ?? athletes.length;
  }
  return { recapId, athletesInserted, editorUrl: editorUrlFor(recapId) };
}

export function editorUrlFor(recapId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://postgame-hub.vercel.app";
  return `${base.replace(/\/$/, "")}/dashboard/${recapId}`;
}

// ── Slack posting ─────────────────────────────────────────────────────────────

const RECAP_CHANNEL = "C09L87NMHSN"; // #campaign-recaps

async function slackPostMessage(text: string): Promise<{ ok: boolean; error?: string; text: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: "SLACK_BOT_TOKEN not set", text };
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: RECAP_CHANNEL, text, unfurl_links: false }),
      cache: "no-store",
    });
    const json = await res.json();
    return json.ok ? { ok: true, text } : { ok: false, error: json.error, text };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e), text };
  }
}

/** Confirmation for a created recap. Never throws. */
export async function postRecapConfirmation(plan: RecapPlan, commit: CommitResult) {
  const brandLabel = plan.brand?.matched ? plan.brand.client_name : plan.slackBrand || "brand?";
  const trackerLine = plan.tracker?.ok
    ? `Tracker: imported ${commit.athletesInserted} rows`
    : `Tracker: ⚠️ import skipped (${plan.tracker?.reason || "n/a"})`;
  const warnLines = plan.warnings.length ? "\n" + plan.warnings.map((w) => `⚠️ ${w}`).join("\n") : "";
  const text =
    `✅ Draft recap created for *${plan.name || plan.slackName}* (${brandLabel})\n` +
    `→ ${commit.editorUrl}\n` +
    `${trackerLine}${warnLines}`;
  return slackPostMessage(text);
}

/** Flag message for a request the pipeline refused to auto-create. Never throws. */
export async function postFlag(plan: RecapPlan) {
  const label = plan.slackName || (plan.campaignId ? `ID ${plan.campaignId}` : "unknown");
  const idPart = plan.campaignId ? ` (ID ${plan.campaignId})` : "";
  const text =
    `⚠️ Recap intake needs a human — *${label}*${idPart}\n` +
    plan.flagReasons.map((r) => `• ${r}`).join("\n") +
    `\nSkipped auto-create. Create manually in the Hub if intended.`;
  return slackPostMessage(text);
}

/**
 * Post a flag AT MOST ONCE per Slack row. Checks recap_intake_flags first; if this
 * item was already flagged, stays silent. Records the flag only after a successful
 * post, so a Slack failure retries on the next run. Never throws.
 */
export async function postFlagOnce(
  supabase: SupabaseClient,
  plan: RecapPlan,
): Promise<{ posted: boolean; alreadyFlagged?: boolean; ok?: boolean; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from("recap_intake_flags")
      .select("item_id")
      .eq("item_id", plan.itemId)
      .maybeSingle();
    if (existing) return { posted: false, alreadyFlagged: true };

    const slack = await postFlag(plan);
    if (slack.ok) {
      await supabase.from("recap_intake_flags").insert({
        item_id: plan.itemId,
        campaign_id: plan.campaignId ?? null,
        reasons: plan.flagReasons.join("; "),
      });
    }
    return { posted: true, ok: slack.ok, error: slack.error };
  } catch (e: any) {
    return { posted: false, error: String(e?.message || e) };
  }
}
