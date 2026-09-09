// ============================================================
// The SESSION door onto the brand portal.
//
// getPortalBrand(token) in lib/portal-data.ts is the token door:
// token -> brand, or 404. This is its counterpart: signed-in viewer ->
// brand, or bounced. Both hand the same shape to the same components,
// which is what makes /portal and /portal/{token} one room rather than
// two.
//
// NAME NOTE: the Phase 1 brief asks for a helper called
// getPortalBrand(session). That name is already taken by the TOKEN
// resolver with a different signature, so this file keeps the name it
// has and grows the admin path instead. One resolver, two kinds of
// viewer — which is the property the brief actually wanted, so that
// preview and real sessions can never drift apart.
//
// TWO KINDS OF VIEWER REACH /portal:
//   brand user  — scope from their own attachments, ?brand= constrained
//                 to those. Cannot see anyone else's brand, ever.
//   admin       — previewing. No attachments; the brand comes from the
//                 URL or the preview cookie, and any brand is fair game
//                 because admins already read every brand via is_staff().
//
// The gate lives here, not in the shared body components — whoever
// resolves the brand owns the entitlement decision.
// ============================================================

import { redirect } from "next/navigation";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { getBrandSession, type BrandScopeEntry } from "@/lib/portal/brand-session";
import { attachPortalLogo, type PortalBrand } from "@/lib/portal-data";
import {
  getPreviewAdmin,
  readPreviewCookie,
  resolveBrandRef,
} from "@/lib/portal/preview";
import type { PortalSessionChrome, PortalPreviewChrome } from "@/components/portal/PortalFrame";

export interface SessionPortal {
  brand: PortalBrand;
  chrome: PortalSessionChrome;
  /** The attachment in view. Null when an admin is previewing — they hold none. */
  active: BrandScopeEntry | null;
  /** Set only for an admin preview; drives the banner. Null for real clients. */
  preview: PortalPreviewChrome | null;
}

/** Where "Switch brand" and "Exit preview" in the banner point. */
export const PREVIEW_SWITCH_HREF = "/portal/choose";
export const PREVIEW_EXIT_HREF = "/portal/preview?exit=1";

/**
 * Resolve which brand the current viewer is looking at.
 *
 * Redirects (never returns null) so every caller is gated identically:
 *   not signed in            -> /login
 *   athlete                  -> /athlete
 *   brand login, no reach    -> /portal/denied
 *   admin, no brand chosen   -> /portal/choose
 *   anything else            -> /portal/denied
 */
export async function resolveSessionPortal(
  requestedBrand?: string
): Promise<SessionPortal> {
  const session = await getBrandSession();

  // ---- brand user -------------------------------------------------
  if (session) {
    if (session.schemaPending || session.brands.length === 0) redirect("/portal/denied");

    const active = await pickAttachment(session.brands, requestedBrand);

    const brand = await loadBrand(active.brandId);
    if (!brand) redirect("/portal/denied");

    return {
      brand,
      active,
      preview: null,
      chrome: {
        personLabel: session.contactName || session.email || "Signed in",
        roleLabel: active.role === "approver" ? "Approver" : "Viewer",
        brands: session.brands.map((b) => ({ brandId: b.brandId, brandName: b.brandName })),
        activeBrandId: active.brandId,
      },
    };
  }

  // ---- admin preview ----------------------------------------------
  const admin = await getPreviewAdmin();
  if (admin) {
    // URL wins over the cookie, so a pasted /portal?brand=cvs shows CVS
    // even when the cookie holds something else.
    const ref = requestedBrand?.trim() || readPreviewCookie();
    if (!ref) redirect(PREVIEW_SWITCH_HREF);

    const chosen = await resolveBrandRef(ref);
    // A stale cookie (brand deleted, slug changed) or a bad slug sends
    // them to the picker rather than rendering an arbitrary brand.
    if (!chosen) redirect(PREVIEW_SWITCH_HREF);

    const brand = await loadBrand(chosen.id);
    if (!brand) redirect(PREVIEW_SWITCH_HREF);

    return {
      brand,
      active: null,
      preview: {
        adminLabel: admin.email ?? "Postgame admin",
        brandName: chosen.name,
        switchHref: PREVIEW_SWITCH_HREF,
        exitHref: PREVIEW_EXIT_HREF,
      },
      chrome: {
        personLabel: admin.email ?? "Postgame admin",
        roleLabel: "Admin preview",
        // Deliberately ONLY the active brand, not all 132. PortalFrame
        // renders one pill per entry, so handing it every brand would
        // paper the header with 132 pills. The banner's "Switch brand"
        // is the admin's switcher; the pills stay a client-only control
        // for the rare contact attached to two or three brands.
        brands: [{ brandId: chosen.id, brandName: chosen.name }],
        activeBrandId: chosen.id,
      },
    };
  }

  // ---- everyone else ----------------------------------------------
  // getBrandSession() returns null for anonymous, athlete and staff
  // alike, so ask who they are before choosing where to send them.
  // /login would loop for a signed-in non-admin staff user.
  const who = await getAdminUserSafe();
  if (!who) redirect("/login");
  if (who === "athlete") redirect("/athlete");
  redirect("/portal/denied");
}

/**
 * Which of a brand user's attachments is in view.
 *
 * `?brand=` is NOT trusted: a brand they are not attached to falls back
 * to their first, rather than rendering it. That is the whole point of
 * resolving scope server-side, and it is what makes
 * `/portal?brand=<someone-else>` a no-op for a client.
 *
 * Accepts a slug as well as an id, to match the admin entry point. An id
 * is checked against their scope directly; only a non-id value costs a
 * lookup, and the result is still intersected with their scope, so slug
 * support widens the vocabulary and not the reach.
 */
async function pickAttachment(
  brands: BrandScopeEntry[],
  requested?: string
): Promise<BrandScopeEntry> {
  const ref = requested?.trim();
  if (!ref) return brands[0];

  const byId = brands.find((b) => b.brandId === ref);
  if (byId) return byId;

  const resolved = await resolveBrandRef(ref);
  if (!resolved) return brands[0];

  return brands.find((b) => b.brandId === resolved.id) ?? brands[0];
}

/**
 * The whole brands row for the shared body components (logos, name, and
 * whatever else the design reads), same as the token door fetches.
 */
async function loadBrand(brandId: string): Promise<PortalBrand | null> {
  const svc = createLiveServiceSupabase();
  const { data } = await svc.from("brands").select("*").eq("id", brandId).maybeSingle();
  if (!data) return null;
  // Same resolution as the token door — this door fetches its own row,
  // so without this the signed-in portal would still be on legacy columns.
  return attachPortalLogo(data as PortalBrand);
}

/**
 * Coarse "who is this" for the bounce decision only. Kept local and
 * deliberately narrow: it exists so a signed-in athlete or staff user
 * lands somewhere sensible instead of looping on /login.
 */
async function getAdminUserSafe(): Promise<"athlete" | "staff" | null> {
  const { getAdminUser } = await import("@/lib/admin/auth");
  const user = await getAdminUser();
  if (!user) return null;
  return user.accessLevel === "athlete" ? "athlete" : "staff";
}
