// ============================================================
// GET /api/publishing  — List scheduled/published queue items
// POST /api/publishing — Schedule a content queue item for posting
//
// The publishing endpoint works on top of the content_queue
// table. It filters for items that have moved past draft and
// manages the scheduling workflow.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Only items past draft stage
  let query = supabase
    .from('content_queue')
    .select('*', { count: 'exact' })
    .in('status', ['approved', 'scheduled', 'published', 'failed'])
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (channel) {
    query = query.eq('channel', channel);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data, total: count });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.content_queue_id) {
    return NextResponse.json(
      { error: 'content_queue_id is required' },
      { status: 400 }
    );
  }

  if (!body.scheduled_for) {
    return NextResponse.json(
      { error: 'scheduled_for is required' },
      { status: 400 }
    );
  }

  // Verify the item exists and is in an appropriate state
  const { data: item, error: fetchError } = await supabase
    .from('content_queue')
    .select('id, status')
    .eq('id', body.content_queue_id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  }

  if (!['approved', 'scheduled'].includes(item.status)) {
    return NextResponse.json(
      { error: `Cannot schedule an item with status '${item.status}'. Must be approved first.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('content_queue')
    .update({
      scheduled_for: body.scheduled_for,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.content_queue_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
