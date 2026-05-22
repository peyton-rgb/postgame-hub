// ============================================================
// GET    /api/assets/[id] — Fetch a single final asset
// PATCH  /api/assets/[id] — Update a final asset
// DELETE /api/assets/[id] — Delete a final asset
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch a single final asset by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('final_assets')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    console.error('Error fetching final asset:', error);
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH: Update a final asset
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields = [
    'title', 'asset_type', 'file_url', 'thumbnail_url',
    'file_size_bytes', 'duration_seconds', 'width', 'height',
    'athlete_name', 'brand_name', 'tags', 'notes', 'status',
    'campaign_id', 'review_session_id', 'concept_id', 'creator_brief_id',
  ];

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  // Validate asset_type if provided
  if (updateData.asset_type) {
    const validTypes = ['video', 'photo', 'graphic'];
    if (!validTypes.includes(updateData.asset_type as string)) {
      return NextResponse.json(
        { error: `asset_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
  }

  // Validate status if provided
  if (updateData.status) {
    const validStatuses = ['ready', 'delivered', 'posted', 'archived'];
    if (!validStatuses.includes(updateData.status as string)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from('final_assets')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating final asset:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: Remove a final asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabase
    .from('final_assets')
    .delete()
    .eq('id', params.id);

  if (error) {
    console.error('Error deleting final asset:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
