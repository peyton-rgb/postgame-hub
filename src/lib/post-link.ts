// ============================================================
// Post-link check — shared by the athlete page (/deliver/[token]) and
// POST /api/deliver/[token]/posted, so the Submit button and the server
// agree on what counts as a valid link. Pure: no server imports.
// ============================================================

// Hosts a post link may live on. Subdomains count (www., m., vm., vt.), so a
// TikTok share short-link like vm.tiktok.com/ZM... passes.
const POST_HOSTS = ['instagram.com', 'tiktok.com'];

export type LiveUrlCheck = { ok: true; url: string } | { ok: false; error: string };

// A post link must be an http(s) Instagram or TikTok URL of sane length.
// Anything else is refused rather than stored and later rendered as an href
// on staff screens — and a posted link is what starts payment, so a wrong
// one is worse than none.
export function checkLiveUrl(value: unknown): LiveUrlCheck {
  const fail = (error: string): LiveUrlCheck => ({ ok: false, error });
  if (typeof value !== 'string' || !value.trim()) {
    return fail('Paste the link to your post.');
  }
  let raw = value.trim();
  if (raw.length > 2048) return fail('That link is too long. Paste the link to your post.');
  // People paste "instagram.com/reel/..." without the scheme.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("That doesn't look like a link. Paste the link to your post.");
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return fail("That doesn't look like a link. Paste the link to your post.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const allowed = POST_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) {
    return fail('That link needs to be from Instagram or TikTok. Open your post, copy its link, and paste it here.');
  }
  url.protocol = 'https:';
  return { ok: true, url: url.toString() };
}

// ============================================================
// Per-platform links (migration 075): every post goes up on Instagram,
// TikTok and X, and each link is checked for its own platform's post shape.
// Shared by the athlete page (so Save only enables on a real link) and
// POST /api/deliver/[token]/link (which re-checks on the server).
//
// Accepted:
//   instagram  instagram.com/reel/…, /reels/…, /p/…
//   tiktok     tiktok.com/@user/video/…, /@user/photo/…, vm.tiktok.com/…,
//              vt.tiktok.com/…
//   x          x.com/<user>/status/<id>, twitter.com/<user>/status/<id>
// www. and m. (mobile.) are accepted; tracking query strings and #fragments
// are stripped, so what's stored is the plain post link.
// ============================================================

export type Platform = 'instagram' | 'tiktok' | 'x';
export const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'x'];

const EXPECTED: Record<Platform, string> = {
  instagram: 'That needs to be the link to your Instagram post. It looks like instagram.com/reel/… or instagram.com/p/…',
  tiktok: 'That needs to be the link to your TikTok. It looks like tiktok.com/@you/video/… or vm.tiktok.com/…',
  x: 'That needs to be the link to your post on X. It looks like x.com/you/status/…',
};

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/, '').replace(/^(www|m|mobile)\./, '');
}

export function checkPlatformLink(platform: Platform, value: unknown): LiveUrlCheck {
  const fail = (): LiveUrlCheck => ({ ok: false, error: EXPECTED[platform] });
  if (typeof value !== 'string' || !value.trim()) return fail();
  let raw = value.trim();
  if (raw.length > 2048) return fail();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail();
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail();
  const host = hostOf(url);
  const path = url.pathname.replace(/\/+$/, '');

  let clean: string | null = null;
  if (platform === 'instagram') {
    const m = /^\/(reels?|p)\/([A-Za-z0-9_-]+)/.exec(path);
    if (host === 'instagram.com' && m) clean = `https://www.instagram.com/${m[1]}/${m[2]}/`;
  } else if (platform === 'tiktok') {
    if (host === 'tiktok.com') {
      const m = /^\/(@[A-Za-z0-9._-]+)\/(video|photo)\/(\d+)/.exec(path);
      if (m) clean = `https://www.tiktok.com/${m[1]}/${m[2]}/${m[3]}`;
    } else if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
      const m = /^\/([A-Za-z0-9]+)/.exec(path);
      if (m) clean = `https://${host}/${m[1]}/`;
    }
  } else if (platform === 'x') {
    if (host === 'x.com' || host === 'twitter.com') {
      const m = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/.exec(path);
      if (m) clean = `https://${host}/${m[1]}/status/${m[2]}`;
    }
  }
  return clean ? { ok: true, url: clean } : fail();
}
