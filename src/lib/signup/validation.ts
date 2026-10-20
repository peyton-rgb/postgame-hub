// ============================================================
// Server-side field validation for the public sign-up forms.
//
// Every form posts to a Server Action, and the action re-validates here
// before anything touches Supabase. The browser's `required` attributes
// are a courtesy, not a guard.
//
// Returns a short error CODE, never the submitted value, so a failure can
// be shown to the person without echoing what they typed into a URL or a
// log line. Codes are mapped to copy in the form components.
// ============================================================

export type SignupErrorCode =
  | "name-required"
  | "email-invalid"
  | "phone-invalid"
  | "password-too-short"
  | "password-too-long"
  | "link-invalid"
  | "field-too-long"
  | "terms-required"
  | "already-registered"
  | "bad-credentials"
  | "rate-limited"
  | "not-set-up"
  | "signup-failed";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt limit

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanText(value: FormDataEntryValue | null, max = 120): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export function validateName(value: string): SignupErrorCode | null {
  if (value.length < 2) return "name-required";
  return null;
}

export function normalizeEmail(value: FormDataEntryValue | null): string {
  return cleanText(value, 254).toLowerCase();
}

export function validateEmail(value: string): SignupErrorCode | null {
  return EMAIL_RE.test(value) ? null : "email-invalid";
}

/** Keeps digits, +, spaces, dashes and parens; 7–20 characters. */
export function validatePhone(value: string, required: boolean): SignupErrorCode | null {
  if (!value) return required ? "phone-invalid" : null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "phone-invalid";
  if (!/^[\d\s()+.-]+$/.test(value)) return "phone-invalid";
  return null;
}

export function validatePassword(value: string): SignupErrorCode | null {
  if (value.length < PASSWORD_MIN) return "password-too-short";
  if (value.length > PASSWORD_MAX) return "password-too-long";
  return null;
}

/**
 * Instagram handle or portfolio URL. Accepts "@handle", "handle",
 * "instagram.com/handle" or any https:// link. Optional.
 */
export function validateLink(value: string): SignupErrorCode | null {
  if (!value) return null;
  if (value.length > 200) return "field-too-long";
  if (/^@?[a-z0-9._]{1,30}$/i.test(value)) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "link-invalid";
    if (!url.hostname.includes(".")) return "link-invalid";
    return null;
  } catch {
    return "link-invalid";
  }
}

export const ERROR_COPY: Record<SignupErrorCode, string> = {
  "name-required": "Enter your full name.",
  "email-invalid": "Enter a valid email address.",
  "phone-invalid": "Enter a phone number we can reach you on.",
  "password-too-short": `Use at least ${PASSWORD_MIN} characters for your password.`,
  "password-too-long": "That password is too long.",
  "link-invalid": "Enter an Instagram handle or a link that starts with https://.",
  "field-too-long": "One of the fields is too long.",
  "terms-required": "Please agree to the Terms of service and Privacy policy.",
  "already-registered": "There's already an account for that email. Sign in instead.",
  "bad-credentials": "That email and password don't match.",
  "rate-limited": "Too many attempts. Wait a minute and try again.",
  "not-set-up": "Sign-up isn't switched on yet. Email support@pstgm.com and we'll set you up.",
  "signup-failed": "Something went wrong creating your account. Please try again.",
};
