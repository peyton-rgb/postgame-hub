// ============================================================
// Single Recap API — GET (delete preflight) + DELETE (safe delete)
//
// GET /api/recaps/[id]
//   Preflight for the delete dialog. Returns the recap name, any
//   BLOCKERS (NO ACTION FKs that would make a delete fail), and
//   WARNINGS (cascade side-effects worth confirming).
//
// DELETE /api/recaps/[id]
//   1. Look up the recap; 404 if missing.
//   2. If referenced by case_studies / press_articles / deals
//      (source_campaign_id, all NO ACTION FKs) → 409, do not delete.
//   3. Delete the recap's media objects from the campaign-media bucket.
//   4. Delete the campaign_recaps row (DB cascades handle child rows:
//      media, athletes, slot_assignments, collab_containers, ...).
//
// Uses the service-role client for the privileged work, but first
// verifies a logged-in user (this route is outside the middleware matcher).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

// NO ACTION foreign keys — any referencing row blocks the delete.
const BLOCKER_TABLES = [
  { table: 'case_studies', column: 'source_campaign_id', singular: 'case study', plural: 'case studies' },
  { table: 'press_articles', column: 'source_campaign_id', singular: 'press article', plural: 'press articles' },
  { table: 'deals', column: 'source_campaign_id', singular: 'deal', plural: 'deals' },
] as const;

const STORAGE_BUCKET = 'campaign-media';
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

// Turn a public media URL into a bucket object path, or null if the URL
// isn't a campaign-media object (e.g. an external/Drive link).
function toStoragePath(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  const i = fileUrl.indexOf(PUBLIC_URL_MARKER);
  if (i === -1) return null;
  return decodeURIComponent(fileUrl.slice(i + PUBLIC_URL_MARKER.length));
}

type ServiceClient = ReturnType<typeof createServiceSupabase>;

// Count rows in `table` whose `column` equals this recap id.
async function countRefs(
  supabase: ServiceClient,
  table: string,
  column: string,
  recapId: string
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, recapId);
  return { count: count ?? 0, error: error?.message ?? null };
}

// Shared: gather blockers + warnings for a recap. Returns null on a hard error.
async function gatherReferences(supabase: ServiceClient, recapId: string) {
  const blockers: { table: string; label: string; count: number }[] = [];
  for (const b of BLOCKER_TABLES) {
    const { count, error } = await countRefs(supabase, b.table, b.column, recapId);
    if (error) return { error: `Failed checking ${b.table}: ${error}` };
    if (count > 0) {
      blockers.push({ table: b.table, label: count === 1 ? b.singular : b.plural, count });
    }
  }

  const media = await countRefs(supabase, 'media', 'campaign_id', recapId);
  if (media.error) return { error: `Failed counting media: ${media.error}` };
  const athletes = await countRefs(supabase, 'athletes', 'campaign_id', recapId);
  if (athletes.error) return { error: `Failed counting athletes: ${athletes.error}` };
  const slots = await countRefs(supabase, 'slot_assignments', 'recap_id', recapId);
  if (slots.error) return { error: `Failed counting slot assignments: ${slots.error}` };

  return {
    error: null,
    blockers,
    warnings: {
      mediaCount: media.count,
      athleteCount: athletes.count,
      slotCount: slots.count,
      slotted: slots.count > 0,
    },
  };
}

// --- GET: delete preflight ---
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = createServiceSupabase();

  const { data: recap, error: recapError } = await supabase
    .from('campaign_recaps')
    .select('id, name')
    .eq('id', params.id)
    .maybeSingle();
  if (recapError) {
    return NextResponse.json({ error: recapError.message }, { status: 500 });
  }
  if (!recap) {
    return NextResponse.json({ error: 'Recap not found' }, { status: 404 });
  }

  const refs = await gatherReferences(supabase, params.id);
  if (refs.error) {
    return NextResponse.json({ error: refs.error }, { status: 500 });
  }

  return NextResponse.json({
    recap: { id: recap.id, name: recap.name },
    blockers: refs.blockers,
    warnings: refs.warnings,
  });
}

// --- DELETE: safe delete ---
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = createServiceSupabase();

  // 1. Look up the recap
  const { data: recap, error: recapError } = await supabase
    .from('campaign_recaps')
    .select('id, name')
    .eq('id', params.id)
    .maybeSingle();
  if (recapError) {
    return NextResponse.json({ error: recapError.message }, { status: 500 });
  }
  if (!recap) {
    return NextResponse.json({ error: 'Recap not found' }, { status: 404 });
  }

  // 2. Blockers — re-check server-side even though the UI hides the button.
  const refs = await gatherReferences(supabase, params.id);
  if (refs.error) {
    return NextResponse.json({ error: refs.error }, { status: 500 });
  }
  if (refs.blockers.length > 0) {
    const parts = refs.blockers.map((b) => `${b.count} ${b.label}`);
    const list =
      parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    return NextResponse.json(
      {
        error: `"${recap.name}" can't be deleted — it's referenced by ${list}. Remove those references first.`,
        blockers: refs.blockers,
      },
      { status: 409 }
    );
  }

  // 3. Delete the recap's media objects from storage first.
  const { data: mediaRows, error: mediaError } = await supabase
    .from('media')
    .select('file_url')
    .eq('campaign_id', params.id);
  if (mediaError) {
    return NextResponse.json(
      { error: `Failed listing media files: ${mediaError.message}` },
      { status: 500 }
    );
  }
  const paths = (mediaRows ?? [])
    .map((m) => toStoragePath(m.file_url))
    .filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    if (storageError) {
      return NextResponse.json(
        { error: `Failed deleting media files from storage: ${storageError.message}` },
        { status: 500 }
      );
    }
  }

  // 4. Delete the recap row — DB cascades remove media/athletes/slots/etc.
  const { error: deleteError } = await supabase
    .from('campaign_recaps')
    .delete()
    .eq('id', params.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, filesRemoved: paths.length });
}
