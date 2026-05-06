// ============================================================
// POST /api/intake/thumbnail — Upload a video thumbnail
//
// When a user uploads a video, the browser extracts a frame
// from the video using <canvas> and sends it here as a base64
// image. This route stores it in Supabase Storage and updates
// the inspo_items row's thumbnail_url.
//
// Body: { inspo_item_id: "uuid", thumbnail_base64: "data:image/jpeg;base64,..." }
// ============================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { inspo_item_id, thumbnail_base64 } = body;

  if (!inspo_item_id || !thumbnail_base64) {
    return NextResponse.json(
      { error: 'inspo_item_id and thumbnail_base64 are required' },
      { status: 400 }
    );
  }

  // Strip the data URL prefix to get raw base64
  const base64Data = thumbnail_base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Upload thumbnail to storage
  const timestamp = Date.now();
  const storagePath = `thumbnails/${inspo_item_id}_${timestamp}.jpg`;

  const { error: uploadError } = await adminSupabase.storage
    .from('raw-footage')
    .upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Thumbnail upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Get the public URL
  const { data: publicUrlData } = adminSupabase.storage
    .from('raw-footage')
    .getPublicUrl(storagePath);

  // Update the inspo_items row with the thumbnail URL
  const { error: updateError } = await adminSupabase
    .from('inspo_items')
    .update({ thumbnail_url: publicUrlData.publicUrl })
    .eq('id', inspo_item_id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update thumbnail: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    thumbnail_url: publicUrlData.publicUrl,
  });
}
