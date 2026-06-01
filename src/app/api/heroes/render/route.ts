// ============================================================
// POST /api/heroes/render
//
// Server-side proxy to the Fly ffmpeg-worker. Keeps the worker
// secret out of the browser and lets us require a dashboard
// session so anonymous traffic can't burn worker compute.
//
// Body: { mediaId?, sourceUrl, look: 'blur' | 'mirror' }
// Returns: { rendered_url, cached, render_ms? }
//
// mediaId falls back to hash(sourceUrl) when the client doesn't
// have a media.id — keeps the cache key stable across surfaces and
// editor sessions for the same clip URL.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { Agent } from 'undici';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Custom dispatcher for the hub→worker fetch.
//
// Cold-start hero renders can run 4–8 minutes (Fly machine wake + ffmpeg).
// Undici's default headersTimeout / bodyTimeout is 300s, which cuts the
// connection right around the time long renders are about to respond — the
// worker upload succeeds but the hub never sees the response, so the picker
// modal spins forever. Setting both to 0 disables those timeouts.
//
// Connect timeout stays at 10s so genuine network issues still fail fast.
//
// Module-level singleton so all requests share one Agent (and one connection
// pool). HMR may rebuild this in dev — acceptable, low traffic.
const heroRenderDispatcher = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  connect: { timeout: 10_000 },
});
// NOTE: we intentionally do NOT use `createServerSupabase` from
// `@/lib/supabase-server` here. That helper uses the plain
// `@supabase/supabase-js` client which reads the session from
// localStorage (empty in Node) — so `getUser()` always returns null
// and every request 401s. We read cookies directly via the
// `@supabase/ssr` server client instead, which is where the
// dashboard's browser client (createBrowserSupabase) actually
// stores the session. Tracked as a follow-up: replace the shared
// helper everywhere after auditing existing callers.

export const runtime = 'nodejs';
// Up to 5 minutes for cold-start renders — matches the modal's "few minutes"
// copy and the upper bound we observed when the Fly machine was waking up.
// Vercel Pro caps maxDuration at 300; Hobby caps at 60.
export const maxDuration = 300;

const WORKER_URL = process.env.FFMPEG_WORKER_URL || 'https://postgame-ffmpeg-worker.fly.dev';
const WORKER_SECRET = process.env.FFMPEG_WORKER_SECRET;

// 12 hex chars (~48 bits) of sha1 over the URL. Collision-resistant for a small
// worker cache; the 'urlhash_' prefix makes URL-derived cache files obvious in
// Storage so a future cleanup can distinguish them from media-row renders.
function stableIdFromUrl(url: string): string {
  return 'urlhash_' + createHash('sha1').update(url).digest('hex').slice(0, 12);
}

export async function POST(req: NextRequest) {
  if (!WORKER_SECRET) {
    return NextResponse.json(
      { error: 'FFMPEG_WORKER_SECRET not configured on hub' },
      { status: 500 }
    );
  }

  // Require an authenticated dashboard session — no anon worker compute.
  // Cookies are written by the dashboard's createBrowserSupabase (uses
  // @supabase/ssr's createBrowserClient); we read them here via the matching
  // server client.
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Setting cookies isn't always permitted in every server context;
            // safe to ignore for a read-only auth check.
          }
        },
      },
    },
  );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { mediaId?: string; sourceUrl?: string; look?: string }
    | null;
  if (!body || !body.sourceUrl || !body.look) {
    return NextResponse.json({ error: 'sourceUrl and look are required' }, { status: 400 });
  }
  if (body.look !== 'blur' && body.look !== 'mirror') {
    return NextResponse.json({ error: "look must be 'blur' or 'mirror'" }, { status: 400 });
  }

  const cacheKey =
    body.mediaId && body.mediaId.length > 0
      ? body.mediaId
      : stableIdFromUrl(body.sourceUrl);

  const workerRes = await fetch(`${WORKER_URL}/render-hero`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ffmpeg-secret': WORKER_SECRET,
    },
    body: JSON.stringify({
      mediaId: cacheKey,
      sourceUrl: body.sourceUrl,
      look: body.look,
    }),
    // @ts-expect-error — `dispatcher` is undici-specific and not in Node's RequestInit type
    dispatcher: heroRenderDispatcher,
  });

  const workerBody = await workerRes
    .json()
    .catch(() => ({ error: 'worker returned non-JSON' }));

  if (!workerRes.ok) {
    return NextResponse.json(
      { error: workerBody?.error || `worker HTTP ${workerRes.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json(workerBody);
}
