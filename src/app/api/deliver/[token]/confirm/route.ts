// ============================================================
// POST /api/deliver/[token]/confirm — Athlete confirms receipt
//
// Public endpoint — no auth. The athlete clicks "I Got It"
// and this marks the package as confirmed with a timestamp.
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

  // Update to confirmed
  const { data, error } = await supabase
    .from('posting_packages')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pkg.id)
    .select()
    .single();

  if (error) {
    console.error('Error confirming package:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
