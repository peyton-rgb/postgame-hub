"use server";

// ============================================================
// /admin/access write paths — invite, resend, change role, revoke.
//
// Every one is a confirmed POST (ConfirmSubmit gates the submit),
// access-gated at admin+, and audit-logged. No GET mutations.
//
// GUARD FIRST, THEN WRITE. Each action probes the live schema before
// touching anything (see @/lib/admin/access-schema). If 028 is not
// reachable the action refuses having written NOTHING — no identity,
// no audit row — so the "nothing was written" banner is always true.
// An earlier version probed implicitly, mid-sequence, and could create
// the identity and its audit entry before discovering it could not
// create the attachment: a half-write behind a banner that denied it.
//
// supabase-js has no client-side transaction, so invite compensates
// instead: if the attachment insert fails after we created the identity
// in the same call, that identity is deleted again. A partial can never
// be left behind claiming success.
//
// SCOPE: revoke sets status='revoked' as registry truth. Portal entry
// today is the brand-level brands.portal_token and is deliberately NOT
// touched here — per-contact token rotation is a future build.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import { getAccessSchemaState } from "@/lib/admin/access-schema";
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
 * Invite a contact to a brand — one unit of work.
 *
 * Dedupe ruling: an email we already know is an EXISTING HUMAN. We attach
 * that identity to the brand (a new brand_contacts row) instead of making
 * a twin. Already attached to this brand → that attachment is re-invited,
 * which is also what the (contact_id, brand_id) unique constraint requires.
 *
 * Emits exactly ONE audit row: contact.invite, carrying both the identity
 * and the attachment in after_state. contact.create is reserved for a
 * create-without-invite path; this submit is a single logical action.
 */
export async function inviteContact(formData: FormData): Promise<void> {
  const actor = await getAdminActor("admin");
  if (!actor) redirect("/login");

  // ---- guard before anything is written ----
  const schema = await getAccessSchemaState();
  if (!schema.ready) backTo("pending028");

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
  const now = new Date().toISOString();

  // ---- 1 · resolve the identity (dedupe by lower(email)) ----
  const existing = await supabase
    .from("postgame_contacts")
    .select("id, name, email, contact_type, agency_name")
    .ilike("email", email)
    .maybeSingle();
  if (existing.error) backTo("error");

  let contactId = existing.data?.id ?? null;
  const identityWasCreated = !contactId;

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
    if (created.error || !created.data) backTo("error");
    contactId = created.data.id;
  }

  // ---- 2 · attach to the brand ----
  // A brand-new identity cannot already have an attachment, so only look
  // for a prior one when we reused an existing human.
  const prior = identityWasCreated
    ? null
    : await supabase
        .from("brand_contacts")
        .select("id, status, role")
        .eq("contact_id", contactId)
        .eq("brand_id", brandId)
        .maybeSingle();

  if (prior?.error) backTo("error");

  if (prior?.data) {
    const { error } = await supabase
      .from("brand_contacts")
      .update({
        status: "invited",
        role,
        invited_email: email,
        invited_at: now,
        revoked_at: null,
        revoked_by: null,
      })
      .eq("id", prior.data.id);
    if (error) backTo("error");

    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "contact.invite",
      entity: "brand_contacts",
      entityId: prior.data.id,
      before: { status: prior.data.status, role: prior.data.role },
      after: {
        identity: { id: contactId, email, created: false },
        attachment: {
          id: prior.data.id,
          brand_id: brandId,
          role,
          status: "invited",
          invited_email: email,
          invited_at: now,
        },
        reattached: true,
      },
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
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    // Compensate: an identity we minted moments ago must not survive as an
    // orphan just because the attachment failed. Pre-existing identities
    // are left alone — they were not ours to remove.
    if (identityWasCreated && contactId) {
      await supabase.from("postgame_contacts").delete().eq("id", contactId);
    }
    backTo("error");
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contact.invite",
    entity: "brand_contacts",
    entityId: inserted.data.id,
    after: {
      identity: {
        id: contactId,
        name,
        email,
        contact_type: contactType,
        agency_name: contactType === "agency" ? agencyName : null,
        created: identityWasCreated,
      },
      attachment: {
        id: inserted.data.id,
        brand_id: brandId,
        role,
        status: "invited",
        invited_email: email,
        invited_at: now,
      },
    },
  });

  revalidatePath(BASE);
  backTo("invited", { dedupe: identityWasCreated ? "new-identity" : "existing-identity" });
}

/** Resend (or first-send, for an on-file contact) an invite for one attachment. */
export async function resendInvite(formData: FormData): Promise<void> {
  const actor = await getAdminActor("admin");
  if (!actor) redirect("/login");

  const schema = await getAccessSchemaState();
  if (!schema.attachments) backTo("pending028");

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
  if (before.error || !before.data) backTo("error");

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
      revoked_at: null,
      revoked_by: null,
    })
    .eq("id", attachmentId);
  if (error) backTo("error");

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

  const schema = await getAccessSchemaState();
  if (!schema.attachments) backTo("pending028");

  const attachmentId = clean(formData.get("attachment_id"));
  const rawRole = clean(formData.get("role"));
  if (!attachmentId || !isAttachmentRole(rawRole)) backTo("error");

  const supabase = createServiceSupabase();
  const before = await supabase
    .from("brand_contacts")
    .select("id, role")
    .eq("id", attachmentId)
    .maybeSingle();
  if (before.error || !before.data) backTo("error");
  if (before.data.role === rawRole) backTo("saved");

  const { error } = await supabase
    .from("brand_contacts")
    .update({ role: rawRole })
    .eq("id", attachmentId);
  if (error) backTo("error");

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

  const schema = await getAccessSchemaState();
  if (!schema.attachments) backTo("pending028");

  const attachmentId = clean(formData.get("attachment_id"));
  if (!attachmentId) backTo("error");

  const supabase = createServiceSupabase();
  const before = await supabase
    .from("brand_contacts")
    .select("id, status, role, brand_id, contact_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (before.error || !before.data) backTo("error");

  const { error } = await supabase
    .from("brand_contacts")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: actor.id,
    })
    .eq("id", attachmentId);
  if (error) backTo("error");

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
