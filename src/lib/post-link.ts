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
