// ============================================================
// Invite token validation — the one place that decides whether a
// /portal/signup link is good.
//
// Both the page (to decide what to render) and the action (to decide
// whether to write) call this. They must never diverge: a page that
// shows a form for a token the action will reject is a dead end with
// extra steps.
// ============================================================

import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { isMissingSchemaError } from "@/lib/admin/auth";
import { isAllowlisted } from "@/lib/portal/brand-session";

export type InviteFailure =
  | "not-found"
  | "expired"
  | "already-active"
  | "revoked"
  | "not-in-pilot"
  | "pending029";

export type InviteCheck =
  | {
      ok: true;
      attachmentId: string;
      contactId: string;
      contactName: string;
      brandId: string;
      brandName: string;
      brandLogoUrl: string | null;
      email: string;
      role: "approver" | "viewer";
      expiresAt: string | null;
    }
  | { ok: false; reason: InviteFailure };

export async function validateInviteToken(token: string): Promise<InviteCheck> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, reason: "not-found" };

  // Uncached on purpose: this read decides whether a signup page is
  // handed out at all, so a revoked or expired invite must never be
  // answered from Next's Data Cache.
  const svc = createLiveServiceSupabase();
  const res = await svc
    .from("brand_contacts")
    .select(
      "id, contact_id, brand_id, role, status, invited_email, invite_expires_at, " +
        "postgame_contacts(name, email), " +
        "brands(name, logo_primary_url, logo_dark_url, logo_light_url, logo_white_url)"
    )
    .eq("invite_token", token)
    .maybeSingle();

  if (res.error) {
    // 029 not applied — the column does not exist. Say so honestly
    // rather than telling the client their link is invalid.
    if (isMissingSchemaError(res.error)) return { ok: false, reason: "pending029" };
    return { ok: false, reason: "not-found" };
  }
  if (!res.data) return { ok: false, reason: "not-found" };

  const row = res.data as unknown as {
    id: string;
    contact_id: string;
    brand_id: string;
    role: string | null;
    status: string | null;
    invited_email: string | null;
    invite_expires_at: string | null;
    postgame_contacts: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null;
    brands: BrandJoin | BrandJoin[] | null;
  };

  if (row.status === "revoked") return { ok: false, reason: "revoked" };
  if (row.status === "active") return { ok: false, reason: "already-active" };

  if (row.invite_expires_at && new Date(row.invite_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const contact = Array.isArray(row.postgame_contacts) ? row.postgame_contacts[0] : row.postgame_contacts;
  const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
  const brandName = brand?.name ?? "";

  // Pilot gate lives here too, not just in the session: an invite to a
  // brand outside the allowlist must not be redeemable at all.
  if (!brandName || !isAllowlisted(brandName)) return { ok: false, reason: "not-in-pilot" };

  // The invited address is the source of truth — that is the address the
  // link was actually mailed to, and the one a bounce-recovery resend
  // corrects. The contact's own email is only a fallback, and `||` rather
  // than `??` so a blank invited_email falls through instead of resolving
  // to an empty address.
  const email = (row.invited_email?.trim() || contact?.email?.trim() || "").toLowerCase();
  if (!email) return { ok: false, reason: "not-found" };

  return {
    ok: true,
    attachmentId: row.id,
    contactId: row.contact_id,
    contactName: contact?.name ?? "",
    brandId: row.brand_id,
    brandName,
    brandLogoUrl:
      brand?.logo_primary_url ||
      brand?.logo_dark_url ||
      brand?.logo_light_url ||
      brand?.logo_white_url ||
      null,
    email,
    role: row.role === "approver" ? "approver" : "viewer",
    expiresAt: row.invite_expires_at,
  };
}

interface BrandJoin {
  name: string | null;
  logo_primary_url?: string | null;
  logo_dark_url?: string | null;
  logo_light_url?: string | null;
  logo_white_url?: string | null;
}

export const INVITE_FAILURE_COPY: Record<InviteFailure, { title: string; body: string }> = {
  "not-found": {
    title: "This link isn't valid",
    body: "We couldn't find an invite for this link. It may have been replaced by a newer one — ask your Postgame contact to resend it.",
  },
  expired: {
    title: "This link has expired",
    body: "Invite links last 14 days. Ask your Postgame contact to resend it and you'll get a fresh one.",
  },
  "already-active": {
    title: "You've already set this up",
    body: "This invite has been used and your login is active. Sign in with your email and password.",
  },
  revoked: {
    title: "This access has been withdrawn",
    body: "This invite is no longer active. If you think that's a mistake, ask your Postgame contact.",
  },
  "not-in-pilot": {
    title: "Not open yet",
    body: "Client logins are rolling out brand by brand and this one isn't switched on yet. Your Postgame contact can tell you when it is.",
  },
  pending029: {
    title: "Not quite ready",
    body: "Client logins aren't switched on in this environment yet. Ask your Postgame contact to try again shortly.",
  },
};
