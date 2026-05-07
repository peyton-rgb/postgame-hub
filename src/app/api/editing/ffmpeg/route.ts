// ============================================================
// POST /api/editing/ffmpeg
//
// Body: { input_url: string, command: string[], output_format: string }
// Auth: a logged-in Postgame session OR an internal token from the
//       agent layer (orchestrator runs server-side and may not carry
//       a user cookie).
//
// Behavior:
//   1. Pull the input file bytes from input_url.
//   2. Boot @ffmpeg/ffmpeg WASM, write input as 'input.<ext>',
//      run ffmpeg.exec(command), read the resulting 'output.<format>'.
//   3. Upload the output to the 'media' bucket under
//      edited/{userId}/{ts}_output.<format>.
//   4. Return { output_url, storage_path }.
//
// Note: @ffmpeg/ffmpeg 0.12.x is browser-first. It may need
// SharedArrayBuffer + cross-origin headers in production. If the
// runtime can't load WASM here, swap this route to use
// fluent-ffmpeg + @ffmpeg-installer (already in the lockfile).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

function extFromUrl(url: string, fallback = 'mp4'): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
    return (m && m[1].toLowerCase()) || fallback;
  } catch {
    return fallback;
  }
}

async function authorize(request: NextRequest): Promise<{ ok: true; userId: string } | NextResponse> {
  // Internal calls from the orchestrator running server-side use a
  // shared secret; user-driven calls use the cookie session.
  const internalToken = process.env.EDITING_INTERNAL_TOKEN;
  if (internalToken && request.headers.get('x-postgame-internal') === internalToken) {
    return { ok: true, userId: 'internal' };
  }

  const auth = await createServerSupabase();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return { ok: true, userId: user.id };
}

interface FfmpegBody {
  input_url?: string;
  command?: string[];
  output_format?: string;
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if ('ok' in auth === false) return auth as NextResponse;
  const { userId } = auth as { ok: true; userId: string };

  let body: FfmpegBody;
  try {
    body = (await request.json()) as FfmpegBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { input_url, command, output_format } = body;
  if (!input_url || !Array.isArray(command) || command.length === 0 || !output_format) {
    return NextResponse.json(
      { error: 'input_url, command (string[]), and output_format are required' },
      { status: 400 }
    );
  }

  // 1. Pull input bytes
  const srcResp = await fetch(input_url);
  if (!srcResp.ok) {
    return NextResponse.json(
      { error: `Failed to fetch input_url: ${srcResp.status}` },
      { status: 400 }
    );
  }
  const inputBytes = new Uint8Array(await srcResp.arrayBuffer());
  const inputExt = extFromUrl(input_url, 'mp4');
  const inputName = `input.${inputExt}`;
  const outputName = `output.${output_format}`;

  // 2. Run WASM ffmpeg
  let outputBytes: Uint8Array;
  try {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    await ffmpeg.writeFile(inputName, inputBytes);

    // The command builder may have used a generic 'input.mp4' literal.
    // Rewrite it to match the actual extension we wrote into the FS so
    // commands work regardless of input format.
    const normalizedCommand = command.map((arg) =>
      typeof arg === 'string' ? arg.replace(/^input\.[a-zA-Z0-9]+$/, inputName) : arg
    );

    await ffmpeg.exec(normalizedCommand);
    const result = await ffmpeg.readFile(outputName);
    outputBytes = result instanceof Uint8Array ? result : new Uint8Array(0);
    if (outputBytes.length === 0) {
      throw new Error(`ffmpeg produced empty output (${outputName})`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FFmpeg execution failed';
    console.error('[api/editing/ffmpeg]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 3. Upload to Supabase Storage
  const path = `edited/${userId}/${Date.now()}_${outputName}`;
  const db = createServiceSupabase();

  const contentTypeMap: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };

  const { error: uploadError } = await db.storage
    .from('media')
    .upload(path, outputBytes, {
      contentType: contentTypeMap[output_format] || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: pub } = db.storage.from('media').getPublicUrl(path);

  return NextResponse.json({
    output_url: pub.publicUrl,
    storage_path: path,
  });
}
