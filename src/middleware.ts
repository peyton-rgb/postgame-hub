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

  // Protect /dashboard routes — redirect to /login if not authenticated
  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If logged in and hitting /login, redirect to dashboard
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
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
  matcher: ["/dashboard/:path*", "/login", "/athlete/:path*"],
};
