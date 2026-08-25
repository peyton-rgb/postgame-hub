// ============================================================
// Review sessions — find-or-create for deliverable-backed reviews
//
// Lives here rather than in src/app/api/reviews/route.ts because Next.js
// permits only its own handler exports from a route module; exporting a helper
// from there fails the generated route type check. Both the POST handler and
// the staff queue's server action import this, so there is exactly one
// find-or-create implementation.
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server';
import { slotLabel } from '@/lib/deliverable-status';
import crypto from 'crypto';

// A session belongs to a VERSION, not to a deliverable. Open v1 and you get
// the v1 session; a later v2 gets its own session with revision_round
// incremented, and the v1 session stays as the record of what was said about
// v1.
//
// asset_url is a SNAPSHOT, not a pointer: the version's file_url is copied
// onto the session at creation, so the session keeps showing what was actually
// reviewed after the deliverable's file_url has moved on. Same reasoning that
// makes Phase 5 copy finals rather than move them.

export type FindOrCreateResult =
  | { ok: true; review: any; created: boolean }
  | { ok: false; status: number; error: string };

export async function findOrCreateDeliverableSession(
  deliverableId: string,
  deliverableVersionId?: string | null
): Promise<FindOrCreateResult> {
  const service = createServiceSupabase();

  // Resolve the version under review: the one named, or the current (latest).
  let version: any = null;
  if (deliverableVersionId) {
    const { data } = await service
      .from('deliverable_versions')
      .select('id,deliverable_id,version_number,file_url,media_type')
      .eq('id', deliverableVersionId)
      // Scoped to the deliverable, so a version id from another row cannot be
      // attached to this one.
      .eq('deliverable_id', deliverableId)
      .maybeSingle();
    version = data;
  } else {
    const { data } = await service
      .from('deliverable_versions')
      .select('id,deliverable_id,version_number,file_url,media_type')
      .eq('deliverable_id', deliverableId)
      .order('version_number', { ascending: false })
      .limit(1);
    version = data?.[0] ?? null;
  }

  if (!version) {
    return {
      ok: false,
      status: 400,
      error: 'This deliverable has no uploaded version to review yet.',
    };
  }

  // Find-or-create is keyed on the VERSION. Keying on the deliverable would
  // collapse every round into one session, which is the opposite of the design.
  // Not .maybeSingle(): if a race ever produced two, erroring would be worse
  // than taking the first.
  const { data: existingRows } = await service
    .from('review_sessions')
    .select('*')
    .eq('deliverable_version_id', version.id)
    .order('created_at', { ascending: true })
    .limit(1);
  if (existingRows?.length) {
    // Tokens are reused, never regenerated — a brand link that broke because
    // someone reopened the asset would be a bad bug.
    return { ok: true, review: existingRows[0], created: false };
  }

  const { data: deliverable } = await service
    .from('athlete_deliverables')
    .select('id,slot,slot_index,athlete_id')
    .eq('id', deliverableId)
    .maybeSingle();
  if (!deliverable) {
    return { ok: false, status: 404, error: 'Deliverable not found' };
  }

  let athleteName: string | null = null;
  if (deliverable.athlete_id) {
    const { data: profile } = await service
      .from('profiles')
      .select('full_name,email')
      .eq('id', deliverable.athlete_id)
      .maybeSingle();
    athleteName = profile?.full_name || profile?.email || null;
  }

  // revision_round counts the rounds this deliverable has already been
  // through, so the first session is round 1.
  const { count } = await service
    .from('review_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('deliverable_id', deliverableId);

  const label = slotLabel(deliverable.slot);
  const assetName =
    (deliverable.slot_index ?? 1) > 1 ? `${label} ${deliverable.slot_index}` : label;

  const { data: review, error: insertError } = await service
    .from('review_sessions')
    .insert({
      deliverable_id: deliverableId,
      deliverable_version_id: version.id,
      // Snapshot, not a pointer.
      asset_url: version.file_url,
      // Snapshotted for the same reason: the session records what was
      // reviewed. Null means video, which is what inspo sessions leave it as.
      media_type: version.media_type,
      // Deliverable sessions carry asset_url; video_url stays null and is the
      // inspo flow's field.
      video_url: null,
      asset_name: assetName,
      athlete_name: athleteName,
      version_number: version.version_number,
      revision_round: (count ?? 0) + 1,
      // campaign_id is deliberately null: it is an FK to brand_campaigns while
      // deliverables belong to optin_campaigns, so there is no correct value.
      // The campaign is reachable through deliverable_id.
      campaign_id: null,
      brand_token: crypto.randomUUID(),
      agency_token: crypto.randomUUID(),
      editor_token: crypto.randomUUID(),
      status: 'pending_internal',
    })
    .select()
    .single();

  if (insertError || !review) {
    return {
      ok: false,
      status: 500,
      error: `Failed to create review session: ${insertError?.message}`,
    };
  }

  return { ok: true, review, created: true };
}
