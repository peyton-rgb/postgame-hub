// ============================================================
// FFmpeg tool — builds command-line args for the deterministic edit
// actions and POSTs them to /api/editing/ffmpeg, where the WASM
// runtime executes the command and uploads the result.
//
// Splitting the build (here) from the execute (the API route) keeps
// the agent layer pure — the orchestrator can dry-run the command
// builder without spinning up the WASM runtime.
// ============================================================

import type { ToolResult } from '@/lib/types/editing';

// --- Time helpers ---

// HH:MM:SS or HH:MM:SS.mmm → seconds
export function timeToSeconds(timestamp: string): number {
  const parts = String(timestamp).split(':').map((p) => parseFloat(p));
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  return Number.isFinite(parts[0]) ? parts[0] : 0;
}

// --- Cost estimate ---
// FFmpeg WASM runs server-side without per-call cost. We charge a
// nominal fraction so the totals don't show "$0".
export function estimateFFmpegCost(): number {
  return 0.001;
}

// --- Command builder ----------------------------------------------

// Returns a flat array of FFmpeg CLI args, NOT including the leading
// 'ffmpeg' binary or the input file (-i input.ext) — those are added
// by the executor with the canonical input filename. The args MUST
// end with the canonical output filename (e.g. 'output.mp4').
export function buildFFmpegCommand(
  action: string,
  params: Record<string, unknown>
): { args: string[]; outputFormat: string } {
  const fmt = (params.output_format as string) || 'mp4';
  const out = `output.${fmt}`;
  const inputName = (params.input_name as string) || 'input.mp4';

  switch (action) {
    case 'cut': {
      // Remove the [cut_start, cut_end] segment by concatenating the
      // before-and-after slices with select/aselect filter expressions.
      const cutStart = timeToSeconds(String(params.cut_start));
      const cutEnd = timeToSeconds(String(params.cut_end));
      const filter =
        `[0:v]select='not(between(t,${cutStart},${cutEnd}))',setpts=N/FRAME_RATE/TB[v];` +
        `[0:a]aselect='not(between(t,${cutStart},${cutEnd}))',asetpts=N/SR/TB[a]`;
      return {
        args: ['-i', inputName, '-filter_complex', filter, '-map', '[v]', '-map', '[a]', out],
        outputFormat: fmt,
      };
    }

    case 'trim': {
      const start = String(params.start_time ?? '00:00:00');
      const end = String(params.end_time ?? '00:00:00');
      return {
        args: ['-i', inputName, '-ss', start, '-to', end, '-c', 'copy', out],
        outputFormat: fmt,
      };
    }

    case 'resize': {
      const width = Number(params.width) || 1920;
      const height = Number(params.height) || 1080;
      const fillStyle = String(params.fill_style || 'pad'); // 'pad' | 'blur'
      // Special-case 9:16 vertical with blur fill — looks much better
      // than letterboxed black bars for social.
      if (width === 1080 && height === 1920 && fillStyle === 'blur') {
        const filter =
          `[0:v]split=2[bg][fg];` +
          `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=20[bgblur];` +
          `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fgs];` +
          `[bgblur][fgs]overlay=(W-w)/2:(H-h)/2`;
        return {
          args: ['-i', inputName, '-filter_complex', filter, '-c:a', 'copy', out],
          outputFormat: fmt,
        };
      }
      const filter =
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
      return {
        args: ['-i', inputName, '-vf', filter, '-c:a', 'copy', out],
        outputFormat: fmt,
      };
    }

    case 'overlay_text': {
      const text = String(params.text ?? '').replace(/'/g, "\\'").replace(/:/g, '\\:');
      const fontSize = Number(params.font_size) || 48;
      const fontColor = String(params.font_color || 'white');
      const x = String(params.x ?? '(w-text_w)/2');
      const y = String(params.y ?? '(h-text_h)-40');
      const filter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`;
      return {
        args: ['-i', inputName, '-vf', filter, '-c:a', 'copy', out],
        outputFormat: fmt,
      };
    }

    case 'overlay_image': {
      // Caller is responsible for shipping the overlay image alongside
      // the input — we expect it at 'overlay.png' inside the WASM FS.
      const overlayName = (params.overlay_name as string) || 'overlay.png';
      const x = String(params.x ?? 'W-w-20');
      const y = String(params.y ?? 'H-h-20');
      const opacity = Number(params.opacity ?? 1);
      const overlayChain =
        opacity < 1
          ? `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[ov];[0:v][ov]overlay=${x}:${y}`
          : `[0:v][1:v]overlay=${x}:${y}`;
      return {
        args: ['-i', inputName, '-i', overlayName, '-filter_complex', overlayChain, '-c:a', 'copy', out],
        outputFormat: fmt,
      };
    }

    case 'color_adjust': {
      const brightness = Number(params.brightness ?? 0);   // -1.0 .. 1.0
      const contrast = Number(params.contrast ?? 1);       // 0 .. 2
      const saturation = Number(params.saturation ?? 1);   // 0 .. 3
      const filter = `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`;
      return {
        args: ['-i', inputName, '-vf', filter, '-c:a', 'copy', out],
        outputFormat: fmt,
      };
    }

    case 'speed_change': {
      const speed = Number(params.speed ?? 1);
      if (speed <= 0) throw new Error('speed must be > 0');
      // setpts and atempo are inverses.
      const vSetpts = `setpts=${(1 / speed).toFixed(4)}*PTS`;
      // atempo accepts 0.5..2.0; chain for extreme values.
      const aChain: string[] = [];
      let remaining = speed;
      while (remaining > 2.0) { aChain.push('atempo=2.0'); remaining /= 2.0; }
      while (remaining < 0.5) { aChain.push('atempo=0.5'); remaining /= 0.5; }
      aChain.push(`atempo=${remaining.toFixed(4)}`);
      const filter = `[0:v]${vSetpts}[v];[0:a]${aChain.join(',')}[a]`;
      return {
        args: ['-i', inputName, '-filter_complex', filter, '-map', '[v]', '-map', '[a]', out],
        outputFormat: fmt,
      };
    }

    case 'audio_strip':
      return {
        args: ['-i', inputName, '-an', '-c:v', 'copy', out],
        outputFormat: fmt,
      };

    case 'format_convert': {
      const videoCodec = String(params.video_codec || 'libx264');
      const audioCodec = String(params.audio_codec || 'aac');
      return {
        args: ['-i', inputName, '-c:v', videoCodec, '-c:a', audioCodec, out],
        outputFormat: fmt,
      };
    }

    default:
      throw new Error(`Unknown ffmpeg action: ${action}`);
  }
}

// --- Executor ------------------------------------------------------

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// Sends the prepared command to /api/editing/ffmpeg and surfaces the
// resulting public URL as a ToolResult.
export async function executeFFmpeg(
  action: string,
  inputUrl: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  const start = Date.now();
  const { args, outputFormat } = buildFFmpegCommand(action, params);

  const resp = await fetch(`${baseUrl()}/api/editing/ffmpeg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Allow agent-side calls to authenticate via service role if needed.
      ...(process.env.EDITING_INTERNAL_TOKEN
        ? { 'x-postgame-internal': process.env.EDITING_INTERNAL_TOKEN }
        : {}),
    },
    body: JSON.stringify({
      input_url: inputUrl,
      command: args,
      output_format: outputFormat,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ffmpeg API ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as { output_url?: string; storage_path?: string };
  if (!data.output_url) {
    throw new Error('ffmpeg API returned no output_url');
  }

  return {
    output_url: data.output_url,
    cost_usd: estimateFFmpegCost(),
    duration_seconds: (Date.now() - start) / 1000,
    metadata: { storage_path: data.storage_path },
  };
}
