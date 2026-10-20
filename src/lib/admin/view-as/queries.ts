// ============================================================
// View as — server loaders for the staff Brand portals list and the
// brand-employee / athlete previews rendered inside /admin.
//
// Server only (service client). The brand screens themselves reuse the
// live portal's loaders in src/lib/portal/* so a preview shows exactly
// what the brand's portal reads; this file only adds what those don't
// cover: the brand header, the list of brands, the review queue, and
// the athlete (app user) side.
//
// Tables (verified against xqaybwhpgxillpbbqtks, 2026-10-20):
//   portal_campaigns          brand campaign list (647 rows, < 1000 cap)
//   brand_contacts            brand portal logins (status 'active')
//   athlete_deliverables      the review queue — a piece is "sent to the
//                             brand" once sent_to_brand_at is set
//   optin_campaigns           LIVE opt-in spine (not campaign_optins)
//   athlete_campaign_optins   an athlete's opt-ins; athlete_id → profiles
//   profiles                  app users: access_level = 'athlete'
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import type {
  AthleteDeal,
  PickOption,
  PortalBrandRow,
  PreviewAthlete,
  PreviewBrandHead,
  ReviewPiece,
  ReviewStatus,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);

interface BrandRow {
  id: string;
  name: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  logo_white_url: string | null;
  logo_primary_url: string | null;
  logo_mark_url: string | null;
}
const BRAND_COLS = "id, name, logo_dark_url, logo_light_url, logo_white_url, logo_primary_url, logo_mark_url";

/** logo_light_url = light INK, for dark backgrounds (CLAUDE.md: the name is the ink). */
const onDark = (b: BrandRow | null) => b?.logo_light_url || b?.logo_white_url || null;
const onLight = (b: BrandRow | null) => b?.logo_dark_url || b?.logo_primary_url || b?.logo_mark_url || null;

function head(b: BrandRow): PreviewBrandHead {
  return { id: b.id, name: (b.name ?? "Brand").trim(), logoOnDark: onDark(b), logoOnLight: onLight(b) };
}

export async function loadPreviewBrand(brandId: string): Promise<PreviewBrandHead | null> {
  if (!isUuid(brandId)) return null;
  const { data } = await createServiceSupabase().from("brands").select(BRAND_COLS).eq("id", brandId).maybeSingle();
  return data ? head(data as BrandRow) : null;
}

// ------------------------------------------------------------
// Brand portals list (staff) + the brand picker
// ------------------------------------------------------------

export async function loadPortalBrands(): Promise<{ rows: PortalBrandRow[]; error: string | null; usersPending: boolean }> {
  const supabase = createServiceSupabase();
  const [campRes, brandRes, contactRes] = await Promise.all([
    supabase.from("portal_campaigns").select("brand_id, name, lifecycle_status, admin_created_on").limit(5000),
    supabase.from("brands").select(BRAND_COLS).limit(1000),
    safeQuery(() => supabase.from("brand_contacts").select("brand_id, status").eq("status", "active").limit(5000)),
  ]);
  if (campRes.error) return { rows: [], error: campRes.error.message, usersPending: false };

  const byBrand = new Map<string, { total: number; active: number; latestName: string | null; latestDate: string | null }>();
  for (const c of (campRes.data ?? []) as { brand_id: string | null; name: string | null; lifecycle_status: string | null; admin_created_on: string | null }[]) {
    if (!c.brand_id) continue;
    const e = byBrand.get(c.brand_id) ?? { total: 0, active: 0, latestName: null, latestDate: null };
    e.total += 1;
    if (c.lifecycle_status === "active") e.active += 1;
    if (c.admin_created_on && (!e.latestDate || c.admin_created_on > e.latestDate)) {
      e.latestDate = c.admin_created_on;
      e.latestName = c.name;
    } else if (!e.latestName && !e.latestDate) e.latestName = c.name;
    byBrand.set(c.brand_id, e);
  }

  const users = new Map<string, number>();
  for (const r of ((contactRes.data ?? []) as { brand_id: string }[])) users.set(r.brand_id, (users.get(r.brand_id) ?? 0) + 1);

  const rows: PortalBrandRow[] = [];
  for (const b of (brandRes.data ?? []) as unknown as BrandRow[]) {
    const e = byBrand.get(b.id);
    if (!e) continue;
    rows.push({
      id: b.id,
      name: (b.name ?? "Brand").trim(),
      logo: onLight(b),
      total: e.total,
      active: e.active,
      latestName: e.latestName,
      latestDate: e.latestDate,
      users: contactRes.pending || contactRes.error ? null : users.get(b.id) ?? 0,
    });
  }
  return { rows, error: null, usersPending: contactRes.pending };
}

