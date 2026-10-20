// ============================================================
// Mobile app cards — types, shape rules and the server loaders behind
// /admin/mobile-app/cards and /admin/mobile-app/feed.
//
// Table: mobile_app_cards (+ mobile_app_card_whitelist), migration 086.
// Migration 083 declares the same table in the Lovable shape; `fromRow`
// reads either (title → headline, video_url/image_url → media_url,
// campaign_opt_in → optin) so the screens work in whichever order the
// migrations land. Writes always use the 086 columns; a missing column
// surfaces as the honest "migration 086" state, never a silent no-op.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { safeQuery } from "@/lib/admin/db";
import { BRAND_COLUMNS } from "@/lib/admin/campaigns/queries";
import type { BrandLite } from "@/lib/admin/campaigns/types";

type Db = SupabaseClient<any, "public", any>;

export const CARD_TYPES = ["optin", "coming_soon", "strip_banner"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const CARD_STATUSES = ["draft", "live", "archived"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export type Visibility = "everyone" | "whitelist";
export const WHITELIST_KINDS = ["college", "sport", "handle"] as const;
export type WhitelistKind = (typeof WHITELIST_KINDS)[number];

/** Canvas size per card type — the prototype's three formats. */
export const CARD_SPEC: Record<CardType, { label: string; width: number; height: number; aspect: string; defaultEyebrow: string; defaultCta: string; mediaHint: string }> = {
  optin: {
    label: "Opt-In",
    width: 1080,
    height: 1920,
    aspect: "9×16",
    defaultEyebrow: "NIL OPPORTUNITY",
    defaultCta: "OPT IN",
    mediaHint: "Vertical 1080 × 1920. Videos over 8MB are compressed in your browser before upload.",
  },
  coming_soon: {
    label: "Coming Soon",
    width: 1080,
    height: 1080,
    aspect: "1×1",
    defaultEyebrow: "DROPPING SOON",
    defaultCta: "",
    mediaHint: "Square 1080 × 1080. It is dimmed automatically so the white text reads.",
  },
  strip_banner: {
    label: "Strip Banner",
    width: 1920,
    height: 380,
    aspect: "strip",
    defaultEyebrow: "",
    defaultCta: "",
    mediaHint: "1920 × 380 banner image.",
  },
};

export interface CardRow {
  id: string;
  name: string;
  card_type: CardType;
  status: CardStatus;
  sort_order: number;
  brand_id: string | null;
  campaign_id: number | null;
  headline: string | null;
  eyebrow: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  bg_color: string | null;
  media_url: string | null;
  poster_url: string | null;
  visibility: Visibility;
  audience_id: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Whitelist {
  colleges: string[];
  sports: string[];
  handles: string[];
}

export const EMPTY_WHITELIST: Whitelist = { colleges: [], sports: [], handles: [] };

/** The editor's working copy: every field the form owns, never undefined. */
export interface CardDraft {
  name: string;
  card_type: CardType;
  status: CardStatus;
  brand_id: string | null;
  campaign_id: number | null;
  headline: string;
  eyebrow: string;
  body: string;
  cta_label: string;
  cta_href: string;
  bg_color: string;
  media_url: string;
  poster_url: string;
  visibility: Visibility;
  audience_id: string | null;
  schedule_start: string;
  schedule_end: string;
  whitelist: Whitelist;
}

export const DEFAULT_BG = "#2B2B30";

export function emptyDraft(type: CardType = "optin"): CardDraft {
  return {
    name: "",
    card_type: type,
    status: "draft",
    brand_id: null,
    campaign_id: null,
    headline: "",
    eyebrow: CARD_SPEC[type].defaultEyebrow,
    body: "",
    cta_label: CARD_SPEC[type].defaultCta,
    cta_href: "",
    bg_color: DEFAULT_BG,
    media_url: "",
    poster_url: "",
    visibility: "everyone",
    audience_id: null,
    schedule_start: "",
    schedule_end: "",
    whitelist: { ...EMPTY_WHITELIST },
  };
}

export function toDraft(row: CardRow, whitelist: Whitelist): CardDraft {
  return {
    name: row.name,
    card_type: row.card_type,
    status: row.status,
    brand_id: row.brand_id,
    campaign_id: row.campaign_id,
    headline: row.headline ?? "",
    eyebrow: row.eyebrow ?? CARD_SPEC[row.card_type].defaultEyebrow,
    body: row.body ?? "",
    cta_label: row.cta_label ?? "",
    cta_href: row.cta_href ?? "",
    bg_color: row.bg_color ?? DEFAULT_BG,
    media_url: row.media_url ?? "",
    poster_url: row.poster_url ?? "",
    visibility: row.visibility,
    audience_id: row.audience_id,
    schedule_start: toLocalInput(row.schedule_start),
    schedule_end: toLocalInput(row.schedule_end),
    whitelist,
  };
}

/** timestamptz → the value a <input type="datetime-local"> wants (local wall time). */
function toLocalInput(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ------------------------------------------------------------
// Row normalisation (083 Lovable shape or 086 Hub shape)
// ------------------------------------------------------------

const LEGACY_TYPE: Record<string, CardType> = {
  optin: "optin",
  campaign_opt_in: "optin",
  opt_in: "optin",
  coming_soon: "coming_soon",
  strip_banner: "strip_banner",
  strip: "strip_banner",
};

export function normalizeType(v: unknown): CardType {
  return (typeof v === "string" && LEGACY_TYPE[v]) || "optin";
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

export function fromRow(raw: Record<string, unknown>): CardRow {
  const status = raw.status === "live" || raw.status === "archived" ? raw.status : "draft";
  const campaign =
    typeof raw.campaign_id === "number"
      ? raw.campaign_id
      : typeof raw.link_campaign_id === "number"
        ? raw.link_campaign_id
        : null;
  return {
    id: String(raw.id),
    name: str(raw.name) ?? "Untitled card",
    card_type: normalizeType(raw.card_type),
    status,
    sort_order: typeof raw.sort_order === "number" ? raw.sort_order : typeof raw.display_order === "number" ? raw.display_order : 0,
    brand_id: str(raw.brand_id),
    campaign_id: campaign,
    headline: str(raw.headline) ?? str(raw.title),
    eyebrow: str(raw.eyebrow),
    body: str(raw.body),
    cta_label: str(raw.cta_label) ?? str(raw.cta),
    cta_href: str(raw.cta_href) ?? str(raw.cta_url),
    bg_color: str(raw.bg_color) ?? str(raw.bg),
    media_url: str(raw.media_url) ?? str(raw.video_url) ?? str(raw.image_url),
    poster_url: str(raw.poster_url) ?? (str(raw.video_url) ? str(raw.image_url) : null),
    visibility: raw.visibility === "whitelist" ? "whitelist" : "everyone",
    audience_id: str(raw.audience_id),
    schedule_start: str(raw.schedule_start),
    schedule_end: str(raw.schedule_end),
    created_at: str(raw.created_at),
    updated_at: str(raw.updated_at),
  };
}

export const isVideoUrl = (url: string | null | undefined): boolean =>
  !!url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

// ------------------------------------------------------------
// Loaders
// ------------------------------------------------------------

export interface CardsListResult {
  rows: CardRow[];
  /** mobile_app_cards missing → "Cards table not migrated yet (migration 086)" */
  pending: boolean;
  error: string | null;
}

export async function listCards(supabase: Db): Promise<CardsListResult> {
  const res = await safeQuery<Record<string, unknown>[]>(
    () =>
      supabase
        .from("mobile_app_cards")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }) as any
  );
  if (res.pending) return { rows: [], pending: true, error: null };
  if (res.error) return { rows: [], pending: false, error: res.error };
  return { rows: (res.data ?? []).map(fromRow), pending: false, error: null };
}

export async function loadCard(
  supabase: Db,
  id: string
): Promise<{ card: CardRow | null; whitelist: Whitelist; pending: boolean; error: string | null }> {
  const res = await safeQuery<Record<string, unknown> | null>(
    () => supabase.from("mobile_app_cards").select("*").eq("id", id).maybeSingle() as any
  );
  if (res.pending) return { card: null, whitelist: EMPTY_WHITELIST, pending: true, error: null };
  if (res.error) return { card: null, whitelist: EMPTY_WHITELIST, pending: false, error: res.error };
  if (!res.data) return { card: null, whitelist: EMPTY_WHITELIST, pending: false, error: null };
  const card = fromRow(res.data);
  const whitelist = await loadWhitelist(supabase, [id]);
  return { card, whitelist: whitelist.get(id) ?? EMPTY_WHITELIST, pending: false, error: null };
}

/** Whitelist rows for a set of cards, grouped per card. Missing table → empty. */
export async function loadWhitelist(supabase: Db, cardIds: string[]): Promise<Map<string, Whitelist>> {
  const out = new Map<string, Whitelist>();
  if (cardIds.length === 0) return out;
  const res = await safeQuery<{ card_id: string; kind: string; value: string }[]>(
    () => supabase.from("mobile_app_card_whitelist").select("card_id, kind, value").in("card_id", cardIds) as any
  );
  for (const r of res.data ?? []) {
    const w = out.get(r.card_id) ?? { colleges: [], sports: [], handles: [] };
    if (r.kind === "college") w.colleges.push(r.value);
    else if (r.kind === "sport") w.sports.push(r.value);
    else if (r.kind === "handle") w.handles.push(r.value);
    out.set(r.card_id, w);
  }
  return out;
}

export type BrandOption = BrandLite;
export interface CampaignOption {
  campaign_id: number;
  campaign_name: string | null;
  brand_id: string | null;
  is_active: boolean | null;
}
export interface AudienceOption {
  id: string;
  name: string;
}

export interface EditorOptions {
  brands: BrandOption[];
  campaigns: CampaignOption[];
  /** campaigns table missing (083 unapplied) */
  campaignsPending: boolean;
  audiences: AudienceOption[];
  audiencesPending: boolean;
}

/** Everything the editor's selects need: brands (with logos), campaigns, saved audiences. */
export async function loadEditorOptions(supabase: Db): Promise<EditorOptions> {
  const [brands, campaigns, audiences] = await Promise.all([
    safeQuery<BrandOption[]>(
      () => supabase.from("brands").select(BRAND_COLUMNS).eq("archived", false).order("name").limit(1000) as any
    ),
    safeQuery<CampaignOption[]>(
      () =>
        supabase
          .from("campaigns")
          .select("campaign_id, campaign_name, brand_id, is_active")
          .order("created_at", { ascending: false })
          .limit(2000) as any
    ),
    safeQuery<AudienceOption[]>(() => supabase.from("saved_audiences").select("id, name").order("name").limit(500) as any),
  ]);
  return {
    brands: brands.data ?? [],
    campaigns: campaigns.data ?? [],
    campaignsPending: campaigns.pending,
    audiences: audiences.data ?? [],
    audiencesPending: audiences.pending,
  };
}

/** Brands referenced by a set of cards, keyed by id (logos for tiles and the feed). */
export async function loadBrandsFor(supabase: Db, cards: CardRow[]): Promise<Map<string, BrandLite>> {
  const ids = Array.from(new Set(cards.map((c) => c.brand_id).filter((x): x is string => !!x)));
  const out = new Map<string, BrandLite>();
  if (ids.length === 0) return out;
  const res = await safeQuery<BrandLite[]>(() => supabase.from("brands").select(BRAND_COLUMNS).in("id", ids) as any);
  for (const b of res.data ?? []) out.set(b.id, b);
  return out;
}

// ------------------------------------------------------------
// Feed rules — what a given viewer sees
// ------------------------------------------------------------

export interface Viewer {
  /** null = "Everyone": only cards visible to everyone */
  audienceId: string | null;
}

/** Live, in-window, and visible to the viewer. Same rule the app will use. */
export function cardShowsTo(card: CardRow, whitelist: Whitelist | undefined, viewer: Viewer, now = new Date()): boolean {
  if (card.status !== "live") return false;
  if (card.schedule_start && new Date(card.schedule_start) > now) return false;
  if (card.schedule_end && new Date(card.schedule_end) < now) return false;
  if (card.visibility === "everyone") return true;
  if (viewer.audienceId && card.audience_id === viewer.audienceId) return true;
  // College / sport / handle matches need a signed-in athlete; the admin
  // preview can only honour the audience pick, so those stay hidden here.
  void whitelist;
  return false;
}

export function visibilityLabel(card: CardRow, whitelist: Whitelist | undefined, audienceName?: string | null): string {
  if (card.visibility === "everyone") return "Everyone";
  const parts: string[] = [];
  if (card.audience_id) parts.push(audienceName ? audienceName : "1 audience");
  const w = whitelist ?? EMPTY_WHITELIST;
  if (w.colleges.length) parts.push(`${w.colleges.length} college${w.colleges.length === 1 ? "" : "s"}`);
  if (w.sports.length) parts.push(`${w.sports.length} sport${w.sports.length === 1 ? "" : "s"}`);
  if (w.handles.length) parts.push(`${w.handles.length} handle${w.handles.length === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "Whitelist (empty)";
}
