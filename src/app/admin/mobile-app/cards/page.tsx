// ============================================================
// /admin/mobile-app/cards — Mobile App · Cards
// Matches prototype screen S["app-cards"].
// Lists cards in display order, supports drag reordering,
// status indication, layout, aspect, visibility, and delete.
// Handles pending migration 086 gracefully.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { listCards, loadWhitelist, type Whitelist } from "@/lib/admin/mobile-app/cards";
import { PageHeader, PendingMigration } from "@/components/admin/ui";
import CardsTable from "@/components/admin/mobile-app/CardsTable";

export const dynamic = "force-dynamic";

interface CardsPageProps {
  searchParams: {
    result?: string;
  };
}

export default async function MobileAppCardsPage({ searchParams }: CardsPageProps) {
  await requireAdmin("staff");

  const supabase = createServiceSupabase();
  const cardsRes = await listCards(supabase);

  const ids = cardsRes.rows.map((c) => c.id);
  const whitelistMap = ids.length > 0 ? await loadWhitelist(supabase, ids) : new Map<string, Whitelist>();
  const whitelists: Record<string, Whitelist> = {};
  for (const [id, w] of Array.from(whitelistMap.entries())) {
    whitelists[id] = w;
  }

  const result = searchParams.result;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mobile App · Cards"
        subtitle="Drag the handle to set the order cards appear in the app"
        actions={
          <>
            <Link
              href="/admin/mobile-app/feed"
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
                <path d="M11 18.5h2" />
              </svg>
              Preview feed
            </Link>
            <Link
              href="/admin/mobile-app/cards/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Card
            </Link>
          </>
        }
      />

      {/* Migration 086 notice if the table is not applied in production yet */}
      {cardsRes.pending && (
        <PendingMigration migration="086_mobile_app_cards" feature="Mobile app cards" />
      )}

      {/* Action feedback banners */}
      {result === "pending086" && (
        <div className="rounded-lg border border-status-warn bg-amber-50 px-4 py-3 text-[13px] text-status-warn">
          <span className="font-semibold">Waiting on migration 086:</span> The{" "}
          <code className="rounded bg-amber-100 px-1 font-mono text-[12px]">mobile_app_cards</code> table
          is not live in the database yet. Your changes were not saved.
        </div>
      )}
      {result === "deleted" && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] text-stone-700">
          Card deleted.
        </div>
      )}
      {result === "notfound" && (
        <div className="rounded-lg border border-status-bad bg-red-50 px-4 py-3 text-[13px] text-status-bad">
          Card not found.
        </div>
      )}
      {result === "went-live" && (
        <div className="rounded-lg border border-status-ok bg-emerald-50 px-4 py-3 text-[13px] text-status-ok">
          Card is now live.
        </div>
      )}
      {result === "went-off" && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] text-stone-700">
          Card switched off (draft).
        </div>
      )}

      {/* Cards list table */}
      <CardsTable initialCards={cardsRes.rows} whitelists={whitelists} />
    </div>
  );
}
