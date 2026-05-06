// ============================================================
// GET /api/concepts — List concepts filtered by brief
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const briefId = searchParams.get('brief_id');

  if (!briefId) {
    return NextResponse.json(
      { error: 'brief_id query param is required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('concepts')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
