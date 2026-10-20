// ============================================================
// /admin/mobile-app/cards/new — Create a new mobile app card
// Matches prototype screen S["card-edit"].
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { emptyDraft, loadEditorOptions } from "@/lib/admin/mobile-app/cards";
import { saveCard, setCardStatus } from "@/app/admin/mobile-app/cards/actions";
import CardEditor from "@/components/admin/mobile-app/CardEditor";

export const dynamic = "force-dynamic";

interface NewCardPageProps {
  searchParams: {
    result?: string;
  };
}

export default async function NewMobileAppCardPage({ searchParams }: NewCardPageProps) {
  await requireAdmin("staff");

  const supabase = createServiceSupabase();
  const options = await loadEditorOptions(supabase);
  const initial = emptyDraft("optin");

  return (
    <CardEditor
      id={null}
      initial={initial}
      savedStatus={null}
      updatedAt={null}
      options={options}
      action={saveCard}
      statusAction={setCardStatus}
      result={searchParams.result}
    />
  );
}
