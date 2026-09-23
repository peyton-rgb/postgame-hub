// ============================================================
// POST /api/deliver/[token]/confirm — Athlete confirms receipt
//
// Public endpoint — no auth. The athlete clicks "I Got It" and this stamps
// confirmed_at. That is the ONLY column it writes: status belongs to staff,
// and the page reads its confirmed state from confirmed_at instead (see
// athleteStage in src/lib/deliver-package.ts).
//
// The write re-matches on the token server-side; no id comes from the
// browser. Confirming twice keeps the first timestamp.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { loadDeliverView, loadPackageState, writeAthleteFields } from '@/lib/deliver-package';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const pkg = await loadPackageState(params.token);
  if (!pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  // Already confirmed or posted: nothing to write, return the current view.
  if (pkg.stage === 'confirmed' || pkg.stage === 'posted') {
    return NextResponse.json(await loadDeliverView(params.token));
  }

  // Only a package staff have sent can be confirmed. The page only shows the
  // button in that state; this stops a draft being confirmed by a direct POST.
  if (pkg.stage !== 'sent') {
    return NextResponse.json(
      { error: 'This package is not ready yet.' },
      { status: 409 }
    );
  }

  const result = await writeAthleteFields(params.token, {
    confirmed_at: new Date().toISOString(),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(await loadDeliverView(params.token));
}
