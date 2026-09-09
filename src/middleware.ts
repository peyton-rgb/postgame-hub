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
  // Staff surfaces are an ALLOWLIST, not a denylist.
  //
  // Presence of a session is NOT enough: a brand or athlete user is
  // authenticated, so without this they sail through the !user check above and
  // into the staff dashboard. Only 4 of the 67 /dashboard routes call
  // requireStaff(), and dashboard/layout.tsx does no auth at all, so this file
  // is the only thing carrying that boundary for the other 63.
  //
  // This used to test `access_level === "brand"` and redirect. That shape fails
  // OPEN by construction — it admits athlete, admits the undefined value when a
  // user has no profiles row, and admits any access_level added later. Naming
  // the three levels that belong here fails closed instead: anything this file
  // has not been taught about is turned away rather than let through.
  //
  // /admin is gated separately by requireAdmin() in its layout; this covers the
  // routes in the matcher below.
  //
  // One profiles read, and only for signed-in users on a staff path —
  // anonymous traffic and /portal never pay for it.
  // ------------------------------------------------------------
  const STAFF_ACCESS_LEVELS = new Set(["staff", "admin", "exec"]);

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

    const level = profile?.access_level;

    if (typeof level !== "string" || !STAFF_ACCESS_LEVELS.has(level)) {
      const url = request.nextUrl.clone();
      url.search = "";

      if (level === "brand") {
        // Unchanged behaviour: brands live in /portal, and are told why when
        // they land on a staff path.
        url.pathname = path === "/login" ? "/portal" : "/portal/denied";
      } else if (level === "athlete") {
        // Matches requireStaff(), which already sends athletes here.
        url.pathname = "/athlete";
      } else {
        // No profiles row (maybeSingle returns null), or an access_level nobody
        // has taught this file about. Fail closed to the public site: /login
        // would loop, because this block also runs on /login, and /portal and
        // /athlete each assume a role we cannot infer.
        url.pathname = "/";
      }

      return NextResponse.redirect(url);
    }
  }

  // ------------------------------------------------------------
  // Brand portal SESSION surfaces.
  //
  // An ALLOWLIST of exact paths, not `/portal/*`, for two reasons.
  //
  // 1. /portal/[token] is a PUBLIC client-facing door with its own
  //    share-token gate. A blanket /portal/* rule would demand a session
  //    on it and break every brand portal link already sent out. So would
  //    /portal/signup (an invited client has no session yet by
  //    definition), /portal/login and /portal/auth/callback.
  // 2. Naming the session surfaces means an unknown /portal/<something>
  //    is a token, which is the correct default — while a denylist of
  //    exemptions would silently start gating the token door the moment
  //    anyone added a route.
  //
  // These paths are also gated a second time inside
  // resolveSessionPortal(), which owns the brand-scope decision. This is
  // the cheap outer fence: it keeps a wrong-role session off the surface
  // without the page having to render first.
  //
  // The matcher below lists exactly these paths, so the public token door
  // never pays for the profiles read.
  // ------------------------------------------------------------
  const PORTAL_SESSION_PATHS = new Set([
    "/portal",
    "/portal/campaigns",
    "/portal/library",
    "/portal/review",
    "/portal/reports",
    "/portal/choose",
  ]);

  if (PORTAL_SESSION_PATHS.has(path)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/login";
      url.search = "";
      return NextResponse.redirect(url);
    }

    const { data: portalProfile } = await supabase
      .from("profiles")
      .select("access_level")
      .eq("id", user.id)
      .maybeSingle();

    const level = portalProfile?.access_level;

    // Clients live here; admin and exec may preview. Everyone else is sent
    // to their own home rather than a denial they can do nothing about.
    // exec is included deliberately — it OUTRANKS admin on the ladder, and
    // peyton@pstgm.com is exec, so an admin-only test would lock the
    // preview's main user out of it.
    const PORTAL_LEVELS = new Set(["brand", "admin", "exec"]);
    if (typeof level !== "string" || !PORTAL_LEVELS.has(level)) {
      const url = request.nextUrl.clone();
      url.search = "";
      url.pathname =
        level === "athlete"
          ? "/athlete"
          : level === "staff"
            ? "/dashboard/readiness"
            : // No profiles row, or a level nobody has taught this file
              // about. Fail closed to the public site, same as the staff
              // guard above.
              "/";
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
  matcher: [
    "/dashboard/:path*",
    "/packages/:path*",
    "/packages",
    "/board/:path*",
    "/board",
    "/login",
    "/athlete/:path*",
    // Portal SESSION surfaces only — listed one by one so /portal/[token],
    // /portal/login, /portal/auth/callback and /portal/signup stay out of
    // middleware entirely. See PORTAL_SESSION_PATHS above.
    "/portal",
    "/portal/campaigns",
    "/portal/library",
    "/portal/review",
    "/portal/reports",
    "/portal/choose",
  ],
};
