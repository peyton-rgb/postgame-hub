// ============================================================
// afterSignup() — where a freshly created (or freshly signed-in) user goes.
//
//   athletes (current / former) → /athlete/onboarding
//   videographers               → /desktop?step=download  (Step 2 of 2)
//   coaches / agents            → /signup/done  (Postgame reviews first)
//   brand users                 → /portal  (their own home; /portal/choose
//                                  is the ADMIN "view as brand" picker and
//                                  sends non-admins to /portal/denied)
//   staff                       → /admin
//
// Pure function: takes what we know about the user, returns a path. The
// caller does the redirect, so this works from a Server Action, a route
// handler or a page.
//
// Inputs come from the profiles row first (role / access_level — the
// trusted source) and user metadata second (user_type — what they ASKED
// for at sign-up, which only matters for telling current from former
// athletes, where both land in the same place anyway).
// ============================================================

import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAppUserType, type AppUserType } from "@/lib/signup/types";

export interface AfterSignupInput {
  /** profiles.role — 'athlete' | 'videographer' | 'coach' | 'agent' | 'brand' | staff job functions */
  role?: string | null;
  /** profiles.access_level */
  accessLevel?: string | null;
  /** auth user metadata user_type, if present */
  userType?: string | null;
}

export const SIGNUP_DESTINATIONS = {
  athlete: "/athlete/onboarding",
  videographer: "/desktop?step=download",
  review: "/signup/done",
  brand: "/portal",
  staff: "/admin",
  /** nothing recognisable — the public site, never a role we can't infer */
  unknown: "/",
} as const;

const STAFF_LEVELS = new Set(["exec", "admin", "staff"]);

export function afterSignupPath(input: AfterSignupInput): string {
  const role = input.role ?? "";
  const level = input.accessLevel ?? "";
  const type = isAppUserType(input.userType) ? (input.userType as AppUserType) : null;

  // Trusted columns first.
  if (level === "brand" || role === "brand") return SIGNUP_DESTINATIONS.brand;
  if (STAFF_LEVELS.has(level)) return SIGNUP_DESTINATIONS.staff;

  if (role === "videographer") return SIGNUP_DESTINATIONS.videographer;
  if (role === "coach" || role === "agent") return SIGNUP_DESTINATIONS.review;
  if (role === "athlete") return SIGNUP_DESTINATIONS.athlete;

  // No profile yet (email confirmation pending, or the trigger has not run):
  // fall back to what they asked for.
  if (type === "videographer") return SIGNUP_DESTINATIONS.videographer;
  if (type === "coach" || type === "agent") return SIGNUP_DESTINATIONS.review;
  if (type === "current_athlete" || type === "former_athlete") return SIGNUP_DESTINATIONS.athlete;

  return SIGNUP_DESTINATIONS.unknown;
}

/**
 * Convenience for Server Actions that already hold the auth user: reads
 * the profiles row through the cookie-aware client (RLS: own row) and
 * resolves the path.
 */
export async function afterSignupPathFor(user: User): Promise<string> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("role, access_level")
    .eq("id", user.id)
    .maybeSingle();

  const meta = (user.user_metadata ?? {}) as { user_type?: unknown };
  return afterSignupPath({
    role: data?.role ?? null,
    accessLevel: (data as { access_level?: string } | null)?.access_level ?? null,
    userType: typeof meta.user_type === "string" ? meta.user_type : null,
  });
}
