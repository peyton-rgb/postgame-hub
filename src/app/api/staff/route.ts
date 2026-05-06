// ============================================================
// GET /api/staff — List Postgame team members for dropdowns
//
// Returns all @pstgm.com users from auth.users so the creator
// brief editor can offer a "select Postgame contact" dropdown.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Admin client needed to read auth.users
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // Auth check — only logged-in staff can see the team list
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch all users (Supabase admin API)
  const { data, error } = await adminSupabase.auth.admin.listUsers();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter to @pstgm.com emails and map to a clean shape
  const staff = (data.users || [])
    .filter((u) => u.email?.endsWith('@pstgm.com'))
    .map((u) => ({
      id: u.id,
      email: u.email || '',
      // Derive a display name from the email prefix, capitalized
      name: u.user_metadata?.full_name ||
        (u.email?.split('@')[0] || '').charAt(0).toUpperCase() +
        (u.email?.split('@')[0] || '').slice(1),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(staff);
}
