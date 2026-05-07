// ============================================================
// /api/assets/[id]/deliver
// POST — Mark an asset as delivered (sets delivered_at, delivered_to, status)
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.delivered_to) {
    return NextResponse.json(
      { error: 'delivered_to is required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('final_assets')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivered_to: body.delivered_to,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
