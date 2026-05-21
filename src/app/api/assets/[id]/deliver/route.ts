// ============================================================
// POST /api/assets/[id]/deliver — Create a delivery package
//
// Takes a final asset and creates a posting_package for it.
// Auto-generates a unique delivery_token so the athlete can
// view their package at /deliver/[token] without logging in.
// Updates the final_asset status to 'delivered'.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch the final asset
  const { data: asset, error: assetError } = await supabase
    .from('final_assets')
    .select('*')
    .eq('id', params.id)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (asset.status !== 'ready') {
    return NextResponse.json(
      { error: `Cannot deliver an asset with status '${asset.status}'. Only 'ready' assets can be delivered.` },
      { status: 400 }
    );
  }

  // Parse optional overrides from the request body
  const body = await request.json().catch(() => ({}));

  // Generate a unique delivery token
  const deliveryToken = crypto.randomBytes(24).toString('hex');

  // Create the posting package
  const packageData = {
    campaign_id: asset.campaign_id,
    athlete_name: asset.athlete_name || body.athlete_name || 'Athlete',
    delivery_token: deliveryToken,
    video_url: asset.file_url,
    caption_short: body.caption_short || null,
    caption_medium: body.caption_medium || null,
    caption_long: body.caption_long || null,
    hashtags: body.hashtags || [],
    mentions: body.mentions || [],
    platform_notes: body.platform_notes || null,
    ftc_note: body.ftc_note || null,
    posting_window_start: body.posting_window_start || null,
    posting_window_end: body.posting_window_end || null,
    intended_post_date: body.intended_post_date || null,
    am_notes: body.am_notes || null,
    brief_id: asset.creator_brief_id || null,
    inspo_item_id: body.inspo_item_id || null,
    status: 'sent',
    sent_at: new Date().toISOString(),
  };

  const { data: pkg, error: pkgError } = await supabase
    .from('posting_packages')
    .insert(packageData)
    .select()
    .single();

  if (pkgError) {
    console.error('Error creating posting package:', pkgError);
    return NextResponse.json({ error: pkgError.message }, { status: 500 });
  }

  // Update the final asset to 'delivered'
  const { error: updateError } = await supabase
    .from('final_assets')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivered_to: asset.athlete_name || body.athlete_name || 'Athlete',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (updateError) {
    console.error('Error updating asset status:', updateError);
    // Package was still created, so return it with a warning
  }

  // Build the delivery URL
  const deliveryUrl = `/deliver/${deliveryToken}`;

  return NextResponse.json({
    package: pkg,
    delivery_url: deliveryUrl,
    delivery_token: deliveryToken,
  }, { status: 201 });
}
