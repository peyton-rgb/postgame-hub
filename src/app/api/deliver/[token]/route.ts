// ============================================================
// GET /api/deliver/[token] — Public delivery package lookup
//
// No auth required. Athletes receive a link with their unique
// token and can view their posting package without logging in.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('posting_packages')
    .select('*')
    .eq('delivery_token', params.token)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Package not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