/** Brands that have at least one portal campaign, A→Z — the View-as brand picker. */
export async function loadBrandOptions(): Promise<PickOption[]> {
  const { rows } = await loadPortalBrands();
  return rows
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({ id: r.id, label: r.name }));
}

// ------------------------------------------------------------
// Review & approve — deliverables sent to the brand
// ------------------------------------------------------------

function reviewStatus(d: { approved_at: string | null; status: string | null; review_note: string | null }): ReviewStatus {
  if (d.approved_at) return "Approved";
  const s = (d.status ?? "").toLowerCase();
  if (s.includes("revision") || s.includes("change") || (s === "rejected" && d.review_note)) return "Changes requested";
  return "Needs approval";
}

export async function loadReviewQueue(brandId: string): Promise<{ pieces: ReviewPiece[]; error: string | null }> {
  const supabase = createServiceSupabase();
  const camps = await supabase.from("optin_campaigns").select("id, title").eq("brand_id", brandId);
  if (camps.error) return { pieces: [], error: camps.error.message };
  const titles = new Map(((camps.data ?? []) as { id: string; title: string | null }[]).map((c) => [c.id, c.title ?? "Campaign"]));
  if (titles.size === 0) return { pieces: [], error: null };

  const res = await supabase
    .from("athlete_deliverables")
    .select("id, athlete_id, optin_campaign_id, slot, slot_index, status, review_note, file_url, thumbnail_url, media_type, sent_to_brand_at, approved_at")
    .in("optin_campaign_id", Array.from(titles.keys()))
    .not("sent_to_brand_at", "is", null)
    .order("sent_to_brand_at", { ascending: false })
    .limit(500);
  if (res.error) return { pieces: [], error: res.error.message };
  const rows = (res.data ?? []) as {
    id: string; athlete_id: string; optin_campaign_id: string; slot: string | null; slot_index: number | null; status: string | null;
    review_note: string | null; file_url: string | null; thumbnail_url: string | null; media_type: string | null;
    sent_to_brand_at: string | null; approved_at: string | null;
  }[];

  const ids = Array.from(new Set(rows.map((r) => r.athlete_id)));
  const people = new Map<string, { full_name: string | null; display_name: string | null; ig_handle: string | null; school: string | null }>();
  if (ids.length) {
    const p = await supabase.from("profiles").select("id, full_name, display_name, ig_handle, school").in("id", ids);
    for (const r of (p.data ?? []) as { id: string; full_name: string | null; display_name: string | null; ig_handle: string | null; school: string | null }[]) people.set(r.id, r);
  }

  return {
    error: null,
    pieces: rows.map((r) => {
      const p = people.get(r.athlete_id);
      const isVideo = r.media_type === "video" || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(r.file_url ?? "");
      return {
        id: r.id,
        athleteName: (p?.full_name || p?.display_name || "Athlete").trim(),
        igHandle: p?.ig_handle ? "@" + p.ig_handle.replace(/^@/, "") : null,
        school: p?.school ?? null,
        campaign: titles.get(r.optin_campaign_id) ?? "Campaign",
        slot: r.slot,
        slotIndex: r.slot_index,
        isVideo,
        fileUrl: r.file_url,
        thumbUrl: r.thumbnail_url || (isVideo ? null : r.file_url),
        sentAt: r.sent_to_brand_at,
        approvedAt: r.approved_at,
        note: r.review_note,
        status: reviewStatus(r),
      };
    }),
  };
}

