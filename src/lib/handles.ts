/**
 * Normalize a social handle that may have been entered as a full profile URL,
 * an @-prefixed handle, or a bare handle. Always returns a bare handle — no
 * leading "@", no URL — suitable for display as `@{handle}` and for building a
 * profile link as `https://instagram.com/{handle}`.
 *
 * Performance-tracker sheets sometimes have a full URL pasted into the IG (or
 * TikTok) handle column instead of just the handle. This collapses both the
 * Instagram and TikTok URL shapes down to the username so the recap shows a
 * clean handle and a working link.
 *
 *   https://www.instagram.com/alexkaraban_/?hl=en  -> alexkaraban_
 *   instagram.com/username                          -> username
 *   https://www.tiktok.com/@username                -> username
 *   tiktok.com/username                             -> username
 *   @username                                        -> username
 *   username                                         -> username
 *   "" / undefined / null                            -> ""
 */
export function normalizeHandle(raw: string | undefined | null): string {
  if (!raw) return "";
  let v = raw.trim();
  if (!v) return "";

  // If it carries an Instagram/TikTok host, take the first path segment after
  // it (the username). The optional "@" absorbs TikTok's "/@username" form.
  const urlMatch = v.match(/(?:instagram|tiktok)\.com\/@?([^/?#\s]+)/i);
  if (urlMatch) v = urlMatch[1];

  // Strip any leading "@" left on a bare handle.
  return v.replace(/^@+/, "").trim();
}
