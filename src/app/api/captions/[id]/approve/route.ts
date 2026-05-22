// ============================================================
// POST /api/captions/[id]/approve
//
// Approves a content queue item — sets status to 'approved',
// records who approved it and when. Only draft items can be
// approved through this endpoint.
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

  // Fetch the item first to validate state
  const { data: item, error: fetchError } = await supabase
    .from('content_queue')
    .select('id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  if (item.status === 'approved') {
    return NextResponse.json({ error: 'Item is already approved' }, { status: 400 });
  }

  if (item.status === 'published') {
    return NextResponse.json({ error: 'Item is already published' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('content_queue')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