// ------------------------------------------------------------
// Athletes (app users)
// ------------------------------------------------------------

const PROFILE_COLS = "id, email, full_name, display_name, avatar_url, ig_handle, tiktok_handle, school, sport, class_year, paypal_linked, w9_status, reach_total, access_level";

function toAthlete(r: Record<string, unknown>): PreviewAthlete {
  const s = (k: string) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string).trim() : null);
  return {
    id: r.id as string,
    name: s("full_name") ?? s("display_name") ?? s("email") ?? "Athlete",
    email: s("email"),
    igHandle: s("ig_handle") ? "@" + s("ig_handle")!.replace(/^@/, "") : null,
    tiktokHandle: s("tiktok_handle") ? "@" + s("tiktok_handle")!.replace(/^@/, "") : null,
    school: s("school"),
    sport: s("sport"),
    classYear: r.class_year == null ? null : String(r.class_year),
    avatarUrl: s("avatar_url"),
    paypalLinked: typeof r.paypal_linked === "boolean" ? r.paypal_linked : null,
    w9Status: s("w9_status"),
    reachTotal: typeof r.reach_total === "number" ? r.reach_total : r.reach_total == null ? null : Number(r.reach_total) || null,
  };
}

export async function loadAthleteOptions(): Promise<PickOption[]> {
  const { data } = await createServiceSupabase()
    .from("profiles")
    .select("id, full_name, display_name, email")
    .eq("access_level", "athlete")
    .order("full_name")
    .limit(500);
  return ((data ?? []) as { id: string; full_name: string | null; display_name: string | null; email: string | null }[]).map((p) => ({
    id: p.id,
    label: (p.full_name || p.display_name || p.email || "Athlete").trim(),
  }));
}

