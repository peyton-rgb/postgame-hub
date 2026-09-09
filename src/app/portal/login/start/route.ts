import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ============================================================
// /portal/login/start — hand off to the OAuth provider.
//
// WHY A ROUTE HANDLER AND NOT A SERVER ACTION. This was a server action
// calling redirect(data.url), and the button did nothing: Next returns a
// server action's redirect as an instruction for the client router, which
// will not navigate to a different origin. Observed as
// `POST /portal/login 200` followed by a re-render of the same page, with
// no error logged — the action reached the redirect and the redirect was
// quietly dropped. A route handler issues a real 307 the browser follows,
// which is also how every other "sign in with…" link on the web works.
//
// Deliberately does NOT check whether the address is on a brand account:
// with OAuth we do not know the address until the provider hands it back.
// That check lives in /portal/auth/callback, which is the only gate.
// ============================================================

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** Providers this door accepts. Anything else is refused, not passed through. */
const PROVIDERS = ["google", "azure"] as const;
type PortalProvider = (typeof PROVIDERS)[number];

/** Hostname plus optional port, and nothing else. */
const HOST_RE = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

function fallbackOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app").replace(
    /\/$/,
    ""
  );
}

/**
 * The origin the browser is actually on.
 *
 * This used to be NEXT_PUBLIC_SITE_URL unconditionally, which meant signing
 * in from localhost sent you to production and back — the session landed in
 * the wrong place and local testing was impossible. Deriving it from the
 * request makes local, preview and production each redirect to themselves,
 * so Vercel preview deployments work with no extra configuration.
 *
 * SECURITY NOTE. The Host header is supplied by the client, so a forged one
 * would produce a redirect_to pointing elsewhere. Two things stop that
 * being an open redirect: the value is sanitised here to a bare
 * hostname[:port] with an http/https scheme, and — the real backstop —
 * Supabase refuses to redirect anywhere outside the project's Redirect URL
 * allowlist. That allowlist is what makes this safe, so it must stay scoped
 * to hosts we own rather than a broad pattern.
 */
function requestOrigin(request: NextRequest): string {
  // x-forwarded-host is what a proxy (Vercel) sets; host is what you get
  // locally. Either may arrive as a comma-separated list through a chain of
  // proxies — only the first hop is meaningful.
  const host = (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    ""
  )
    .split(",")[0]
    .trim();
  if (!HOST_RE.test(host)) return fallbackOrigin();

  const forwardedProto = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  const proto =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  if (proto !== "http" && proto !== "https") return fallbackOrigin();

  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const raw = searchParams.get("provider") ?? "";
  if (!PROVIDERS.includes(raw as PortalProvider)) {
    return NextResponse.redirect(`${origin}/portal/login?error=provider`);
  }
  const provider = raw as PortalProvider;

  // A placeholder response for the client to write the PKCE code-verifier
  // cookie onto. signInWithOAuth issues that verifier and the callback must
  // read it back, so it has to survive this hop or every exchange fails.
  const carrier = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            carrier.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${requestOrigin(request)}/portal/auth/callback`,
      // Return the URL instead of trying to navigate — there is no browser
      // here, and this handler owns the response.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    console.error(
      `[portal-login] could not start ${provider} OAuth: ${error?.message ?? "no url returned"}`
    );
    return NextResponse.redirect(`${origin}/portal/login?error=provider`);
  }

  // Carry the verifier cookie onto the redirect. Without this the cookie is
  // written to a response nobody sees and the callback has nothing to
  // exchange with.
  const out = NextResponse.redirect(data.url);
  for (const cookie of carrier.cookies.getAll()) out.cookies.set(cookie);
  return out;
}
