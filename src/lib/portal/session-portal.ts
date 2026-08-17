// ============================================================
// The SESSION door onto the brand portal.
//
// getPortalBrand(token) is the token door: token -> brand, or 404.
// This is its counterpart: signed-in brand user -> brand, or bounced.
// Both hand the same shape to the same components, which is what makes
// /portal and /portal/{token} one room rather than two.
//
// The gate lives here, not in the shared body components — whoever
// resolves the brand owns the entitlement decision.
// ============================================================

import { redirect } from "next/navigation";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { getBrandSession, type BrandScopeEntry } from "@/lib/portal/brand-session";
import type { PortalBrand } from "@/lib/portal-data";
import type { PortalSessionChrome } from "@/components/portal/PortalFrame";

export interface SessionPortal {
  brand: PortalBrand;
  chrome: PortalSessionChrome;
  active: BrandScopeEntry;
}

/**
 * Resolve which brand a signed-in client is looking at.
 *
 * `?brand=` selects among their attachments and is NOT trusted: an id
 * they are not attached to falls back to their first brand rather than
 * rendering it. That is the whole point of resolving scope server-side.
 *
 * Redirects (never returns null) so every caller is gated identically:
 *   not a brand login      -> /login
 *   brand login, no reach  -> /portal/denied
 */
export async function resolveSessionPortal(
  requestedBrandId?: string
): Promise<SessionPortal> {
  const session = await getBrandSession();
  if (!session) redirect("/login");
  if (session.schemaPending || session.brands.length === 0) redirect("/portal/denied");

  const active =
    session.brands.find((b) => b.brandId === requestedBrandId) ?? session.brands[0];

  // The shared portal body needs the whole brands row (logos, name, and
  // whatever else the design reads), same as the token door fetches.
  const svc = createLiveServiceSupabase();
  const { data: brand } = await svc
    .from("brands")
    .select("*")
    .eq("id", active.brandId)
    .single();

  // Scope said they can reach it but the row is gone — treat as no reach
  // rather than rendering a half-empty portal.
  if (!brand) redirect("/portal/denied");

  return {
    brand: brand as PortalBrand,
    active,
    chrome: {
      personLabel: session.contactName || session.email || "Signed in",
      roleLabel: active.role === "approver" ? "Approver" : "Viewer",
      brands: session.brands.map((b) => ({ brandId: b.brandId, brandName: b.brandName })),
      activeBrandId: active.brandId,
    },
  };
}
