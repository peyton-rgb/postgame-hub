// ============================================================
// POST /api/composer — Create a Composed Post
//
// Station 2 (Post Composer) API endpoint. Accepts asset IDs,
// channel, template type, caption, hashtags, mentions, and
// scheduling info. Creates a content_queue row with status
// 'draft'. Used by the /dashboard/composer page.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.channel) {
    return NextResponse.json(
      { error: 'channel is required' },
      { status: 400 }
    );
  }

  // Build the content_queue record
  const record = {
    // Assets
    inspo_item_ids: body.inspo_item_ids || [],
    asset_url: body.asset_url || null,
    asset_urls: body.asset_urls || [],
    thumbnail_url: body.thumbnail_url || null,

    // Channel & template
    channel: body.channel,
    template_type: body.template_type || null,

    // Caption & copy
    caption: body.caption || null,
    hashtags: body.hashtags || [],

    // Metadata
    athlete_name: body.athlete_name || null,
    campaign_id: body.campaign_id || null,
    notes: body.notes || null,

    // Mentions stored in notes if present
    ...(body.mentions ? { notes: [body.notes, `Mentions: ${body.mentions}`].filter(Boolean).join('\n') } : {}),

    // FTC disclosure appended to caption if flagged
    ...(body.ftc_disclosure && body.caption ? {
      caption: body.caption + '\n\n#ad #sponsored',
    } : {}),

    // Scheduling
    scheduled_for: body.scheduled_for || null,

    // Status
    status: body.status || 'draft',

    // Track who created it
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('content_queue')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('Failed to create composed post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
