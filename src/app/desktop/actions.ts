"use server";

// ============================================================
// /desktop write paths — the videographer sign-up card.
//
//   createVideographerAccount  Step 1 of 2: validate, create the auth
//                              user + videographer_profiles row, come
//                              back with "show Step 2" (or "check your
//                              email" when the project requires
//                              confirmation).
//   signInForDownload          "I already have one": email + password
//                              sign-in, then Step 2.
//
// Both return a small result object instead of redirecting, so the card
// can swap steps in place and nothing the person typed ever lands in a
// URL. Validation + error codes live in src/lib/signup/validation.ts;
// the account sequence in src/lib/signup/createAppUser.ts.
// ============================================================

import { createAppUser, signInWithPasswordAction } from "@/lib/signup/createAppUser";
import {
  cleanText,
  normalizeEmail,
  validateEmail,
  validateLink,
  validateName,
  validatePassword,
  validatePhone,
  type SignupErrorCode,
} from "@/lib/signup/validation";

export type DesktopSignupResult =
  | { ok: true; step: "download" | "confirm-email" }
  | { ok: false; error: SignupErrorCode };

export async function createVideographerAccount(formData: FormData): Promise<DesktopSignupResult> {
  const fullName = cleanText(formData.get("full_name"), 120);
  const email = normalizeEmail(formData.get("email"));
  const phone = cleanText(formData.get("phone"), 32);
  const password = String(formData.get("password") ?? "");
  const link = cleanText(formData.get("instagram_or_portfolio"), 200);
  const city = cleanText(formData.get("city"), 120);
  const gear = cleanText(formData.get("gear"), 300);
  const agreed = formData.get("agree") === "on";

  const problem =
    validateName(fullName) ??
    validateEmail(email) ??
    validatePhone(phone, true) ??
    validatePassword(password) ??
    validateLink(link) ??
    (agreed ? null : ("terms-required" as const));
  if (problem) return { ok: false, error: problem };

  const result = await createAppUser({
    type: "videographer",
    fullName,
    email,
    password,
    profile: {
      phone,
      instagram_or_portfolio: link || null,
      city: city || null,
      gear: gear || null,
      signup_source: "web",
    },
  });

  if (!result.ok) return result;
  return { ok: true, step: result.hasSession ? "download" : "confirm-email" };
}

export async function signInForDownload(formData: FormData): Promise<DesktopSignupResult> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (validateEmail(email) || !password) return { ok: false, error: "bad-credentials" };

  const result = await signInWithPasswordAction("desktop", email, password);
  if (!result.ok) return result;
  return { ok: true, step: "download" };
}
