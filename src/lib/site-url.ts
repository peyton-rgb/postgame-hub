// ============================================================
// The Hub's canonical public base URL.
//
// For links that LEAVE the app — a Slack DM, an email, an OG tag, a signup
// link. Anything a person opens from somewhere else has to land on the domain
// that is actually public.
//
// Deliberately NOT derived from the request origin. A request that arrived on a
// deployment-specific alias would mint links on that alias, and every Vercel
// alias except the canonical one sits behind Protected Deployment SSO — so the
// recipient meets a login wall instead of the page. That is exactly how a
// campaign manager was sent a dead dashboard link on 31 Aug: the request came
// in through the git-main alias.
//
// NEXT_PUBLIC_SITE_URL is still honoured, so a real custom domain can be set
// without a code change — but a value pointing at a non-canonical *.vercel.app
// alias is REJECTED rather than trusted. That is the shape of the mistake this
// module exists to prevent, and on 31 Aug the production var held exactly that.
// ============================================================

/** The public production domain. Verified reachable without SSO. */
const CANONICAL = "https://postgame-hub.vercel.app";

/** Hostname of CANONICAL, for comparing a configured override against it. */
const CANONICAL_HOST = "postgame-hub.vercel.app";

/**
 * True for a Vercel alias that is not the canonical one — a git-branch alias
 * (`…-git-main-<team>.vercel.app`), a per-deployment alias, or the team-scoped
 * project alias. All of these are protected; none is safe to hand to a person.
 *
 * Any non-vercel.app host is assumed to be a real custom domain and allowed.
 */
function isProtectedAlias(host: string): boolean {
  if (!host.endsWith(".vercel.app")) return false;
  return host !== CANONICAL_HOST;
}

/**
 * The base URL to build outbound links from. Never throws, never returns a
 * trailing slash, and never returns a host a recipient cannot open.
 */
export function siteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (!configured) return CANONICAL;

  let host: string;
  try {
    host = new URL(configured).host;
  } catch {
    // A malformed override is a config typo, not a reason to mint broken links.
    console.warn("[site-url] NEXT_PUBLIC_SITE_URL is not a valid URL — using the canonical domain");
    return CANONICAL;
  }

  if (isProtectedAlias(host)) {
    console.warn(
      `[site-url] NEXT_PUBLIC_SITE_URL points at the protected alias ${host} — using the canonical domain instead`,
    );
    return CANONICAL;
  }

  return configured.replace(/\/$/, "");
}
