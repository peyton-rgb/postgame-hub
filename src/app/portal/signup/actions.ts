"use server";

// ============================================================
// /portal/signup write path.
//
// Turns an invite token into a real login, in one guarded sequence:
//   1. re-validate the token server-side (never trust the page's read)
//   2. create the Supabase auth user
//   3. create/point the profiles row at access_level='brand'
//   4. link postgame_contacts.profile_id  (identity <-> login)
//   5. flip the attachment invited -> active, stamp activated_at
//   6. audit contact.activate
//   7. sign them in and land on the brand home
//
// ORDER MATTERS. The attachment is flipped LAST: if anything earlier
// fails, the invite is still pending and the link still works. The
// reverse order would burn the token on a half-finished signup and lock
// the client out with no way back except an admin resend.
// ============================================================

import { redirect } from "next/navigation";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { logAdminAction } from "@/lib/admin/audit";
import { validateInviteToken } from "@/lib/portal/invite-token";

function back(token: string, error: string): never {
  redirect(`/portal/signup?token=${encodeURIComponent(token)}&error=${error}`);
}

export async function completeSignup(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!token) redirect("/portal/signup");

  if (password.length < 10) back(token, "password-too-short");
  if (password !== confirm) back(token, "password-mismatch");

  // 1 · re-validate server-side
  const invite = await validateInviteToken(token);
  if (!invite.ok) back(token, invite.reason);

  const svc = createServiceSupabase();

  // 2 · auth user
  const created = await svc.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });

  if (created.error || !created.data.user) {
    // An address that already has a login goes down the "sign in to
    // accept" path instead — one human, one login.
    if (/already|registered|exists/i.test(created.error?.message ?? "")) {
      back(token, "already-registered");
    }
    back(token, "signup-failed");
  }

  const userId = created.data.user.id;

  // 3 · profile at brand level
  const profile = await svc
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: invite.email,
        role: "brand",
        access_level: "brand",
      },
      { onConflict: "id" }
    )
    .select("id")
    .maybeSingle();

  if (profile.error) {
    // Roll the auth user back — a login with no profile can do nothing
    // and would block a retry on the same address.
    await svc.auth.admin.deleteUser(userId);
    back(token, "profile-failed");
  }

  // 4 · identity <-> login
  const linked = await svc
    .from("postgame_contacts")
    .update({ profile_id: userId })
    .eq("id", invite.contactId);
  if (linked.error) {
    await svc.auth.admin.deleteUser(userId);
    back(token, "link-failed");
  }

  // 5 · attachment invited -> active (last, on purpose)
  const activated = await svc
    .from("brand_contacts")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      signup_email: invite.email,
      invite_send_error: null,
    })
    .eq("id", invite.attachmentId);
  if (activated.error) {
    await svc.from("postgame_contacts").update({ profile_id: null }).eq("id", invite.contactId);
    await svc.auth.admin.deleteUser(userId);
    back(token, "activate-failed");
  }

  // 6 · audit
  await logAdminAction({
    actorId: userId,
    actorEmail: invite.email,
    action: "contact.activate",
    entity: "brand_contacts",
    entityId: invite.attachmentId,
    before: { status: "invited" },
    after: {
      status: "active",
      profile_id: userId,
      contact_id: invite.contactId,
      brand_id: invite.brandId,
      self_service: true,
    },
  });

  // 7 · sign in
  const supabase = createServerSupabase();
  const signIn = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (signIn.error) redirect("/login?activated=1");

  redirect("/portal");
}

/**
 * Existing-account path: the address already has a login, so we do not
 * create a second one. Signing in accepts the invite and links the new
 * attachment to the identity that is already there.
 */
export async function acceptWithExistingLogin(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!token) redirect("/portal/signup");

  const invite = await validateInviteToken(token);
  if (!invite.ok) back(token, invite.reason);

  const supabase = createServerSupabase();
  const signIn = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (signIn.error || !signIn.data.user) back(token, "bad-credentials");

  const userId = signIn.data.user.id;
  const svc = createServiceSupabase();

  // Point the identity at this login if it is not already, then accept.
  await svc.from("postgame_contacts").update({ profile_id: userId }).eq("id", invite.contactId);

  const activated = await svc
    .from("brand_contacts")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      signup_email: invite.email,
      invite_send_error: null,
    })
    .eq("id", invite.attachmentId);
  if (activated.error) back(token, "activate-failed");

  await logAdminAction({
    actorId: userId,
    actorEmail: invite.email,
    action: "contact.activate",
    entity: "brand_contacts",
    entityId: invite.attachmentId,
    before: { status: "invited" },
    after: {
      status: "active",
      profile_id: userId,
      brand_id: invite.brandId,
      existing_login: true,
    },
  });

  redirect("/portal");
}
