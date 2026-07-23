import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// OAuth callback for staff Google sign-in (see /authorize).
//
// Flow: Google redirects here with ?code=… and ?next=…. We exchange the code
// for a session (writing the auth cookies onto the response), then enforce a
// domain guard: only @pstgm.com accounts are allowed through. Anyone else is
// signed out and bounced back to /authorize with an error.
//
// This is the third and last lock behind Google's Internal user type and the
// handle_new_user DB trigger. It makes /auth/callback effectively staff-only —
// correct today because athletes sign in with email + password and their
// password-reset flow lands on /athlete/reset-password, never here. If athlete
// Google sign-in is ever added, this guard must branch on the `next` path
// first.

const STAFF_DOMAIN = "@pstgm.com";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // ─── TEMPORARY DIAGNOSTIC — REMOVE after root-causing the missing PKCE
  // verifier (tracked in the follow-up revert PR). Logs NO cookie values and
  // NO secrets: only the query param KEYS (not the raw `code` value), whether
  // `code` is present, the NAMES of incoming cookies (to see if the verifier
  // cookie arrived), the request host, and the user-agent (to tell whether
  // failing attempts come from a different browser/profile than succeeding
  // ones).
  const cookieNames = request.cookies.getAll().map((c) => c.name);
  console.log(
    "[authorize-callback-diag]",
    JSON.stringify({
      host: request.nextUrl.host,
      queryKeys: [...searchParams.keys()],
      hasCode: code !== null,
      cookieNames,
      hasVerifierCookie: cookieNames.some((n) => n.endsWith("-code-verifier")),
      userAgent: request.headers.get("user-agent"),
    })
  );
  // ─── END TEMPORARY DIAGNOSTIC ───

  // Only allow same-origin relative redirects for `next` — never an
  // attacker-supplied absolute URL.
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/authorize?error=auth`);
  }

  // Build the response first so the Supabase client can attach session cookies
  // to it as it exchanges the code.
  let response = NextResponse.redirect(`${origin}${safeNext}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/authorize?error=auth`);
  }

  // Domain guard. Read the freshly signed-in user and confirm the email is a
  // Postgame Workspace address. Reject anything else.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase() ?? "";
  if (userError || !email.endsWith(STAFF_DOMAIN)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/authorize?error=domain`);
  }

  return response;
}
