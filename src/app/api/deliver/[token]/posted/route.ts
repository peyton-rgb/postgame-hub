// ============================================================
// POST /api/deliver/[token]/posted — Athlete reports they posted
//
// Public endpoint — no auth. The athlete submits the live URL
// of their post. This marks the package as 'posted' and stores
// the link so the Postgame team can track it.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServerSupabase();

  // Check that the package exists
  const { data: pkg, error: fetchError } = await supabase
    .from('posting_packages')
    .select('id, status')
    .eq('delivery_token', params.token)
    .single();

  if (fetchError || !pkg) {
    return NextResponse.json(
      { error: 'Package not found' },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));

  // Update to posted
  const { data, error } = await supabase
    .from('posting_packages')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      live_url: body.live_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pkg.id)
    .select()
    .single();

  if (error) {
    console.error('Error marking package as posted:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
