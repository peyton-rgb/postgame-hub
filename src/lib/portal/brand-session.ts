// ============================================================
// Brand-user session scope.
//
// A brand login carries NO brand ids of its own. Scope is resolved on
// every request:
//
//     auth user -> profiles.id
//                -> postgame_contacts.profile_id   (the identity)
//                -> brand_contacts where status='active'   (the reach)
//
// Resolving live is what makes revoke real: the moment an attachment
// stops being `active`, the next request no longer sees that brand. A
// brand id baked into a cookie or JWT claim would survive the revoke,
// which is exactly the bug this shape avoids.
//
// PILOT GATE: BRAND_ALLOWLIST restricts brand logins to 7-Eleven until
// Peyton widens it. A contact attached to a brand outside the list is
// treated as having no scope — they see the denied page, not a portal.
// ============================================================

import { cache } from "react";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { isMissingSchemaError, type AccessLevel } from "@/lib/admin/auth";

/**
 * Brands a client login may reach during the pilot. Names, resolved to
 * ids at query time, so this stays readable and survives a reseed.
 * Empty array = no allowlist (everyone through) — deliberately NOT the
 * default while piloting.
 */
export const BRAND_ALLOWLIST: string[] = ["7-Eleven"];

export interface BrandScopeEntry {
  attachmentId: string;
  brandId: string;
  brandName: string;
  brandLogoUrl: string | null;
  role: "approver" | "viewer";
}

export interface BrandSession {
  profileId: string;
  email: string | null;
  contactId: string;
  contactName: string;
  /** Every brand this human can currently reach. Never empty when ok. */
  brands: BrandScopeEntry[];
  /** True when 029 is not applied yet — nothing can be resolved. */
  schemaPending: boolean;
}

/**
 * Resolve the signed-in brand user, or null if this session is not a
 * brand login (staff, athlete, anonymous). Memoised per request.
 */
export const getBrandSession = cache(async (): Promise<BrandSession | null> => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await supabase
    .from("profiles")
    .select("id, email, access_level")
    .eq("id", user.id)
    .maybeSingle();
  if (profile.error || !profile.data) return null;

  const level = (profile.data as { access_level?: AccessLevel }).access_level;
  if (level !== "brand") return null;

  // Service client from here: a brand user has no RLS grant to read the
  // junction, and the scope query is the thing deciding their access.
  const svc = createServiceSupabase();

  const contact = await svc
    .from("postgame_contacts")
    .select("id, name")
    .eq("profile_id", profile.data.id)
    .maybeSingle();

  if (contact.error && isMissingSchemaError(contact.error)) {
    return {
      profileId: profile.data.id,
      email: profile.data.email,
      contactId: "",
      contactName: "",
      brands: [],
      schemaPending: true,
    };
  }
  if (!contact.data) {
    // A brand-level login with no identity behind it can reach nothing.
    return {
      profileId: profile.data.id,
      email: profile.data.email,
      contactId: "",
      contactName: profile.data.email ?? "",
      brands: [],
      schemaPending: false,
    };
  }

  const attachments = await svc
    .from("brand_contacts")
    .select(
      "id, brand_id, role, status, brands(name, logo_primary_url, logo_dark_url, logo_light_url, logo_white_url)"
    )
    .eq("contact_id", contact.data.id)
    .eq("status", "active");

  const rows = (attachments.data ?? []) as Array<{
    id: string;
    brand_id: string;
    role: string | null;
    brands: BrandJoin | BrandJoin[] | null;
  }>;

  const brands: BrandScopeEntry[] = rows
    .map((r) => {
      const b = Array.isArray(r.brands) ? r.brands[0] : r.brands;
      return {
        attachmentId: r.id,
        brandId: r.brand_id,
        brandName: b?.name ?? "",
        brandLogoUrl: pickLogo(b),
        role: (r.role === "approver" ? "approver" : "viewer") as "approver" | "viewer",
      };
    })
    .filter((b) => b.brandName && isAllowlisted(b.brandName));

  return {
    profileId: profile.data.id,
    email: profile.data.email,
    contactId: contact.data.id,
    contactName: contact.data.name ?? profile.data.email ?? "",
    brands,
    schemaPending: false,
  };
});

interface BrandJoin {
  name: string | null;
  logo_primary_url?: string | null;
  logo_dark_url?: string | null;
  logo_light_url?: string | null;
  logo_white_url?: string | null;
}

function pickLogo(b: BrandJoin | null | undefined): string | null {
  return b?.logo_primary_url || b?.logo_dark_url || b?.logo_light_url || b?.logo_white_url || null;
}

export function isAllowlisted(brandName: string): boolean {
  if (BRAND_ALLOWLIST.length === 0) return true;
  return BRAND_ALLOWLIST.some((n) => n.toLowerCase() === brandName.toLowerCase());
}

/** Can this session reach that brand right now? */
export function canReachBrand(session: BrandSession | null, brandId: string): boolean {
  return Boolean(session?.brands.some((b) => b.brandId === brandId));
}
