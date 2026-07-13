"use client";

// Generalized video frame scrubber: play a video (from an in-memory File OR a
// remote URL), scrub with a slider, and capture the current frame to a JPEG File
// via <canvas>. Remote URLs are loaded with crossOrigin="anonymous" so the canvas
// stays untainted (campaign-media serves Access-Control-Allow-Origin: *).
// If the video can't decode in-browser (onError, 0x0 dimensions, or metadata
// never loads) it reports onUndecodable so the caller can force an image upload.

import { useState, useRef, useEffect, useCallback } from "react";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VideoFrameScrubber({
  videoFile,
  videoUrl,
  onFrame,
  onUndecodable,
  actionLabel,
  onAction,
  busy,
}: {
  videoFile?: File;
  videoUrl?: string;
  onFrame?: (file: File) => void; // called with the latest captured frame on each seek
  onUndecodable?: () => void; // video can't be decoded/drawn in this browser
  actionLabel?: string; // when set, render a primary button (e.g. "Use this frame")
  onAction?: (file: File) => void; // called with the latest frame when the button is clicked
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestFile = useRef<File | null>(null);
  const settled = useRef(false); // metadata loaded or a failure already reported

  const [objUrl, setObjUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  // File → object URL (revoked on cleanup); remote URL used directly.
  useEffect(() => {
    if (videoFile) {
      const u = URL.createObjectURL(videoFile);
      setObjUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setObjUrl(null);
  }, [videoFile]);

  const src = videoFile ? objUrl : videoUrl || null;
  const needsCrossOrigin = !videoFile && !!videoUrl; // remote → canvas needs CORS

  const fail = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onUndecodable?.();
  }, [onUndecodable]);

  // If metadata never arrives, treat the video as undecodable.
  useEffect(() => {
    if (!src) return;
    settled.current = false;
    setReady(false);
    setHasFrame(false);
    const t = setTimeout(() => { if (!settled.current) fail(); }, 12000);
    return () => clearTimeout(t);
  }, [src, fail]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    if (!video.videoWidth || !video.videoHeight) { fail(); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const f = new File([blob], `frame-${Date.now()}.jpg`, { type: "image/jpeg" });
          latestFile.current = f;
          setHasFrame(true);
          onFrame?.(f);
        },
        "image/jpeg",
        0.9,
      );
    } catch {
      // Tainted canvas or decode failure → fall back to upload.
      fail();
    }
  }, [onFrame, fail]);

  if (!src) return null;

  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-white/10 bg-black mb-3">
        <video
          ref={videoRef}
          src={src}
          {...(needsCrossOrigin ? { crossOrigin: "anonymous" as const } : {})}
          muted
          playsInline
          preload="metadata"
          className="w-full block max-h-[220px] object-contain bg-black"
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (!v) return;
            if (!v.videoWidth || !v.videoHeight) { fail(); return; }
            settled.current = true;
            setDuration(v.duration || 0);
            setReady(true);
            // Nudge off 0 so onSeeked fires and we capture an initial frame.
            v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
          }}
          onSeeked={capture}
          onError={fail}
        />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-white/40 font-mono w-10 text-right">{fmt(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          disabled={!ready}
          onChange={(e) => {
            const t = parseFloat(e.target.value);
            setCurrentTime(t);
            if (videoRef.current) videoRef.current.currentTime = t;
          }}
          className="flex-1 h-1 accent-[#D73F09] cursor-pointer disabled:opacity-40"
        />
        <span className="text-[10px] text-white/40 font-mono w-10">{fmt(duration)}</span>
      </div>

      {actionLabel && (
        <div className="flex justify-end">
          <button
            onClick={() => { if (latestFile.current) onAction?.(latestFile.current); }}
            disabled={!hasFrame || !!busy}
            className="px-4 py-2 bg-[#D73F09] rounded-lg text-white font-bold text-xs uppercase tracking-wider disabled:opacity-30"
          >
            {busy ? "Saving…" : actionLabel}
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
