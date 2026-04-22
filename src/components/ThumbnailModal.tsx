"use client";

import { useState, useRef, useEffect, useCallback } from "react";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function ThumbnailModal({
  athleteName,
  onUpload,
  onCancel,
  videoFile,
}: {
  athleteName: string;
  onUpload: (file: File) => void;
  onCancel: () => void;
  videoFile?: File;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<"upload" | "frame">(videoFile ? "frame" : "upload");

  // Upload mode state
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);

  // Frame mode state
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [framePreview, setFramePreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState(false);

  // Create and cleanup video object URL
  useEffect(() => {
    if (!videoFile) return;
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  // Capture frame from video
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const f = new File([blob], `frame-${Date.now()}.jpg`, { type: "image/jpeg" });
        setCapturedFile(f);
        setFramePreview(canvas.toDataURL("image/jpeg", 0.9));
      },
      "image/jpeg",
      0.9
    );
  }, []);

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/") && !f.name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i)) return;

    const name = f.name.toLowerCase();
    const isHeic = name.endsWith(".heic") || name.endsWith(".heif") || f.type === "image/heic" || f.type === "image/heif";

    if (isHeic) {
      setConverting(true);
      try {
        const heic2any = (await import("heic2any")).default;
        const blob = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.9 }) as Blob;
        const newName = f.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");
        const converted = new File([blob], newName, { type: "image/jpeg" });
        setFile(converted);
        setPreview(URL.createObjectURL(converted));
      } catch (e) {
        console.error("HEIC conversion failed:", e);
        setFile(f);
        setPreview(URL.createObjectURL(f));
      }
      setConverting(false);
    } else {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async () => {
    const thumbFile = mode === "frame" ? capturedFile : file;
    if (!thumbFile) return;
    setUploading(true);
    await onUpload(thumbFile);
    setUploading(false);
  };

  const isReady = mode === "frame" ? !!capturedFile : !!file;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-black border border-white/15 rounded-2xl p-8 w-[440px] max-w-[90vw]"
      >
        <div className="text-xs font-bold uppercase tracking-[2px] text-brand mb-1">
          Video Uploaded
        </div>
        <h2 className="text-lg font-black mb-2">Set a Thumbnail</h2>
        <p className="text-sm text-white/40 mb-5">
          Choose a thumbnail for{" "}
          <span className="text-white font-bold">{athleteName}</span>&apos;s video.
        </p>

        {/* Tab toggle — only show when videoFile is available */}
        {videoFile && (
          <div className="flex bg-[#111] border border-white/10 rounded-lg p-0.5 mb-5">
            <button
              onClick={() => setMode("frame")}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                mode === "frame" ? "bg-white/10 text-white" : "text-white/40"
              }`}
            >
              Select Frame
            </button>
            <button
              onClick={() => setMode("upload")}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                mode === "upload" ? "bg-white/10 text-white" : "text-white/40"
              }`}
            >
              Upload Image
            </button>
          </div>
        )}

        {/* ── Frame Selection Mode ── */}
        {mode === "frame" && videoUrl && (
          <div className="mb-6">
            {videoError ? (
              <div className="aspect-[4/5] rounded-xl border-2 border-dashed border-white/15 bg-black flex flex-col items-center justify-center gap-3">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span className="text-xs text-white/40 font-bold text-center px-4">
                  This video format isn&apos;t supported for frame selection.
                  <br />
                  Switch to &quot;Upload Image&quot; instead.
                </span>
              </div>
            ) : (
              <>
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black mb-3">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full block"
                    style={{ objectPosition: "center 20%" }}
                    onLoadedMetadata={() => {
                      const v = videoRef.current;
                      if (v) {
                        setDuration(v.duration);
                        v.currentTime = 0;
                      }
                    }}
                    onSeeked={captureFrame}
                    onError={() => setVideoError(true)}
                  />
                </div>

                {/* Scrub slider */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-white/40 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.05}
                    value={currentTime}
                    onChange={(e) => {
                      const t = parseFloat(e.target.value);
                      setCurrentTime(t);
                      if (videoRef.current) videoRef.current.currentTime = t;
                    }}
                    className="flex-1 h-1 accent-brand cursor-pointer"
                  />
                  <span className="text-[10px] text-white/40 font-mono w-8">{formatTime(duration)}</span>
                </div>

              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* ── Upload Image Mode ── */}
        {mode === "upload" && (
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer?.files?.[0]);
            }}
            onDragOver={(e) => e.preventDefault()}
            className="aspect-[4/5] rounded-xl overflow-hidden border-2 border-dashed border-white/15 bg-black cursor-pointer flex flex-col items-center justify-center gap-2 mb-6 relative"
          >
            {converting ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-white/20 border-t-brand rounded-full animate-spin" />
                <span className="text-xs text-white/40 font-bold">Converting HEIC...</span>
              </div>
            ) : preview ? (
              <img src={preview} className="w-full h-full object-cover" alt="" />
            ) : (
              <>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeOpacity="0.2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-xs text-white/40 font-bold">
                  Click or drop an image
                </span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-2.5 border border-white/15 rounded-lg text-white/50 font-bold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isReady || uploading || converting}
            className="flex-1 px-5 py-2.5 bg-brand rounded-lg text-white font-bold text-sm disabled:opacity-30"
          >
            {converting ? "Converting..." : uploading ? "Uploading..." : "Use as Thumbnail"}
          </button>
        </div>
      </div>
    </div>
  );
}
