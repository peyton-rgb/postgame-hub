// ============================================================
// Athlete deals — server data helpers
//
// Reads the canonical optin_campaigns table (+ embedded brand) and the
// athlete's own participation rows. All reads use the cookie-aware server
// client so RLS scopes opt-ins to the logged-in athlete.
// ============================================================

import { createServerSupabase } from "@/lib/supabase-server";

export type DealBrand = {
  name: string | null;
  logo_url: string | null;
  logo_white_url: string | null;
  primary_color: string | null;
};

export type Deal = {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  goal: string | null;
  requirements: string | null;
  payout: string | null;
  deadline: string | null;
  hero_image_url: string | null;
  accent_color: string | null;
  status: string;
  social_platforms: string[] | null;
  required_deliverables: string[] | null;
  brand: DealBrand | null;
};

export type MyOptin = {
  id: string;
  optin_campaign_id: string;
  status: string;
  ftc_ack: boolean;
};

const DEAL_SELECT =
  "id,slug,title,headline,goal,requirements,payout,deadline,hero_image_url,accent_color,status,social_platforms,required_deliverables,brand:brands(name,logo_url,logo_white_url,primary_color)";

// Brand embeds come back as an array from PostgREST depending on the FK
// shape; normalize to a single object.
function normalizeDeal(row: any): Deal {
  const brand = Array.isArray(row?.brand) ? row.brand[0] ?? null : row?.brand ?? null;
  return { ...row, brand } as Deal;
}

// Deals shown on the home feed: LIVE (opt-in-able) only. Drafts are
// unpublished and must never surface to athletes — the earlier
// status IN ('live','draft') leaked unpublished campaigns into the feed.
// Coming-soon drops are a separate, deferred feature.
export async function getVisibleDeals(): Promise<Deal[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("optin_campaigns")
    .select(DEAL_SELECT)
    .eq("status", "live")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getVisibleDeals error:", error.message);
    return [];
  }
  return (data ?? []).map(normalizeDeal);
}

export async function getDealBySlug(slug: string): Promise<Deal | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("optin_campaigns")
    .select(DEAL_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getDealBySlug error:", error.message);
    return null;
  }
  return data ? normalizeDeal(data) : null;
}

// The athlete's opt-ins, keyed by optin_campaign_id for quick lookup.
export async function getMyOptinsMap(athleteId: string): Promise<Record<string, MyOptin>> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("athlete_campaign_optins")
    .select("id,optin_campaign_id,status,ftc_ack")
    .eq("athlete_id", athleteId);

  if (error) {
    console.error("getMyOptinsMap error:", error.message);
    return {};
  }
  const map: Record<string, MyOptin> = {};
  for (const row of data ?? []) map[row.optin_campaign_id] = row as MyOptin;
  return map;
}

export async function getMyOptin(athleteId: string, campaignId: string): Promise<MyOptin | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("athlete_campaign_optins")
    .select("id,optin_campaign_id,status,ftc_ack")
    .eq("athlete_id", athleteId)
    .eq("optin_campaign_id", campaignId)
    .maybeSingle();

  if (error) {
    console.error("getMyOptin error:", error.message);
    return null;
  }
  return (data as MyOptin) ?? null;
}
