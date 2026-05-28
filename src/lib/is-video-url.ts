// src/lib/is-video-url.ts
// Single source of truth for "should this URL render as <video>?"
// Detection is by extension only — fast, predictable, no network probing.
// Case-insensitive. Trims query strings and fragments before checking.
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "m4v"]);

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const cleanPath = url.split("?")[0].split("#")[0];
  const ext = cleanPath.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXT.has(ext);
}
