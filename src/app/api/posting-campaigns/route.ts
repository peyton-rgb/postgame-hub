// ============================================================
// GET /api/posting-campaigns — List posting campaigns (staff only)
//
// One row per posting campaign (migration 072), with the brand's name and
// logo and live post counts, for the /dashboard/posting-instructions index.
// RLS on posting_campaigns / posting_packages is staff-only; the explicit
// check here turns a non-staff caller into a clean 401 / 403.
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getHubStaff } from '@/lib/staff-auth';
import { loadBrandLockup } from '@/lib/deliver-package';
import { isPosted, isSent } from '@/lib/posting-packages';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await getHubStaff();
  if (!staff.ok) {
    return NextResponse.json(
      { error: staff.reason === 'anon' ? 'Not authenticated' : 'Staff only' },
      { status: staff.reason === 'anon' ? 401 : 403 }
    );
  }
  const supabase = createServerSupabase();

  const [{ data: campaigns, error }, { data: packages, error: pkgError }] = await Promise.all([
    supabase
      .from('posting_campaigns')
      .select('id, brand_id, title, season_label, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('posting_packages').select('posting_campaign_id, athlete_name, status, sent_at, posted_at'),
  ]);
  if (error || pkgError) {
    return NextResponse.json({ error: (error ?? pkgError)!.message }, { status: 500 });
  }

  const out = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const mine = (packages ?? []).filter((p) => p.posting_campaign_id === c.id);
      const lockup = await loadBrandLockup(c.brand_id);
      return {
        id: c.id,
        title: c.title,
        seasonLabel: c.season_label,
        brandName: lockup.brandName,
        brandLogo: lockup.brand,
        counts: {
          athletes: new Set(mine.map((p) => p.athlete_name.trim().toLowerCase())).size,
          posts: mine.length,
          linksSent: mine.filter((p) => isSent(p)).length,
          posted: mine.filter((p) => isPosted(p)).length,
        },
      };
    })
  );

  return NextResponse.json({ campaigns: out });
}
