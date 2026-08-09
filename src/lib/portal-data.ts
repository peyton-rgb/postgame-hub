import { createServiceSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

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

// The token is the ONLY gate. One brand or 404 — never a fallback brand.
export async function getPortalBrand(token: string): Promise<PortalBrand> {
  const supabase = createServiceSupabase();
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("portal_token", token)
    .single();

  if (!brand) notFound();
  return brand as PortalBrand;
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
