// ============================================================
// GET /api/posting-campaigns/[id] — One posting campaign (staff only)
//
// The campaign's shared settings plus its brand name and the Postgame and
// brand logos (the same lookup as the athlete page), for the roster header.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getHubStaff } from '@/lib/staff-auth';
import { loadBrandLockup } from '@/lib/deliver-package';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await getHubStaff();
  if (!staff.ok) {
    return NextResponse.json(
      { error: staff.reason === 'anon' ? 'Not authenticated' : 'Staff only' },
      { status: staff.reason === 'anon' ? 401 : 403 }
    );
  }
  const supabase = createServerSupabase();

  const { data: c, error } = await supabase
    .from('posting_campaigns')
    .select('id, brand_id, title, season_label, tag_handle, hashtag, ftc_note, invoice_email, deliverables')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const lockup = await loadBrandLockup(c.brand_id);
  return NextResponse.json({
    id: c.id,
    title: c.title,
    seasonLabel: c.season_label,
    tagHandle: c.tag_handle,
    hashtag: c.hashtag,
    ftcNote: c.ftc_note,
    invoiceEmail: c.invoice_email,
    deliverables: c.deliverables ?? [],
    brandName: lockup.brandName,
    logos: { postgame: lockup.postgame, brand: lockup.brand },
  });
}
