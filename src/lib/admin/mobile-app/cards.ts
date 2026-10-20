// ============================================================
// Mobile app cards — server loaders and database queries
// Behind /admin/mobile-app/cards and /admin/mobile-app/feed.
//
// For client components, import from ./types instead to avoid
// pulling in db/auth/server headers into client bundles.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { safeQuery } from "@/lib/admin/db";
import { BRAND_COLUMNS } from "@/lib/admin/campaigns/queries";
import type { BrandLite } from "@/lib/admin/campaigns/types";
import {
  EMPTY_WHITELIST,
  fromRow,
  type BrandOption,
  type CampaignOption,
  type AudienceOption,
  type CardRow,
  type CardsListResult,
  type EditorOptions,
  type Whitelist,
} from "./types";

export * from "./types";

type Db = SupabaseClient<any, "public", any>;

// ------------------------------------------------------------
// Loaders
// ------------------------------------------------------------

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
