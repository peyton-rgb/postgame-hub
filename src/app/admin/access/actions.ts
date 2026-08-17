"use server";

// ============================================================
// /admin/access write paths — invite, resend, change role, revoke.
//
// Every one is a confirmed POST (ConfirmSubmit gates the submit),
// access-gated at admin+, and audit-logged. No GET mutations.
//
// All four read brand_contacts / postgame_contacts.contact_type,
// which arrive with migration 028 (UNAPPLIED). When the schema is
// missing they redirect with ?result=pending028 and write nothing —
// the honest-pending pattern from the rebuild, not a silent no-op.
//
// SCOPE: revoke sets status='revoked' as registry truth. Portal entry
// today is the brand-level brands.portal_token and is deliberately NOT
// touched here — per-contact token rotation is a future build.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import { isAttachmentRole, isContactType } from "@/lib/admin/access";

const BASE = "/admin/access";

function clean(raw: FormDataEntryValue | null): string | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  return v === "" ? null : v;
}

function backTo(result: string, extra?: Record<string, string>): never {
  const q = new URLSearchParams({ result, ...(extra ?? {}) });
  redirect(`${BASE}?${q.toString()}`);
}

/**
 * Invite a contact to a brand.
 *
 * Dedupe ruling: an email that already exists is an EXISTING HUMAN. We
 * attach that identity to the brand (a new brand_contacts row) instead of
 * creating a twin. If they are already attached to this brand we re-invite
 * that attachment rather than violating the (contact_id, brand_id) unique.
 */
export async function inviteContact(formData: FormData): Promise<void> {
  const actor = await getAdminActor("admin");
  if (!actor) redirect("/login");

  const name = clean(formData.get("name"));
  const email = clean(formData.get("email"))?.toLowerCase() ?? null;
  const brandId = clean(formData.get("brand_id"));
  const rawType = clean(formData.get("contact_type"));
  const rawRole = clean(formData.get("role"));
  const agencyName = clean(formData.get("agency_name"));

  if (!name || !email || !brandId) backTo("invite-missing-fields");

  const contactType = isContactType(rawType) ? rawType : "brand";
  const role = isAttachmentRole(rawRole) ? rawRole : "viewer";
  if (contactType === "agency" && !agencyName) backTo("invite-needs-agency");

  const supabase = createServiceSupabase();

  // 1 · Find or create the IDENTITY (dedupe by email, case-insensitive).
  const existing = await supabase
    .from("postgame_contacts")
    .select("id, name, email, contact_type, agency_name")
    .ilike("email", email)
    .maybeSingle();

  if (existing.error && isMissingSchemaError(existing.error)) backTo("pending028");

  let contactId = existing.data?.id ?? null;
  let attached: "existing-identity" | "new-identity" = "existing-identity";

  if (!contactId) {
    const created = await supabase
      .from("postgame_contacts")
      .insert({
        name,
        email,
        contact_type: contactType,
        agency_name: contactType === "agency" ? agencyName : null,
        is_active: true,
      })
      .select("id")
      .single();
    if (created.error) {
      if (isMissingSchemaError(created.error)) backTo("pending028");
      backTo("error");
    }
    contactId = created.data.id;
    attached = "new-identity";
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "contact.create",
      entity: "postgame_contacts",
      entityId: contactId,
      after: { name, email, contact_type: contactType, agency_name: agencyName },
    });
  }

  // 2 · Attach to the brand, or re-invite an attachment that already exists.
  const prior = await supabase
    .from("brand_contacts")
    .select("id, status, role")
    .eq("contact_id", contactId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (prior.error && isMissingSchemaError(prior.error)) backTo("pending028");

  const now = new Date().toISOString();

  if (prior.data) {
    const { error } = await supabase
      .from("brand_contacts")
      .update({
        status: "invited",
        role,
        invited_email: email,
        invited_at: now,
        bounced_at: null,
        bounce_reason: null,
        revoked_at: null,
        revoked_by: null,
      })
      .eq("id", prior.data.id);
    if (error) {
      if (isMissingSchemaError(error)) backTo("pending028");
      backTo("error");
    }
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "contact.invite",
      entity: "brand_contacts",
      entityId: prior.data.id,
      before: { status: prior.data.status, role: prior.data.role },
      after: { status: "invited", role, invited_email: email, reattached: true },
    });
    revalidatePath(BASE);
    backTo("invited", { dedupe: "reattached" });
  }

  const inserted = await supabase
    .from("brand_contacts")
    .insert({
      contact_id: contactId,
      brand_id: brandId,
      role,
      status: "invited",
      invited_email: email,
      invited_at: now,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (inserted.error) {
    if (isMissingSchemaError(inserted.error)) backTo("pending028");
    backTo("error");
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contact.invite",
    entity: "brand_contacts",
    entityId: inserted.data.id,
    after: {
      contact_id: contactId,
      brand_id: brandId,
      role,
      status: "invited",
      invited_email: email,
      identity: attached,
    },
  });

  revalidatePath(BASE);
  backTo("invited", { dedupe: attached });
}

