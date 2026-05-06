// ============================================================
// GET /api/staff — List Postgame team contacts for dropdowns
//
// Returns all active rows from the postgame_contacts table so
// the creator brief editor can offer a "select contact" dropdown.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Auth check — only logged-in staff can see the team list
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch active contacts from the postgame_contacts table
  const { data, error } = await supabase
    .from('postgame_contacts')
    .select('id, name, phone, email, role')
    .eq('is_active', true)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
