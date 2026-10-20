// ============================================================
// /admin/mobile-app/feed — Mobile App · Feed
// Matches prototype screen S["app-feed"] & feedScreen().
// Shows the live athlete home feed in an authentic iPhone frame,
// with audience cohort simulation ("Preview as") and card manifest.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import {
  listCards,
  loadBrandsFor,
  loadEditorOptions,
  loadWhitelist,
  type Whitelist,
} from "@/lib/admin/mobile-app/cards";
import type { BrandLite } from "@/lib/admin/campaigns/types";
import { getPostgameLogos } from "@/lib/signup/postgameLogo";
import { PendingMigration } from "@/components/admin/ui";
import FeedPreviewClient from "@/components/admin/mobile-app/FeedPreviewClient";

export const dynamic = "force-dynamic";

export default async function MobileAppFeedPage() {
  await requireAdmin("staff");

  const supabase = createServiceSupabase();
  const [cardsRes, options, postgameLogos] = await Promise.all([
    listCards(supabase),
    loadEditorOptions(supabase),
    getPostgameLogos(),
  ]);

  const ids = cardsRes.rows.map((c) => c.id);
  const [whitelistMap, brandsMap] = await Promise.all([
    ids.length > 0 ? loadWhitelist(supabase, ids) : Promise.resolve(new Map<string, Whitelist>()),
    loadBrandsFor(supabase, cardsRes.rows),
  ]);

  const whitelists: Record<string, Whitelist> = {};
  for (const [id, w] of Array.from(whitelistMap.entries())) {
    whitelists[id] = w;
  }

  const brands: Record<string, BrandLite> = {};
  for (const [id, b] of Array.from(brandsMap.entries())) {
    brands[id] = b;
  }

  return (
    <div className="space-y-4">
      {cardsRes.pending && (
        <PendingMigration migration="086_mobile_app_cards" feature="Mobile app cards" />
      )}

      <FeedPreviewClient
        cards={cardsRes.rows}
        whitelists={whitelists}
        brands={brands}
        audiences={options.audiences}
        postgameLogoUrl={postgameLogos.onDark}
      />
    </div>
  );
}
