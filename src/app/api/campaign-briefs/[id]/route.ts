// ============================================================
// GET /api/campaign-briefs/[id]    — Fetch a single brief
// PATCH /api/campaign-briefs/[id]  — Update a brief (draft only)
// DELETE /api/campaign-briefs/[id] — Soft-delete (set status to cancelled)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import type { UpdateBriefInput } from '@/lib/types/briefs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('campaign_briefs')
    .select('*, brand:brands(id, name)')
    .eq('id', params.id)
    .single();

  if (error) {
    console.error('Error fetching campaign brief:', error);
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH: Update a brief
// Only drafts can be edited — published briefs are locked.
// To change a published brief, use the "request changes" flow
// which creates a new version.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('campaign_briefs')
    .select('id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft briefs can be edited. Use "Request Changes" to create a new version of a published brief.' },
      { status: 403 }
    );
  }

  const body: UpdateBriefInput = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.campaign_type !== undefined) updates.campaign_type = body.campaign_type;
  if (body.start_date !== undefined) updates.start_date = body.start_date;
  if (body.target_launch_date !== undefined) updates.target_launch_date = body.target_launch_date;
  if (body.budget !== undefined) updates.budget = body.budget;
  if (body.production_config !== undefined) updates.production_config = body.production_config;
  if (body.brief_content !== undefined) updates.brief_content = body.brief_content;
  if (body.mandatories !== undefined) updates.mandatories = body.mandatories;
  if (body.restrictions !== undefined) updates.restrictions = body.restrictions;
  if (body.athlete_targeting !== undefined) updates.athlete_targeting = body.athlete_targeting;

  const { data, error } = await supabase
    .from('campaign_briefs')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating campaign brief:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: Soft-delete a brief
// We don't actually remove the row — we just set status to "cancelled".
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('campaign_briefs')
    .update({ status: 'cancelled' })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error cancelling campaign brief:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