/** Resend (or first-send, for an on-file contact) an invite for one attachment. */
export async function resendInvite(formData: FormData): Promise<void> {
  const actor = await getAdminActor("admin");
  if (!actor) redirect("/login");

  const attachmentId = clean(formData.get("attachment_id"));
  if (!attachmentId) backTo("error");
  // An operator can correct a bad address on the way out of a bounce.
  const overrideEmail = clean(formData.get("invited_email"))?.toLowerCase() ?? null;

  const supabase = createServiceSupabase();
  const before = await supabase
    .from("brand_contacts")
    .select("id, status, invited_email, contact_id")
    .eq("id", attachmentId)
    .maybeSingle();

  if (before.error && isMissingSchemaError(before.error)) backTo("pending028");
  if (!before.data) backTo("error");

  let target = overrideEmail ?? before.data.invited_email;
  if (!target) {
    const identity = await supabase
      .from("postgame_contacts")
      .select("email")
      .eq("id", before.data.contact_id)
      .maybeSingle();
    target = identity.data?.email ?? null;
  }
  if (!target) backTo("resend-no-email");

  const { error } = await supabase
    .from("brand_contacts")
    .update({
      status: "invited",
      invited_email: target,
      invited_at: new Date().toISOString(),
      bounced_at: null,
      bounce_reason: null,
    })
    .eq("id", attachmentId);

  if (error) {
    if (isMissingSchemaError(error)) backTo("pending028");
    backTo("error");
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contact.invite",
    entity: "brand_contacts",
    entityId: attachmentId,
    before: { status: before.data.status, invited_email: before.data.invited_email },
    after: { status: "invited", invited_email: target, resend: true },
  });

  revalidatePath(BASE);
  backTo("invited");
}

/** Change a contact's role FOR ONE BRAND. Other attachments are untouched. */
export async function changeRole(formData: FormData): Promise<void> {
  const actor = await getAdminActor("admin");
  if (!actor) redirect("/login");

  const attachmentId = clean(formData.get("attachment_id"));
  const rawRole = clean(formData.get("role"));
  if (!attachmentId || !isAttachmentRole(rawRole)) backTo("error");

  const supabase = createServiceSupabase();
  const before = await supabase
    .from("brand_contacts")
    .select("id, role")
    .eq("id", attachmentId)
    .maybeSingle();

  if (before.error && isMissingSchemaError(before.error)) backTo("pending028");
  if (!before.data) backTo("error");
  if (before.data.role === rawRole) backTo("saved");

  const { error } = await supabase
    .from("brand_contacts")
    .update({ role: rawRole })
    .eq("id", attachmentId);

  if (error) {
    if (isMissingSchemaError(error)) backTo("pending028");
    backTo("error");
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contact.role_change",
    entity: "brand_contacts",
    entityId: attachmentId,
    before: { role: before.data.role },
    after: { role: rawRole },
  });

  revalidatePath(BASE);
  backTo("saved");
}

/**
 * Revoke access for ONE brand only.
 *
 * Registry truth: sets status='revoked' with attribution. It does NOT
 * rotate brands.portal_token — today's portal entry is brand-level, so
 * there is no per-contact credential to kill. The screen says so plainly
 * rather than implying an access change that did not happen.
 */
export async function revokeAccess(formData: FormData): Promise<void> {
  const actor = await getAdminActor("admin");
  if (!actor) redirect("/login");

  const attachmentId = clean(formData.get("attachment_id"));
  if (!attachmentId) backTo("error");

  const supabase = createServiceSupabase();
  const before = await supabase
    .from("brand_contacts")
    .select("id, status, role, brand_id, contact_id")
    .eq("id", attachmentId)
    .maybeSingle();

  if (before.error && isMissingSchemaError(before.error)) backTo("pending028");
  if (!before.data) backTo("error");

  const { error } = await supabase
    .from("brand_contacts")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: actor.id,
    })
    .eq("id", attachmentId);

  if (error) {
    if (isMissingSchemaError(error)) backTo("pending028");
    backTo("error");
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contact.revoke",
    entity: "brand_contacts",
    entityId: attachmentId,
    before: { status: before.data.status, role: before.data.role },
    after: {
      status: "revoked",
      revoked_by: actor.id,
      brand_id: before.data.brand_id,
      contact_id: before.data.contact_id,
      portal_token_rotated: false,
    },
  });

  revalidatePath(BASE);
  backTo("revoked");
}
