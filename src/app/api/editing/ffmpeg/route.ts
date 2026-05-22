// ============================================================
// FFmpeg Processing API — POST /api/editing/ffmpeg
//
// Receives a video URL + FFmpeg arguments, processes the video,
// uploads the result to Supabase Storage, and returns the
// output URL.
//
// This runs as a Vercel serverless function. For large videos,
// Vercel has a 50MB request body limit and a 60-second timeout
// on the Hobby plan (300s on Pro). Most quick edits (trim,
// resize, overlay) finish well within that.
//
// Uses @ffmpeg/ffmpeg (WebAssembly) — no binary installation
// needed. It runs FFmpeg entirely in JavaScript/WASM.
//
// NOTE: You need to install the dependency:
//   npm install @ffmpeg/ffmpeg @ffmpeg/util
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

// Admin client for storage uploads
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Parse request
  let body: {
    input_url: string;
    command: string[];
    output_format: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.input_url || !body.command) {
    return NextResponse.json(
      { error: 'input_url and command are required' },
      { status: 400 }
    );
  }

  try {
    // Dynamically import ffmpeg (it's a large WASM module, only load when needed)
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile } = await import('@ffmpeg/util');

    // Initialize FFmpeg WASM
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();

    // Download the source file
    const inputFileName = `input.${getExtension(body.input_url)}`;
    const outputFormat = body.output_format || 'mp4';
    const outputFileName = `output.${outputFormat}`;

    const inputData = await fetchFile(body.input_url);
    await ffmpeg.writeFile(inputFileName, inputData);

    // Run the FFmpeg command
    // The command array contains the filters/options (e.g. ['-vf', 'scale=1080:1920'])
    // We wrap it with input/output file references
    await ffmpeg.exec([
      '-i', inputFileName,
      ...body.command,
      '-y', // overwrite output
      outputFileName,
    ]);

    // Read the output
    const outputData = await ffmpeg.readFile(outputFileName);

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const storagePath = `edited/${user.id}/${timestamp}_${outputFileName}`;

    const { error: uploadError } = await adminSupabase.storage
      .from('media')
      .upload(storagePath, outputData, {
        contentType: `video/${outputFormat}`,
        upsert: true,
      });

    if (uploadError) {
      // Try creating the bucket if it doesn't exist
      if (uploadError.message?.includes('not found')) {
        await adminSupabase.storage.createBucket('media', { public: true });
        await adminSupabase.storage
          .from('media')
          .upload(storagePath, outputData, {
            contentType: `video/${outputFormat}`,
            upsert: true,
          });
      } else {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
    }

    // Get the public URL
    const { data: urlData } = adminSupabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    // Clean up WASM memory
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    return NextResponse.json({
      output_url: urlData.publicUrl,
      storage_path: storagePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ffmpeg-api]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Get file extension from a URL */
function getExtension(url: string): string {
  const path = new URL(url).pathname;
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext && ['mp4', 'mov', 'webm', 'avi', 'mkv', 'jpg', 'jpeg', 'png'].includes(ext)) {
    return ext;
  }
  return 'mp4';
}
