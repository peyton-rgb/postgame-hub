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
import { INVITE_TTL_DAYS, resolveBrandLogo, sendInviteEmail } from "@/lib/admin/invite-email";

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
 * Send the invite email for one attachment and settle its status.
 *
 * The status ladder is honest about delivery: an attachment only reaches
 * `invited` if a mail actually went out. If the send fails it is left at
 * whatever it was before (`on_file` for a brand-new attachment) with
 * invite_send_error set, so the row shows "send failed — resend" rather
 * than implying a mail is on its way that nobody will ever receive.
 *
 * Pre-029 the token columns do not exist. Rather than fail the whole
 * invite, we record the attachment as `invited` with no email and report
 * emailSent:false / reason 'pending029' — the pre-029 behaviour, plus an
 * honest label. Never throws.
 */
async function deliverInvite(opts: {
  supabase: ReturnType<typeof createServiceSupabase>;
  attachmentId: string;
  brandId: string;
  contactName: string;
  toEmail: string;
  role: "approver" | "viewer";
  /** status to fall back to if the send fails */
  priorStatus: string;
  invitesSchemaReady: boolean;
}): Promise<{ emailSent: boolean; reason: string | null; status: string }> {
  const { supabase, attachmentId, brandId, contactName, toEmail, role, priorStatus } = opts;
  const now = new Date();

  if (!opts.invitesSchemaReady) {
    await supabase
      .from("brand_contacts")
      .update({ status: "invited", invited_at: now.toISOString() })
      .eq("id", attachmentId);
    return { emailSent: false, reason: "pending029", status: "invited" };
  }

  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [{ data: brand }, { data: attachment }] = await Promise.all([
    supabase
      .from("brands")
      .select("name, logo_primary_url, logo_light_url, logo_white_url, logo_mark_url, logo_url")
      .eq("id", brandId)
      .maybeSingle(),
    supabase.from("brand_contacts").select("invite_token").eq("id", attachmentId).maybeSingle(),
  ]);

  const token = (attachment as { invite_token?: string } | null)?.invite_token ?? null;
  if (!token) {
    await supabase
      .from("brand_contacts")
      .update({
        status: priorStatus,
        invite_send_error: "no invite token on this attachment",
        invite_last_attempt_at: now.toISOString(),
      })
      .eq("id", attachmentId);
    return { emailSent: false, reason: "no-token", status: priorStatus };
  }

  const result = await sendInviteEmail({
    toEmail,
    contactName,
    brandName: brand?.name ?? "your brand",
    brandLogoUrl: brand ? resolveBrandLogo(brand) : null,
    roleLabel: role === "approver" ? "Approver" : "Viewer",
    signupUrl: `${siteUrl()}/portal/signup?token=${token}`,
    expiresAt,
  });

  if (result.sent) {
    await supabase
      .from("brand_contacts")
      .update({
        status: "invited",
        invited_at: now.toISOString(),
        invite_expires_at: expiresAt.toISOString(),
        invite_send_error: null,
        invite_last_attempt_at: now.toISOString(),
      })
      .eq("id", attachmentId);
    return { emailSent: true, reason: null, status: "invited" };
  }

  await supabase
    .from("brand_contacts")
    .update({
      status: priorStatus,
      invite_send_error: result.error ?? "send failed",
      invite_last_attempt_at: now.toISOString(),
    })
    .eq("id", attachmentId);
  return { emailSent: false, reason: result.error ?? "send failed", status: priorStatus };
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app").replace(/\/$/, "");
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
    // Clear the revoke and set the role, but leave the STATUS to
    // deliverInvite — it only becomes `invited` if a mail goes out.
    const { error } = await supabase
      .from("brand_contacts")
      .update({ role, invited_email: email, revoked_at: null, revoked_by: null })
      .eq("id", prior.data.id);
    if (error) backTo("error");

    const delivery = await deliverInvite({
      supabase,
      attachmentId: prior.data.id,
      brandId,
      contactName: existing.data?.name ?? name,
      toEmail: email,
      role,
      priorStatus: prior.data.status === "revoked" ? "on_file" : prior.data.status,
      invitesSchemaReady: schema.invites,
    });

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
          status: delivery.status,
          invited_email: email,
        },
        reattached: true,
        email_sent: delivery.emailSent,
        email_error: delivery.reason,
      },
    });

    revalidatePath(BASE);
    backTo(delivery.emailSent ? "invited" : "invite-not-emailed", { dedupe: "reattached" });
  }

  // Inserted at on_file, NOT invited: the row must not claim an invite is
  // in flight until deliverInvite() has actually put one there.
  const inserted = await supabase
    .from("brand_contacts")
    .insert({
      contact_id: contactId,
      brand_id: brandId,
      role,
      status: "on_file",
      invited_email: email,
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

  const delivery = await deliverInvite({
    supabase,
    attachmentId: inserted.data.id,
    brandId,
    contactName: name,
    toEmail: email,
    role,
    priorStatus: "on_file",
    invitesSchemaReady: schema.invites,
  });

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
        status: delivery.status,
        invited_email: email,
      },
      email_sent: delivery.emailSent,
      email_error: delivery.reason,
    },
  });

  revalidatePath(BASE);
  backTo(delivery.emailSent ? "invited" : "invite-not-emailed", {
    dedupe: identityWasCreated ? "new-identity" : "existing-identity",
  });
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
    .select("id, status, role, brand_id, invited_email, contact_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (before.error || !before.data) backTo("error");

  const identity = await supabase
    .from("postgame_contacts")
    .select("name, email")
    .eq("id", before.data.contact_id)
    .maybeSingle();

  const target = overrideEmail ?? before.data.invited_email ?? identity.data?.email ?? null;
  if (!target) backTo("resend-no-email");

  const { error } = await supabase
    .from("brand_contacts")
    .update({ invited_email: target, revoked_at: null, revoked_by: null })
    .eq("id", attachmentId);
  if (error) backTo("error");

  const delivery = await deliverInvite({
    supabase,
    attachmentId,
    brandId: before.data.brand_id,
    contactName: identity.data?.name ?? "there",
    toEmail: target,
    role: isAttachmentRole(before.data.role) ? before.data.role : "viewer",
    priorStatus: before.data.status === "revoked" ? "on_file" : before.data.status,
    invitesSchemaReady: schema.invites,
  });

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "contact.invite",
    entity: "brand_contacts",
    entityId: attachmentId,
    before: { status: before.data.status, invited_email: before.data.invited_email },
    after: {
      status: delivery.status,
      invited_email: target,
      resend: true,
      email_sent: delivery.emailSent,
      email_error: delivery.reason,
    },
  });

  revalidatePath(BASE);
  backTo(delivery.emailSent ? "invited" : "invite-not-emailed");
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
