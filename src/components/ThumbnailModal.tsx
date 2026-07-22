"use client";

import { useState, useRef } from "react";
import { VideoFrameScrubber } from "./VideoFrameScrubber";

export function ThumbnailModal({
  athleteName,
  onUpload,
  onCancel,
  videoFile,
  videoUrl,
}: {
  athleteName: string;
  onUpload: (file: File) => void;
  onCancel: () => void;
  videoFile?: File;
  /** Scrub an already-uploaded video by URL (e.g. a Drive-imported clip). */
  videoUrl?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"upload" | "frame">(videoFile || videoUrl ? "frame" : "upload");

  // Upload mode state
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);

  // Frame mode state (capture is delegated to VideoFrameScrubber)
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState(false);

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
          {videoFile ? "Video Uploaded" : "Video Cover"}
        </div>
        <h2 className="text-lg font-black mb-2">Set a Thumbnail</h2>
        <p className="text-sm text-white/40 mb-5">
          Choose a thumbnail for{" "}
          <span className="text-white font-bold">{athleteName}</span>&apos;s video.
        </p>

        {/* Tab toggle — shown when a video (file or URL) is available */}
        {(videoFile || videoUrl) && (
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
        {mode === "frame" && (videoFile || videoUrl) && (
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
              <VideoFrameScrubber
                videoFile={videoFile}
                videoUrl={videoUrl}
                onFrame={setCapturedFile}
                onUndecodable={() => setVideoError(true)}
              />
            )}
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
