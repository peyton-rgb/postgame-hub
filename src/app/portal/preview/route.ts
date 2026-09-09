import { NextResponse, type NextRequest } from "next/server";
import { getPreviewAdmin, resolveBrandRef, PREVIEW_COOKIE } from "@/lib/portal/preview";

// ============================================================
// /portal/preview — starts and ends an admin "view as brand" preview.
//
// A route handler rather than a page because it exists to SET A COOKIE,
// and a cookie cannot be written during a page render. The cookie is
// what makes the preview survive navigation: without it, moving from
// /portal to /portal/campaigns would lose the chosen brand and bounce
// the admin back to the picker on every click.
//
//   GET /portal/preview?brand=cvs   -> remember CVS, go to /portal
//   GET /portal/preview?exit=1      -> forget, go back to the Hub
//
// /portal?brand=cvs still works on its own for a one-off look; it simply
// does not persist, because a page render may not write cookies.
// ============================================================

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const EXIT_TO = "/dashboard/brand-portals";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // Re-checked on every call. The cookie decides nothing by itself, so a
  // non-admin who forges one gets turned away here and again on every
  // subsequent resolve.
  const admin = await getPreviewAdmin();
  if (!admin) {
    return NextResponse.redirect(`${origin}/portal/denied`);
  }

  // ---- exit --------------------------------------------------------
  if (searchParams.get("exit")) {
    const out = NextResponse.redirect(`${origin}${EXIT_TO}`);
    out.cookies.set({ name: PREVIEW_COOKIE, value: "", path: "/", maxAge: 0 });
    return out;
  }

  // ---- enter -------------------------------------------------------
  const ref = searchParams.get("brand")?.trim();
  if (!ref) {
    return NextResponse.redirect(`${origin}/portal/choose`);
  }

  const brand = await resolveBrandRef(ref);
  if (!brand) {
    // A slug that resolves to nothing goes back to the picker rather than
    // silently showing some other brand.
    return NextResponse.redirect(`${origin}/portal/choose?error=unknown-brand`);
  }

  const out = NextResponse.redirect(`${origin}/portal`);
  out.cookies.set({
    name: PREVIEW_COOKIE,
    // The id, not the slug — a slug can be edited later, an id cannot.
    value: brand.id,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Session-length: a preview is something you are doing now, not a
    // preference. Closing the browser ends it.
  });
  return out;
}
