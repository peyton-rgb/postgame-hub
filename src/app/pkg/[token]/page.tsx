import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { AssetPackage, BrandKit, Talent } from "@/lib/packages";
import PackageClient from "./PackageClient";
import PackageShell from "./PackageShell";

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
// Belt-and-suspenders with the no-store client below: the status gate is
// security-sensitive (a draft must never leak), and Supabase-js reads through
// `fetch`, which Next will otherwise Data-Cache. Force every fetch in this
// segment to bypass the cache so `status` is always read live.
export const fetchCache = "force-no-store";

type Props = { params: Promise<{ token: string }> };

const BRAND_COLUMNS =
  "id, name, slug, primary_color, secondary_color, brand_colors, font_primary, font_secondary, font_primary_url, font_secondary_url, brand_fonts, logo_primary_url, logo_dark_url, logo_light_url, logo_white_url, logo_mark_url";

// Service-role client (server-only) whose every request opts out of the Next
// Data Cache. `createServiceSupabase()` would otherwise let Next cache the
// asset_packages read, so a package that was ever loaded while live would keep
// serving after being set back to draft. The token still gates everything.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: any, init?: any) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}

async function loadPackage(token: string) {
  const supabase = serviceClient();
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

  // Postgame owns the chrome; the client owns the content. The shell frames the
  // client-skinned package (unchanged) in the Postgame dark wrapper.
  return (
    <PackageShell pkg={data.pkg}>
      <PackageClient pkg={data.pkg} brand={data.brand} talent={data.talent} />
    </PackageShell>
  );
}
