// ============================================================
// /admin/mobile-app/cards/[id] — Edit an existing mobile app card
// Matches prototype screen S["card-edit"].
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadCard, loadEditorOptions, toDraft } from "@/lib/admin/mobile-app/cards";
import { saveCard, setCardStatus } from "@/app/admin/mobile-app/cards/actions";
import { PageHeader, PendingMigration } from "@/components/admin/ui";
import CardEditor from "@/components/admin/mobile-app/CardEditor";

export const dynamic = "force-dynamic";

interface EditCardPageProps {
  params: {
    id: string;
  };
  searchParams: {
    result?: string;
  };
}

export default async function EditMobileAppCardPage({ params, searchParams }: EditCardPageProps) {
  await requireAdmin("staff");

  const supabase = createServiceSupabase();
  const [cardRes, options] = await Promise.all([
    loadCard(supabase, params.id),
    loadEditorOptions(supabase),
  ]);

  if (cardRes.pending && !cardRes.card) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Mobile App Card"
          subtitle="Card editor is waiting on migration 086"
          actions={
            <Link
              href="/admin/mobile-app/cards"
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
            >
              ← Back to Cards
            </Link>
          }
        />
        <PendingMigration migration="086_mobile_app_cards" feature="Mobile app cards" />
      </div>
    );
  }

  if (!cardRes.card) {
    notFound();
  }

  const initial = toDraft(cardRes.card, cardRes.whitelist);

  return (
    <CardEditor
      id={cardRes.card.id}
      initial={initial}
      savedStatus={cardRes.card.status}
      updatedAt={cardRes.card.updated_at}
      options={options}
      action={saveCard}
      statusAction={setCardStatus}
      result={searchParams.result}
    />
  );
}
