// ============================================================
// GET /api/campaign-briefs  — List all campaign briefs (with optional filters)
// POST /api/campaign-briefs — Create a new brief (starts as draft)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import type { CreateBriefInput } from '@/lib/types/briefs';

// GET: Fetch a list of campaign briefs
// Supports query params: ?brand_id=xxx&status=draft&created_by=xxx
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();

  // Check that the user is logged in
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Read optional filters from the URL
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get('brand_id');
  const status = searchParams.get('status');
  const createdBy = searchParams.get('created_by');

  // Build the query — start with selecting everything, join the brand name
  let query = supabase
    .from('campaign_briefs')
    .select('*, brand:brands(id, name)')
    .order('created_at', { ascending: false });

  // Apply filters if they were provided
  if (brandId) query = query.eq('brand_id', brandId);
  if (status) query = query.eq('status', status);
  if (createdBy) query = query.eq('created_by', createdBy);

  // Only show the latest version of each brief (not old versions)
  query = query.is('parent_brief_id', null);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching campaign briefs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Create a new brief
// The brief starts in "draft" status — it won't trigger any side effects
// until the user explicitly publishes it via /api/campaign-briefs/[id]/publish
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body: CreateBriefInput = await request.json();

  if (!body.brand_id || !body.name) {
    return NextResponse.json(
      { error: 'brand_id and name are required' },
      { status: 400 }
    );
  }

  // Verify the brand exists
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('id', body.brand_id)
    .single();

  if (brandError || !brand) {
    return NextResponse.json(
      { error: 'Brand not found' },
      { status: 404 }
    );
  }

  // Insert the new brief
  const { data, error } = await supabase
    .from('campaign_briefs')
    .insert({
      brand_id: body.brand_id,
      name: body.name,
      campaign_type: body.campaign_type || 'standard',
      start_date: body.start_date || null,
      target_launch_date: body.target_launch_date || null,
      budget: body.budget || null,
      production_config: body.production_config || 'vid_is_editor',
      brief_content: body.brief_content || null,
      mandatories: body.mandatories || [],
      restrictions: body.restrictions || [],
      athlete_targeting: body.athlete_targeting || {},
      status: 'draft',
      version: 1,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating campaign brief:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
