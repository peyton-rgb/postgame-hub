// ============================================================
// Tiny in-memory rate limiter (best-effort)
//
// Defense-in-depth for the public videographer routes. Per-process only
// (serverless instances don't share state), so it's a light touch on top of
// the real controls (high-entropy token, scoped writes, type/size limits,
// revocable links). For hard guarantees, move to a shared store (e.g. Upstash).
// ============================================================

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
