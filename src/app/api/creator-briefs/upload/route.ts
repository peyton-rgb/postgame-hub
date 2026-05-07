// ============================================================
// POST /api/creator-briefs/upload
//
// PUBLIC endpoint — no auth required.
// Step 1 of the two-step upload flow for freelance videographers.
//
// Why two steps? Vercel serverless functions have a ~4.5MB body
// limit. Video files from a shoot can be hundreds of MB. So
// instead of sending the file THROUGH our server, we:
//   1. (This route) Validate the slug, generate a signed upload
//      URL that lets the browser upload directly to Supabase Storage
//   2. (The /complete route) After the file lands in Storage,
//      create the database record and trigger AI tagging
//
// Body (JSON): {
//   slug: string,        — the creative brief slug (acts as access key)
//   fileName: string,    — original file name
//   mimeType: string,    — e.g. "video/mp4" or "image/jpeg"
//   fileSize: number     — bytes
// }
//
// Returns: {
//   signedUrl: string,   — PUT this URL with the file body
//   storagePath: string, — pass this to /complete after upload
//   brief: { id, brand_id, athlete_name }
// }
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const getAdminSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(request: NextRequest) {
  const adminSupabase = getAdminSupabase();

  const body = await request.json();
  const { slug, fileName, mimeType, fileSize } = body;

  if (!slug || !fileName || !mimeType) {
    return NextResponse.json(
      { error: 'slug, fileName, and mimeType are required' },
      { status: 400 }
    );
  }

  // Reject non-media files
  const isVideo = mimeType.startsWith('video/');
  const isImage = mimeType.startsWith('image/');
  if (!isVideo && !isImage) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}` },
      { status: 400 }
    );
  }

  // --- Validate the slug — this is the security gate ---
  const { data: brief, error: briefError } = await adminSupabase
    .from('creator_briefs')
    .select('id, brand_id, concept_id, brief_id, athlete_name, slug')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (briefError || !brief) {
    return NextResponse.json(
      { error: 'Brief not found or not published' },
      { status: 404 }
    );
  }

  // --- Generate the storage path ---
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const datePath = new Date().toISOString().split('T')[0];
  const storagePath = `freelancer/${slug}/${datePath}/${timestamp}_${sanitizedName}`;

  // --- Create a signed upload URL ---
  // This gives the browser a temporary URL (valid for 2 minutes)
  // that lets it PUT the file directly into Supabase Storage,
  // completely bypassing our Vercel function's size limit.
  const { data: signedData, error: signError } = await adminSupabase.storage
    .from('raw-footage')
    .createSignedUploadUrl(storagePath);

  if (signError || !signedData) {
    return NextResponse.json(
      { error: `Failed to create upload URL: ${signError?.message || 'unknown'}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: signedData.signedUrl,
    token: signedData.token,
    storagePath,
    brief: {
      id: brief.id,
      brand_id: brief.brand_id,
      athlete_name: brief.athlete_name,
    },
  });
}
