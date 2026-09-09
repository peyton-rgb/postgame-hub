// ============================================================
// /deals — the deal ledger index.
//
// This page used to be a client component that fetched in the browser. Two
// things followed from that, both fatal for a page whose whole purpose is SEO
// and press: the ledger was not in the HTML a crawler receives, and a client
// component cannot export metadata, so the index inherited the root layout's
// "Postgame — The #1 NIL Agency" — the same title as every other page.
//
// So the fetch moves here, to the server, and the interactive parts (hero
// carousel, filters, the grid's device-dependent crops) stay in DealsClient.
// The rendering is unchanged; only where the data comes from has moved.
// ============================================================

import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import DealsClient from "./DealsClient";
import {
  BRAND_LOGO_COLUMNS,
  groupLogosByBrand,
  resolveBrandLogo,
  type BrandLogoRow,
} from "@/lib/brand-logo";

// The ledger changes when a deal is added, not per request.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "NIL Deal Tracker — every Postgame athlete partnership | Postgame",
  description:
    "Every NIL partnership Postgame has run, by athlete, brand and year. The deal ledger for the #1 NIL agency in college sports.",
  alternates: { canonical: "/deals" },
  openGraph: {
    title: "NIL Deal Tracker | Postgame",
    description:
      "Every NIL partnership Postgame has run, by athlete, brand and year.",
    type: "website",
  },
};

export default async function DealsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data } = await supabase
    .from("deals")
    .select("*, campaign_recaps(name), brands(logo_primary_url, logo_white_url)")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true });

  const deals = (data ?? []) as never[];

  // One bulk read for every brand in the set, resolved here rather than per
  // card. The cards sit on a dark gradient over the art, so these ask on_black.
  const brandIds = Array.from(
    new Set((data ?? []).map((r: { brand_id?: string | null }) => r.brand_id).filter(Boolean))
  ) as string[];

  const logoByBrand: Record<string, string> = {};
  if (brandIds.length) {
    const { data: logoRows } = await supabase
      .from("brand_logos")
      .select(BRAND_LOGO_COLUMNS)
      .in("brand_id", brandIds);
    const byBrand = groupLogosByBrand((logoRows ?? []) as BrandLogoRow[]);
    for (const id of brandIds) {
      const r = resolveBrandLogo(byBrand.get(String(id)), { surface: "dark", prefer: "lockup" });
      if (r) logoByBrand[String(id)] = r.url;
    }
  }

  return <DealsClient initialDeals={deals} logoByBrand={logoByBrand} />;
}
