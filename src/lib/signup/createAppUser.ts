// ============================================================
// createAppUser() — one guarded path for every self-service app sign-up
// that is NOT an athlete (videographer, coach, agent). Athletes keep the
// existing /athlete/signup flow.
//
// Sequence (order matters — nothing is left half-made):
//   1. per-IP rate limit (best-effort, in-memory; see src/lib/rate-limit)
//   2. Supabase Auth sign-up with user metadata { user_type, full_name }.
//      Uses the cookie-WRITING action client so a session (when the project
//      does not require email confirmation) actually reaches the browser.
//      The handle_new_user() trigger (migration 085) reads user_type and
//      creates the profiles row with role = type, access_level = 'athlete'.
//   3. the type's own profile row (videographer_profiles / coach_profiles /
//      agent_profiles) via the service role — RLS has no client insert.
//   4. belt-and-braces upsert of profiles.role / access_level, in case
//      the trigger body on this database predates 085.
//   If 3 or 4 fail the auth user is deleted again, so a retry on the same
//   address works and no login exists without its profile.
//
// Never logs the email, the password or any field the person typed.
// Returns short error codes; the form maps them to copy.
// ============================================================

import { headers } from "next/headers";
import { createActionSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { isMissingSchemaError } from "@/lib/admin/auth";
import { rateLimit } from "@/lib/rate-limit";
import type { AppUserType } from "@/lib/signup/types";
import type { SignupErrorCode } from "@/lib/signup/validation";

export type NonAthleteType = Extract<AppUserType, "videographer" | "coach" | "agent">;

const PROFILE_TABLE: Record<NonAthleteType, string> = {
  videographer: "videographer_profiles",
  coach: "coach_profiles",
  agent: "agent_profiles",
};

/**
 * Every app user type is stored at the 'athlete' access level — the floor
 * of the ladder in src/lib/admin/auth.ts. That file falls back to
 * profiles.role for any level it does not recognise, and maps unknown
 * roles to 'staff', so a dedicated 'app' level cannot be introduced
 * without changing auth.ts first. See migration 085's header.
 */
const APP_ACCESS_LEVEL = "athlete";

export interface CreateAppUserInput {
  type: NonAthleteType;
  fullName: string;
  email: string;
  password: string;
  /** Columns for the type's profile table (already validated + cleaned). */
  profile: Record<string, string | null>;
}

export type CreateAppUserResult =
  | { ok: true; userId: string; hasSession: boolean }
  | { ok: false; error: SignupErrorCode };

function clientKey(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return ip;
}

export function signupRateLimited(scope: string): boolean {
  // 6 attempts per 10 minutes per address — generous for a human, a wall
  // for a script. Per-process only; the real guard is Supabase Auth's own
  // limits plus email confirmation.
  return !rateLimit(`signup:${scope}:${clientKey()}`, 6, 10 * 60 * 1000);
}

export async function createAppUser(input: CreateAppUserInput): Promise<CreateAppUserResult> {
  const { type, fullName, email, password, profile } = input;

  if (signupRateLimited(type)) return { ok: false, error: "rate-limited" };

  // 2 · auth user (anon client → respects the project's email-confirmation
  //     setting, exactly like /athlete/signup does from the browser)
  const supabase = createActionSupabase();
  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: { data: { user_type: type, full_name: fullName } },
  });

  if (signUp.error) {
    if (/already|registered|exists/i.test(signUp.error.message)) {
      return { ok: false, error: "already-registered" };
    }
    console.error(`[signup:${type}] auth sign-up failed: ${signUp.error.message}`);
    return { ok: false, error: "signup-failed" };
  }

  const user = signUp.data.user;
  if (!user) return { ok: false, error: "signup-failed" };

  // With email confirmation on, Supabase answers a duplicate address with
  // a user object that has NO identities instead of an error (so the form
  // cannot be used to probe who has an account). Treat it the same way.
  if (Array.isArray(user.identities) && user.identities.length === 0) {
    return { ok: false, error: "already-registered" };
  }

  const svc = createServiceSupabase();

  // 3 · the type's profile row
  const inserted = await svc
    .from(PROFILE_TABLE[type])
    .insert({ auth_user_id: user.id, full_name: fullName, email, ...profile })
    .select("id")
    .maybeSingle();

  if (inserted.error) {
    await svc.auth.admin.deleteUser(user.id);
    if (isMissingSchemaError(inserted.error)) {
      console.error(`[signup:${type}] ${PROFILE_TABLE[type]} is missing — apply migration 085`);
      return { ok: false, error: "not-set-up" };
    }
    console.error(`[signup:${type}] profile insert failed: ${inserted.error.message}`);
    return { ok: false, error: "signup-failed" };
  }

  // 4 · profiles row at the app-user level (the trigger normally did this)
  const profiles = await svc
    .from("profiles")
    .upsert(
      { id: user.id, email, full_name: fullName, role: type, access_level: APP_ACCESS_LEVEL },
      { onConflict: "id" }
    )
    .select("id")
    .maybeSingle();

  if (profiles.error) {
    await svc.from(PROFILE_TABLE[type]).delete().eq("auth_user_id", user.id);
    await svc.auth.admin.deleteUser(user.id);
    console.error(`[signup:${type}] profiles upsert failed: ${profiles.error.message}`);
    return { ok: false, error: "signup-failed" };
  }

  return { ok: true, userId: user.id, hasSession: !!signUp.data.session };
}

/**
 * Email + password sign-in for the public sign-up surfaces ("I already have
 * one"). Writes the session cookie. Returns the profile's role so the
 * caller can route with afterSignup().
 */
export async function signInWithPasswordAction(
  scope: string,
  email: string,
  password: string
): Promise<{ ok: true; userId: string; role: string | null } | { ok: false; error: SignupErrorCode }> {
  if (signupRateLimited(`signin:${scope}`)) return { ok: false, error: "rate-limited" };

  const supabase = createActionSupabase();
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.user) return { ok: false, error: "bad-credentials" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", signIn.data.user.id)
    .maybeSingle();

  return { ok: true, userId: signIn.data.user.id, role: profile?.role ?? null };
}