export async function loadPreviewAthlete(id: string): Promise<PreviewAthlete | null> {
  if (!isUuid(id)) return null;
  const { data } = await createServiceSupabase().from("profiles").select(PROFILE_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  if (row.access_level !== "athlete") return null;
  return toAthlete(row);
}

export async function loadAthleteDeals(athleteId: string): Promise<{ deals: AthleteDeal[]; error: string | null }> {
  const supabase = createServiceSupabase();
  const optRes = await supabase
    .from("athlete_campaign_optins")
    .select("id, optin_campaign_id, status, created_at")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  if (optRes.error) return { deals: [], error: optRes.error.message };
  const opts = (optRes.data ?? []) as { id: string; optin_campaign_id: string; status: string | null; created_at: string | null }[];
  if (!opts.length) return { deals: [], error: null };

  const campIds = Array.from(new Set(opts.map((o) => o.optin_campaign_id)));
  const [campRes, delRes] = await Promise.all([
    supabase.from("optin_campaigns").select("id, title, brand_id, payout, deadline").in("id", campIds),
    supabase.from("athlete_deliverables").select("id, optin_id, slot, slot_index, status, paid_at, posted_at").eq("athlete_id", athleteId),
  ]);
  const camps = new Map(((campRes.data ?? []) as { id: string; title: string | null; brand_id: string | null; payout: string | null; deadline: string | null }[]).map((c) => [c.id, c]));
  const brandIds = Array.from(new Set(Array.from(camps.values()).map((c) => c.brand_id).filter((x): x is string => !!x)));
  const brands = new Map<string, BrandRow>();
  if (brandIds.length) {
    const b = await supabase.from("brands").select(BRAND_COLS).in("id", brandIds);
    for (const r of (b.data ?? []) as BrandRow[]) brands.set(r.id, r);
  }
  const dels = (delRes.data ?? []) as { id: string; optin_id: string; slot: string | null; slot_index: number | null; status: string | null; paid_at: string | null; posted_at: string | null }[];

  return {
    error: null,
    deals: opts.map((o) => {
      const c = camps.get(o.optin_campaign_id);
      const b = c?.brand_id ? brands.get(c.brand_id) ?? null : null;
      return {
        optinId: o.id,
        campaignId: o.optin_campaign_id,
        title: c?.title ?? "Campaign",
        brandName: b?.name?.trim() ?? null,
        brandLogoOnDark: onDark(b),
        status: o.status,
        payout: c?.payout == null ? null : String(c.payout),
        deadline: c?.deadline ?? null,
        createdAt: o.created_at,
        deliverables: dels
          .filter((d) => d.optin_id === o.id)
          .sort((x, y) => (x.slot_index ?? 0) - (y.slot_index ?? 0))
          .map((d) => ({ id: d.id, slot: d.slot, status: d.status, paidAt: d.paid_at, postedAt: d.posted_at })),
      };
    }),
  };
}

/** The opt-in page the athlete opens from a card: their newest opt-in, else the newest published one. */
export async function loadOptinForAthlete(athleteId: string): Promise<{
  campaign: { id: string; title: string; headline: string | null; goal: string | null; payout: string | null; deadline: string | null; requirements: string | null; heroUrl: string | null } | null;
  brand: PreviewBrandHead | null;
  optedIn: boolean;
}> {
  const supabase = createServiceSupabase();
  const mine = await supabase.from("athlete_campaign_optins").select("optin_campaign_id").eq("athlete_id", athleteId).order("created_at", { ascending: false }).limit(1);
  let id = ((mine.data ?? []) as { optin_campaign_id: string }[])[0]?.optin_campaign_id ?? null;
  const optedIn = !!id;
  const cols = "id, title, headline, goal, payout, deadline, requirements, hero_image_url, brand_id, status";
  let row: Record<string, unknown> | null = null;
  if (id) row = ((await supabase.from("optin_campaigns").select(cols).eq("id", id).maybeSingle()).data as Record<string, unknown> | null) ?? null;
  if (!row) {
    const pub = await supabase.from("optin_campaigns").select(cols).not("published_at", "is", null).order("published_at", { ascending: false }).limit(1);
    row = ((pub.data ?? []) as Record<string, unknown>[])[0] ?? null;
    id = (row?.id as string) ?? null;
  }
  if (!row) return { campaign: null, brand: null, optedIn: false };
  const brand = typeof row.brand_id === "string" ? await loadPreviewBrand(row.brand_id) : null;
  const str = (k: string) => (row![k] == null ? null : String(row![k]));
  return {
    campaign: { id: row.id as string, title: str("title") ?? "Campaign", headline: str("headline"), goal: str("goal"), payout: str("payout"), deadline: str("deadline"), requirements: str("requirements"), heroUrl: str("hero_image_url") },
    brand,
    optedIn,
  };
}

/** The Postgame people on this brand's campaigns (portal_campaigns.manager_*), live campaigns first. */
export async function loadBrandManagers(brandId: string): Promise<{ name: string; email: string | null; campaigns: number; live: boolean }[]> {
  const { data } = await createServiceSupabase()
    .from("portal_campaigns")
    .select("manager_name, manager_email, lifecycle_status")
    .eq("brand_id", brandId)
    .limit(1000);
  const by = new Map<string, { name: string; email: string | null; campaigns: number; live: boolean }>();
  for (const r of (data ?? []) as { manager_name: string | null; manager_email: string | null; lifecycle_status: string | null }[]) {
    const name = r.manager_name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const e = by.get(key) ?? { name, email: r.manager_email, campaigns: 0, live: false };
    e.campaigns += 1;
    if (r.lifecycle_status === "active") e.live = true;
    if (!e.email && r.manager_email) e.email = r.manager_email;
    by.set(key, e);
  }
  return Array.from(by.values()).sort((a, b) => Number(b.live) - Number(a.live) || b.campaigns - a.campaigns);
}
