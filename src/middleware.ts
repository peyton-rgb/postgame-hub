import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session (important for server components)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protect /dashboard and /packages routes — redirect to /login if not
  // authenticated. /packages is the staff-only Editor Asset Packages index;
  // RLS already hides package data from anon, but staff pages should bounce to
  // login rather than render an empty shell. (The public /pkg/[token] grab-and-go
  // page is intentionally NOT gated here — it has its own share-token gate.)
  if (
    !user &&
    (path.startsWith("/dashboard") || path.startsWith("/packages") || path.startsWith("/board"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ------------------------------------------------------------
  // Brand (client) logins are scoped to /portal and nothing else.
  //
  // Presence of a session is NOT enough for the staff surfaces: a brand
  // user is authenticated, so without this they would sail through the
  // !user check above and into the staff dashboard. /admin is gated
  // separately by requireAdmin() in its layout; this covers the routes
  // in the matcher below.
  //
  // One profiles read, and only for signed-in users on a staff path —
  // anonymous traffic and /portal never pay for it.
  // ------------------------------------------------------------
  const isStaffSurface =
    path.startsWith("/dashboard") ||
    path.startsWith("/packages") ||
    path.startsWith("/board");

  if (user && (isStaffSurface || path === "/login")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("access_level")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.access_level === "brand") {
      const url = request.nextUrl.clone();
      // On /login send them home; on a staff surface say why.
      url.pathname = path === "/login" ? "/portal" : "/portal/denied";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // If logged in and hitting /login, redirect to dashboard
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/readiness";
    return NextResponse.redirect(url);
  }

  // Athlete app: the login + signup + password-reset pages are public;
  // everything else under /athlete requires a session. Role gating (athlete vs
  // staff) happens in the (app) layout via requireAthlete().
  const isAthleteRecovery =
    path === "/athlete/forgot" || path === "/athlete/reset-password";
  const isAthletePublic =
    path === "/athlete/login" ||
    path === "/athlete/signup" ||
    isAthleteRecovery;

  if (!user && path.startsWith("/athlete") && !isAthletePublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/athlete/login";
    return NextResponse.redirect(url);
  }

  // Already signed in but sitting on an athlete auth page → into the app.
  // Recovery routes are excluded: a password-reset link establishes a
  // short-lived recovery session, and bouncing it to /athlete would abort the
  // reset before the athlete can set their new password.
  if (user && isAthletePublic && !isAthleteRecovery) {
    const url = request.nextUrl.clone();
    url.pathname = "/athlete";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/packages/:path*", "/packages", "/board/:path*", "/board", "/login", "/athlete/:path*"],
};
