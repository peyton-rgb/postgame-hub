// ============================================================
// POST /api/creator-briefs/[id]/publish
// Sets status to 'published' and stamps published_at. Once
// published, the public page at /creator-brief/[slug] becomes live.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('creator_briefs')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('*, brand:brands(id, name), campaign_brief:campaign_briefs(id, name)')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Creator brief not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
