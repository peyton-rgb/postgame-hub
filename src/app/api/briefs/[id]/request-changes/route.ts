// ============================================================
// POST /api/briefs/[id]/request-changes
// Creates a new draft version of a published brief.
// The original stays locked and untouched — the new version
// copies all its data but starts as a fresh draft you can edit.
// Think of it like "Save As" — the original is preserved.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch the original brief
  const { data: original, error: fetchError } = await supabase
    .from('campaign_briefs')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  }

  if (original.status === 'draft') {
    return NextResponse.json(
      { error: 'This brief is already a draft — you can edit it directly.' },
      { status: 400 }
    );
  }

  // Create a new version by copying the original's data
  // but resetting status to draft and incrementing the version number.
  // parent_brief_id links back to the original so we can trace the history.
  const { data: newVersion, error: insertError } = await supabase
    .from('campaign_briefs')
    .insert({
      brand_id: original.brand_id,
      campaign_id: original.campaign_id,
      name: original.name,
      campaign_type: original.campaign_type,
      start_date: original.start_date,
      target_launch_date: original.target_launch_date,
      budget: original.budget,
      production_config: original.production_config,
      brief_content: original.brief_content,
      mandatories: original.mandatories,
      restrictions: original.restrictions,
      athlete_targeting: original.athlete_targeting,
      drive_folder_id: original.drive_folder_id,
      status: 'draft',
      version: original.version + 1,
      parent_brief_id: original.id,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating new brief version:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(newVersion, { status: 201 });
}
