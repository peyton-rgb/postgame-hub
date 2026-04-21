import { createPlainSupabase } from "@/lib/supabase";
import BtsSubmissionClient from "./BtsSubmissionClient";

/**
 * /bts — public BTS video submission page.
 *
 * Server component: fetches non-archived brands and all campaigns once
 * per request, then hands them to the client component as props. We
 * use the plain (anon-cookie-less) Supabase client because the brands
 * and campaign_recaps tables are anon-readable.
 */
export const dynamic = "force-dynamic";

export default async function BtsPage() {
  const supabase = createPlainSupabase();

  const [{ data: brandsRaw }, { data: campaignsRaw }] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name")
      .neq("archived", true)
      .order("name"),
    supabase
      .from("campaign_recaps")
      .select("id, name, brand_id")
      .order("name"),
  ]);

  const brands = (brandsRaw ?? []).filter(
    (b): b is { id: string; name: string } =>
      typeof b.id === "string" && typeof b.name === "string"
  );
  const campaigns = (campaignsRaw ?? []).filter(
    (c): c is { id: string; name: string; brand_id: string } =>
      typeof c.id === "string" &&
      typeof c.name === "string" &&
      typeof c.brand_id === "string"
  );

  return <BtsSubmissionClient brands={brands} campaigns={campaigns} />;
}
