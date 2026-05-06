// ============================================================
// POST /api/intake/upload — Upload raw footage or photos
//
// Accepts multipart form data with file(s). For each file:
//   1. Uploads to the "raw-footage" Supabase Storage bucket
//   2. Creates an inspo_items row with tagging_status = "pending"
//   3. Returns the created inspo_items records
//
// Optional form fields:
//   - brand_id: link to a brand
//   - campaign_id: link to a campaign
//   - content_type: override (defaults to auto-detect from mime)
//   - athlete_name: name of the athlete in the content
//   - sport: sport category
// ============================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Auth check using the same pattern as other routes
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Use admin client for storage operations (service role has full access)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Parse the multipart form data
  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  const brandId = formData.get('brand_id') as string | null;
  const campaignId = formData.get('campaign_id') as string | null;
  const contentTypeOverride = formData.get('content_type') as string | null;
  const athleteName = formData.get('athlete_name') as string | null;
  const sport = formData.get('sport') as string | null;

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const results = [];
  const errors = [];

  for (const file of files) {
    try {
      // --- Determine content type from the file's mime type ---
      const mimeType = file.type;
      const isVideo = mimeType.startsWith('video/');
      const isImage = mimeType.startsWith('image/');

      if (!isVideo && !isImage) {
        errors.push({ file: file.name, error: `Unsupported file type: ${mimeType}` });
        continue;
      }

      // Auto-detect the inspo_items content_type from the file
      let contentType = contentTypeOverride || 'raw_footage';
      if (!contentTypeOverride) {
        if (isImage) contentType = 'photography';
        if (isVideo) contentType = 'raw_footage';
      }

      // --- Upload to Supabase Storage ---
      // Path: {date}/{timestamp}_{sanitized_filename}
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const datePath = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const storagePath = `${datePath}/${timestamp}_${sanitizedName}`;

      // Read the file into a buffer
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await adminSupabase.storage
        .from('raw-footage')
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        errors.push({ file: file.name, error: `Upload failed: ${uploadError.message}` });
        continue;
      }

      // Build the public URL for the uploaded file
      const { data: publicUrlData } = adminSupabase.storage
        .from('raw-footage')
        .getPublicUrl(storagePath);

      const fileUrl = publicUrlData.publicUrl;

      // --- For images, the file itself is the thumbnail ---
      // For videos, we'll set thumbnail_url to null for now.
      // The UI will extract a thumbnail client-side and upload it separately.
      const thumbnailUrl = isImage ? fileUrl : null;

      // --- Create inspo_items row ---
      const { data: inspoItem, error: insertError } = await adminSupabase
        .from('inspo_items')
        .insert({
          content_type: contentType,
          source: 'produced_catalog',
          file_url: fileUrl,
          thumbnail_url: thumbnailUrl,
          mime_type: mimeType,
          file_size_bytes: file.size,
          format: file.name.split('.').pop()?.toLowerCase() || null,
          brand_id: brandId || null,
          campaign_id: campaignId || null,
          athlete_name: athleteName || null,
          sport: sport || null,
          tagging_status: 'pending',
          // Initialize empty tag objects so they're never null
          pro_tags: {},
          social_tags: {},
          context_tags: {},
          search_phrases: [],
          brief_fit: [],
        })
        .select()
        .single();

      if (insertError) {
        errors.push({ file: file.name, error: `Database insert failed: ${insertError.message}` });
        continue;
      }

      results.push({
        file: file.name,
        inspo_item: inspoItem,
      });
    } catch (err) {
      errors.push({
        file: file.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    uploaded: results,
    errors,
    total: files.length,
    successful: results.length,
    failed: errors.length,
  }, { status: results.length > 0 ? 201 : 500 });
}
