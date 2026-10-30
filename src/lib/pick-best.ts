// src/lib/pick-best.ts
// ─────────────────────────────────────────────────────────────
// Pure ranking logic behind the Drive picker's "Pick best" button.
// No network here — the route (/api/drive/pick-best) measures each photo
// and hands the measurements in; this file decides what to keep.
//
// Photos: every photo carries a 64-bit "dHash" — a fingerprint of its
// shapes. Two near-identical shots (burst frames, a re-export, a slight
// crop) have fingerprints that differ by only a few bits, so we treat
// them as copies and keep only the best-looking one of each group.
//
// Videos: keep just the latest version. A file named with a version
// ("V2", "v3") beats an unversioned raw clip; among versions the highest
// number wins; with no versions at all, the most recently modified wins.
// ─────────────────────────────────────────────────────────────

export interface MeasuredPhoto {
  id: string;
  name: string;
  /** 16-char hex dHash, or null if the thumbnail couldn't be measured. */
  hash: string | null;
  /** dHash of the left-right mirrored image. Mirror selfies get flipped
   *  during scrubbing so the waistband logo reads correctly — without this
   *  the original and its scrubbed copy don't look like copies. */
  flipHash?: string | null;
  /** Higher = sharper / better exposed. Comparable within one request only. */
  quality: number;
}

export interface VideoCandidate {
  id: string;
  name: string;
  modifiedTime: string | null;
}

export const PICK_MIN = 3;
export const PICK_MAX = 10;
/** Bits (of 64) two fingerprints may differ by and still count as copies. */
export const NEAR_DUP_BITS = 12;

function popcount32(n: number): number {
  let x = n >>> 0;
  let d = 0;
  while (x) {
    d += x & 1;
    x >>>= 1;
  }
  return d;
}

/** Number of differing bits between two 16-char hex fingerprints. */
export function hamming(aHex: string, bHex: string): number {
  let d = 0;
  for (let i = 0; i < 16; i += 8) {
    d += popcount32(parseInt(aHex.slice(i, i + 8), 16) ^ parseInt(bHex.slice(i, i + 8), 16));
  }
  return d;
}

/** Screenshots (of posts, DMs, stats) aren't campaign photos. */
export function isScreenshot(name: string): boolean {
  return /screen\s?shot|screenshot|screen_shot/i.test(name);
}

/** "Scrubbed" files are Postgame's brand-approved edits of an original. */
export function isScrubbed(name: string): boolean {
  return /scrub/i.test(name);
}

/** Copies if the fingerprints match as-is or with one side mirrored. */
export function isNearCopy(a: MeasuredPhoto, b: MeasuredPhoto, nearDupBits = NEAR_DUP_BITS): boolean {
  if (!a.hash || !b.hash) return false;
  if (hamming(a.hash, b.hash) <= nearDupBits) return true;
  if (b.flipHash && hamming(a.hash, b.flipHash) <= nearDupBits) return true;
  if (a.flipHash && hamming(a.flipHash, b.hash) <= nearDupBits) return true;
  return false;
}

/**
 * Best distinct photos, best first. Walks photos from highest quality down
 * and keeps one only if it isn't a near-copy of something already kept —
 * except a Scrubbed copy replaces an unscrubbed original it duplicates.
 * Unmeasurable photos (no hash) are only used to top up to PICK_MIN.
 */
export function pickBestPhotos(
  photos: MeasuredPhoto[],
  max = PICK_MAX,
  min = PICK_MIN,
  nearDupBits = NEAR_DUP_BITS,
): string[] {
  const usable = photos.filter((p) => !isScreenshot(p.name));
  const measured = usable.filter((p) => p.hash).sort((a, b) => b.quality - a.quality);
  const kept: MeasuredPhoto[] = [];
  for (const p of measured) {
    const dupAt = kept.findIndex((k) => isNearCopy(k, p, nearDupBits));
    if (dupAt >= 0) {
      if (isScrubbed(p.name) && !isScrubbed(kept[dupAt].name)) kept[dupAt] = p;
      continue;
    }
    if (kept.length < max) kept.push(p);
  }
  const ids = kept.map((p) => p.id);
  if (ids.length < min) {
    for (const p of usable) {
      if (ids.length >= min) break;
      if (!p.hash && !ids.includes(p.id)) ids.push(p.id);
    }
  }
  return ids;
}

/** Version number in a filename ("V2", "v3", "_V2_") or null. */
export function versionOf(name: string): number | null {
  const m = name.match(/(?:^|[^a-z])v(\d{1,2})(?![0-9])/i);
  return m ? parseInt(m[1], 10) : null;
}

/** An athlete's raw form upload ("copy_ABC…", "<hash> - First Last.mov"),
 *  as opposed to a Postgame edit ("V2 w Intro", "No End Card"). */
export function isRawUpload(name: string): boolean {
  return /^copy_/i.test(name) || /^[0-9a-f-]{16,}/i.test(name) || /\s-\s[A-Z][\w'.-]+(\s[\w'.-]+)+\.\w+$/i.test(name) || /_-_[A-Z][\w'.-]+_[\w'.-]+\.\w+$/i.test(name);
}

/** The single latest video, or null if there are none. Versioned edits
 *  win (highest version first); then any edit beats a raw upload; then the
 *  most recently modified. */
export function pickLatestVideo(videos: VideoCandidate[]): string | null {
  if (videos.length === 0) return null;
  const time = (v: VideoCandidate) => (v.modifiedTime ? Date.parse(v.modifiedTime) || 0 : 0);
  const sorted = [...videos].sort((a, b) => {
    const va = versionOf(a.name);
    const vb = versionOf(b.name);
    if (va !== null || vb !== null) {
      if (va === null) return 1;
      if (vb === null) return -1;
      if (va !== vb) return vb - va;
    }
    const ra = isRawUpload(a.name) ? 1 : 0;
    const rb = isRawUpload(b.name) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return time(b) - time(a);
  });
  return sorted[0].id;
}
