import { createServiceSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { AssetPackage, BrandKit, Talent } from "@/lib/packages";
import PackageClient from "./PackageClient";

// Public, token-gated editor asset package (grab-and-go brand kit + name-tag
// generator). Mirrors the brand portal at /portal/[token]:
//
//   • The share_token is the ONLY gate. We look up exactly one package by it.
//   • RLS already blocks anon from non-live packages, but we use the
//     service-role client (server-only) so the lookup is uniform, and we
//     GUARD status here: anything not 'live' 404s, so a draft link is dead for
//     the public even though staff seeded it.
//   • Everything is scoped to this one package's brand + talent, so the token
//     stays the gate.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const BRAND_COLUMNS =
  "id, name, slug, primary_color, secondary_color, brand_colors, font_primary, font_secondary, font_primary_url, font_secondary_url, logo_primary_url, logo_dark_url, logo_light_url, logo_white_url, logo_mark_url";

async function loadPackage(token: string) {
  const supabase = createServiceSupabase();
  const { data: pkg } = await supabase
    .from("asset_packages")
    .select("*")
    .eq("share_token", token)
    .single();

  // Token miss OR not published → dead link for the public.
  if (!pkg || (pkg as AssetPackage).status !== "live") return null;

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", (pkg as AssetPackage).brand_id)
    .single();
  if (!brand) return null;

  const { data: talent } = await supabase
    .from("package_talent")
    .select("id, name, subtext, tag_url, slug, status, sort_order")
    .eq("package_id", (pkg as AssetPackage).id)
    .order("sort_order", { ascending: true });

  return {
    pkg: pkg as AssetPackage,
    brand: brand as unknown as BrandKit,
    talent: (talent || []) as Talent[],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const robots = { index: false, follow: false } as const;
  const data = await loadPackage(token);
  if (!data) return { title: "Not Found", robots };
  return {
    title: `${data.pkg.name} — Asset Package`,
    description: `Logos, colors, fonts and name tags for ${data.brand.name}.`,
    robots,
  };
}

export default async function PackagePage({ params }: Props) {
  const { token } = await params;
  const data = await loadPackage(token);
  if (!data) notFound();

  return (
    <PackageClient pkg={data.pkg} brand={data.brand} talent={data.talent} />
  );
}
