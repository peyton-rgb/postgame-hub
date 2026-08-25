import { createServiceSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import {
  BRAND_LOGO_COLUMNS,
  resolveBrandLogo,
  type BrandLogoRow,
} from "@/lib/brand-logo";

// SERVER ONLY. Uses the service-role client — never import this from a
// "use client" module. Client-safe design tokens live in src/lib/portal.ts.
//
// Why service-role: the portal must show the brand's DRAFT recaps
// (published = false), and RLS only returns published recaps to anon. Same
// rationale as the public recap page's preview mode. Every query below is
// scoped to one brand id resolved from the token, so the token stays the gate.

// Postgame's own brand row. Hard rule 1: the Postgame mark is a FILE, never
// typography — so we read the logo URL from the database rather than setting
// the word in a typeface, and rule 2 forbids hardcoding or approximating it.
export const POSTGAME_BRAND_ID = "7a0e28e9-d62f-427d-a207-cd22596fcf50";

export type PortalBrand = {
  id: string;
  name: string;
  [key: string]: any;
};

/**
 * Resolve this brand's portal logo and hang it on the brand row.
 *
 * The portal chrome is a DARK ground — BG is #07070a in lib/portal.ts, and
 * PortalFrame paints the logo straight onto it with no chip. So this asks for
 * `dark`, which means on_black. Asking for on_white here would hand back a
 * dark-ink file and produce an invisible logo on a client-facing screen, which
 * is the exact failure src/lib/brand-logo.ts exists to prevent.
 *
 * Preferring `lockup`: the nav slot is a horizontal strip (height 23, width
 * auto), which is the shape a lockup is drawn for. A mark still wins if the
 * brand has no dark lockup.
 *
 * Attached to the brand rather than resolved at each render site so both doors
 * — token and session — go through one place.
 */
export async function attachPortalLogo(brand: PortalBrand): Promise<PortalBrand> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("brand_logos")
    .select(BRAND_LOGO_COLUMNS)
    .eq("brand_id", brand.id);
  const resolved = resolveBrandLogo((data ?? []) as BrandLogoRow[], {
    surface: "dark",
    prefer: "lockup",
  });
  return resolved ? { ...brand, portalLogo: resolved } : brand;
}

// The token is the ONLY gate. One brand or 404 — never a fallback brand.
export async function getPortalBrand(token: string): Promise<PortalBrand> {
  const supabase = createServiceSupabase();
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("portal_token", token)
    .single();

  if (!brand) notFound();
  return attachPortalLogo(brand as PortalBrand);
}

// Count of assets genuinely awaiting THIS brand's decision, for the Review tab
// badge. Returns a live count, never a hardcoded number: review_sessions is
// empty today, so this returns 0 and the badge is suppressed — but it starts
// reporting the moment the table is populated. An empty badge would imply work
// that isn't there.
export async function getPendingReviewCount(brandId: string): Promise<number> {
  const supabase = createServiceSupabase();

  const { data: recaps } = await supabase
    .from("campaign_recaps")
    .select("id")
    .eq("brand_id", brandId);

  const ids = (recaps || []).map((r: any) => r.id);
  if (!ids.length) return 0;

  const { count } = await supabase
    .from("review_sessions")
    .select("id", { count: "exact", head: true })
    .in("campaign_id", ids)
    .is("brand_decision", null);

  return count ?? 0;
}

// Postgame's wordmark file for the header lockup. Light logo on the dark
// ground. Returns null rather than substituting anything — rule 2 says a
// missing logo is a labelled empty slot, never an approximation.
export async function getPostgameMark(): Promise<string | null> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("brands")
    .select("logo_light_url, logo_primary_url, logo_white_url, logo_dark_url")
    .eq("id", POSTGAME_BRAND_ID)
    .single();

  if (!data) return null;
  // On this dark ground the light mark reads first.
  return (
    data.logo_light_url ||
    data.logo_white_url ||
    data.logo_primary_url ||
    data.logo_dark_url ||
    null
  );
}
