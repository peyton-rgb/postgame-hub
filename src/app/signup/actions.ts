"use server";

// ============================================================
// /signup/agent and /signup/coach write paths.
//
// Both forms collect: name, email, phone, password, organisation
// (agency / school) and role (title). Both create a Supabase Auth user
// with metadata { user_type }, the type's profile row (status 'pending'
// — Postgame reviews before access) and the profiles row at the
// app-user level, through the shared createAppUser() sequence.
//
// Returns a result object; the form routes with afterSignupPath() so the
// destination logic lives in one place. No redirect() here on purpose:
// a redirect thrown inside a transition reads as an error to the form.
// ============================================================

import { createAppUser } from "@/lib/signup/createAppUser";
import { afterSignupPath } from "@/lib/signup/afterSignup";
import {
  cleanText,
  normalizeEmail,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
  type SignupErrorCode,
} from "@/lib/signup/validation";

export type RoleSignupResult =
  | { ok: true; next: string | null }   // null → "check your email" state
  | { ok: false; error: SignupErrorCode };

function readCommon(formData: FormData) {
  return {
    fullName: cleanText(formData.get("full_name"), 120),
    email: normalizeEmail(formData.get("email")),
    phone: cleanText(formData.get("phone"), 32),
    password: String(formData.get("password") ?? ""),
    organization: cleanText(formData.get("organization"), 160),
    title: cleanText(formData.get("title"), 120),
  };
}

function validateCommon(c: ReturnType<typeof readCommon>): SignupErrorCode | null {
  return (
    validateName(c.fullName) ??
    validateEmail(c.email) ??
    validatePhone(c.phone, true) ??
    validatePassword(c.password)
  );
}

export async function createAgentAccount(formData: FormData): Promise<RoleSignupResult> {
  const c = readCommon(formData);
  const problem = validateCommon(c);
  if (problem) return { ok: false, error: problem };

  const result = await createAppUser({
    type: "agent",
    fullName: c.fullName,
    email: c.email,
    password: c.password,
    profile: { phone: c.phone, agency: c.organization || null, title: c.title || null },
  });
  if (!result.ok) return result;
  return {
    ok: true,
    next: result.hasSession ? afterSignupPath({ role: "agent", userType: "agent" }) : null,
  };
}

export async function createCoachAccount(formData: FormData): Promise<RoleSignupResult> {
  const c = readCommon(formData);
  const problem = validateCommon(c);
  if (problem) return { ok: false, error: problem };

  const result = await createAppUser({
    type: "coach",
    fullName: c.fullName,
    email: c.email,
    password: c.password,
    profile: { phone: c.phone, school: c.organization || null, title: c.title || null },
  });
  if (!result.ok) return result;
  return {
    ok: true,
    next: result.hasSession ? afterSignupPath({ role: "coach", userType: "coach" }) : null,
  };
}
