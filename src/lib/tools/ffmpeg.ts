// ============================================================
// FFmpeg Tool Wrapper
//
// Builds FFmpeg commands for deterministic video edits — things
// like cutting, trimming, resizing, adding text overlays,
// color adjustments, speed changes, and format conversions.
//
// These are "math edits" — no AI judgment needed, just precise
// instructions that FFmpeg executes exactly the same way every time.
//
// The actual FFmpeg execution happens via POST /api/editing/ffmpeg,
// a Next.js API route in our own app that uses @ffmpeg/ffmpeg
// (WebAssembly). No external service or binary needed.
// ============================================================

import type { ToolResult } from '@/lib/types/editing';

/**
 * Build and execute an FFmpeg command via our internal API route.
 *
 * @param action - What kind of edit (cut, trim, resize, etc.)
 * @param inputUrl - URL of the source video/image
 * @param params - Action-specific parameters
 * @returns ToolResult with the output file URL
 */
export async function executeFFmpeg(
  action: string,
  inputUrl: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  const startTime = Date.now();

  // Build the FFmpeg command based on the action type
  const command = buildFFmpegCommand(action, params);

  // Call our own API route — no external worker URL needed
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/editing/ffmpeg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_url: inputUrl,
        command,
        output_format: (params.output_format as string) || 'mp4',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        output_url: null,
        cost_usd: 0,
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
        error: `FFmpeg worker error: ${response.status} — ${errText}`,
      };
    }

    const result = await response.json();

    return {
      success: true,
      output_url: result.output_url,
      cost_usd: 0.001, // essentially free — just compute cost
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
    };
  } catch (err) {
    return {
      success: false,
      output_url: null,
      cost_usd: 0,
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
      error: `FFmpeg execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Build the FFmpeg filter/option string for a given action.
 * These get sent to the worker which constructs the full command.
 */
function buildFFmpegCommand(
  action: string,
  params: Record<string, unknown>
): string[] {
  switch (action) {
    case 'cut': {
      // Remove a segment: keep everything before start and after end
      const cutStart = params.cut_start as string; // HH:MM:SS
      const cutEnd = params.cut_end as string;
      return [
        '-vf', `select='not(between(t,${timeToSeconds(cutStart)},${timeToSeconds(cutEnd)}))'`,
        '-af', `aselect='not(between(t,${timeToSeconds(cutStart)},${timeToSeconds(cutEnd)}))'`,
        '-vsync', 'vfr',
      ];
    }

    case 'trim': {
      // Keep only a specific time range
      const trimStart = params.start_time as string;
      const trimEnd = params.end_time as string;
      return ['-ss', trimStart, '-to', trimEnd, '-c', 'copy'];
    }

    case 'resize': {
      // Change aspect ratio
      const width = params.width as number;
      const height = params.height as number;
      const fit = params.fit as string || 'contain'; // contain = letterbox, cover = crop

      if (fit === 'cover') {
        return ['-vf', `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`];
      }
      // Default: contain with blur-fill for social media formats
      if (width === 1080 && height === 1920) {
        // 9:16 vertical — special blur-fill background
        return [
          '-vf',
          `split[original][copy];[copy]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20[bg];[bg][original]overlay=(W-w)/2:(H-h)/2`,
        ];
      }
      return ['-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`];
    }

    case 'overlay_text': {
      const text = params.text as string;
      const fontSize = params.font_size as number || 48;
      const fontColor = params.font_color as string || 'white';
      const x = params.x as number || 50;
      const y = params.y as number || 50;
      return ['-vf', `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`];
    }

    case 'overlay_image': {
      const overlayUrl = params.overlay_url as string;
      const ox = params.x as number || 10;
      const oy = params.y as number || 10;
      return ['-i', overlayUrl, '-filter_complex', `[0:v][1:v]overlay=${ox}:${oy}`];
    }

    case 'color_adjust': {
      const brightness = params.brightness as number || 0;   // -1.0 to 1.0
      const contrast = params.contrast as number || 1;       // 0.0 to 2.0
      const saturation = params.saturation as number || 1;   // 0.0 to 3.0
      return ['-vf', `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`];
    }

    case 'speed_change': {
      const speed = params.speed as number || 1.0;
      // Speed up: speed > 1, slow down: speed < 1
      const videoSpeed = 1 / speed;
      const audioSpeed = speed;
      return [
        '-vf', `setpts=${videoSpeed}*PTS`,
        '-af', `atempo=${audioSpeed}`,
      ];
    }

    case 'audio_strip': {
      return ['-an']; // remove all audio streams
    }

    case 'format_convert': {
      const codec = params.codec as string || 'libx264';
      return ['-c:v', codec, '-c:a', 'aac'];
    }

    default:
      throw new Error(`Unknown FFmpeg action: ${action}`);
  }
}

/** Convert HH:MM:SS timestamp to total seconds */
function timeToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

/**
 * Estimate cost for an FFmpeg operation.
 * FFmpeg is free (open source) — cost is just cloud compute time.
 */
export function estimateFFmpegCost(): number {
  return 0.001;
}
