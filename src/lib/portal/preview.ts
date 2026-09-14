// ============================================================
// Admin "view as brand" preview.
//
// Lets a Postgame admin look at the brand portal exactly as a client
// would, without holding a brand login. The preview brand is chosen in
// the APP layer and never in RLS — admins already pass every policy via
// is_staff(), so there is nothing for RLS to decide here (Phase 2 brief,
// "Admin preview").
//
// PHASE 5 NOTE — ACTOR ATTRIBUTION. No portal surface writes to the
// database yet. When approvals land, every write taken while previewing
// MUST record the ADMIN's profiles.id as the actor, never the brand
// contact whose view is being borrowed. A preview is an admin looking at
// a client's screen; it is not the admin becoming that client. Anything
// that reads "who did this" from the resolved portal brand rather than
// from the session will attribute an admin's approval to the client.
// ============================================================

import { cookies } from "next/headers";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { getAdminUser, hasLevel, type AdminUser } from "@/lib/admin/auth";

/**
 * Holds the brand an admin is previewing, so moving between portal tabs
 * keeps it. Deliberately NOT httpOnly-only-readable-by-middleware or
 * signed: it decides nothing on its own. Every read re-checks that the
 * viewer is still an admin and that the brand still exists, so a forged
 * cookie buys a non-admin exactly nothing.
 */
export const PREVIEW_COOKIE = "pg_portal_preview_brand";

export interface PreviewBrand {
  id: string;
  name: string;
  slug: string | null;
}

const BRAND_COLUMNS = "id, name, slug";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The admin behind a preview, or null.
 *
 * Gated on the ACCESS LADDER, not on a literal role string. The Phase 1
 * brief says preview "applies only when profiles.role = 'admin'", but
 * access_level is what every other gate in this repo reads, and exec
 * OUTRANKS admin on that ladder — peyton@pstgm.com is access_level
 * 'exec', role 'admin'. Testing for the literal string 'admin' on
 * access_level would lock the one person who needs this out of it, and
 * testing `role` instead would fork the auth model. hasLevel() lets both
 * admin and exec through, which is what the ladder already means
 * everywhere else.
 */
export async function getPreviewAdmin(): Promise<AdminUser | null> {
  const user = await getAdminUser();
  if (!user) return null;
  if (!hasLevel(user, "admin")) return null;
  return user;
}

/**
 * Resolve a `?brand=` value to a brand.
 *
 * Accepts a slug (`cvs`) or a uuid. The brief specifies slugs and the
 * existing switcher in PortalFrame emits ids, so both have to work or
 * one of the two entry points breaks. Shape decides the lookup; a value
 * matching neither returns null rather than guessing.
 *
 * Service client on purpose: this runs for admins choosing a brand they
 * are not attached to, so an RLS-scoped read would find nothing.
 */
export async function resolveBrandRef(ref: string): Promise<PreviewBrand | null> {
  const value = ref.trim();
  if (!value) return null;

  const svc = createLiveServiceSupabase();
  const column = UUID_RE.test(value) ? "id" : "slug";

  const { data } = await svc
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq(column, value)
    .maybeSingle();

  return (data as PreviewBrand | null) ?? null;
}

/** Non-archived brands, name-ordered, for the preview picker. */
export async function listPreviewBrands(): Promise<PreviewBrand[]> {
  const svc = createLiveServiceSupabase();
  const { data } = await svc
    .from("brands")
    .select(BRAND_COLUMNS)
    .not("archived", "is", true)
    .order("name");

  return (data as PreviewBrand[] | null) ?? [];
}

/** The brand id stored in the preview cookie, if any. */
export function readPreviewCookie(): string | null {
  return cookies().get(PREVIEW_COOKIE)?.value ?? null;
}

/**
 * Where a preview link should point for a given brand.
 *
 * Goes through the /portal/preview route handler rather than straight to
 * /portal?brand=…, because a cookie cannot be written during a page
 * render — only a route handler or server action may set one. The
 * handler sets the cookie and then redirects, so navigating to a second
 * portal tab afterwards still knows which brand is in view.
 */
export function previewHref(brand: Pick<PreviewBrand, "id" | "slug">): string {
  return `/portal/preview?brand=${encodeURIComponent(brand.slug || brand.id)}`;
}
