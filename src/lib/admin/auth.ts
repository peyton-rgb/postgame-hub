// ============================================================
// Admin access-level ladder — exec > admin > staff > athlete
//
// Reads profiles.access_level (arrives with migration 022,
// 20260817_022_admin_access_levels.sql — UNAPPLIED as of tonight).
//
// Graceful pre-migration behavior: if the column doesn't exist yet
// (Postgres error 42703), we fall back to the legacy `role` column:
//   role 'admin'   -> 'admin'
//   role 'athlete' -> 'athlete'  (bounced out of /admin entirely)
//   anything else  -> 'staff'
// Nobody is 'exec' until the migration lands, so exec-only screens
// render their honest "pending migration" lock instead of content.
// ============================================================

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";

export type AccessLevel = "exec" | "admin" | "staff" | "athlete";

const RANK: Record<AccessLevel, number> = {
  exec: 3,
  admin: 2,
  staff: 1,
  athlete: 0,
};

export interface AdminUser {
  id: string;
  email: string | null;
  role: string;
  accessLevel: AccessLevel;
  /** true while migration 022 is unapplied and we're on the role fallback */
  accessLevelPending: boolean;
}

function roleFallback(role: string): AccessLevel {
  if (role === "admin") return "admin";
  if (role === "athlete") return "athlete";
  return "staff";
}

/** Column-missing errors from PostgREST (undefined_column / undefined_table). */
export function isMissingSchemaError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "42P01") return true;
  // PostgREST sometimes reports missing columns as PGRST204 or in message text
  return /column|relation|does not exist|schema cache/i.test(error.message ?? "");
}

/** Fetch the signed-in admin user, or null (no redirect). */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Try the post-migration shape first.
  const withLevel = await supabase
    .from("profiles")
    .select("id,email,role,access_level")
    .eq("id", user.id)
    .single();

  if (!withLevel.error && withLevel.data) {
    const level = (withLevel.data as { access_level?: string }).access_level;
    const role = withLevel.data.role ?? "staff";
    const accessLevel: AccessLevel =
      level === "exec" || level === "admin" || level === "staff" || level === "athlete"
        ? level
        : roleFallback(role);
    return {
      id: withLevel.data.id,
      email: withLevel.data.email,
      role,
      accessLevel,
      accessLevelPending: false,
    };
  }

  if (!isMissingSchemaError(withLevel.error)) return null;

  // Pre-migration fallback: no access_level column yet.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("id", user.id)
    .single();
  if (error || !profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role ?? "staff",
    accessLevel: roleFallback(profile.role ?? "staff"),
    accessLevelPending: true,
  };
}

/**
 * Page gate: require at least `min` on the ladder or redirect away.
 * Athletes never see /admin; unauthenticated users go to /login
 * (the existing Google OAuth flow via /authorize — reused, not rebuilt).
 */
export async function requireAdmin(min: AccessLevel = "staff"): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/login");
  if (user.accessLevel === "athlete") redirect("/athlete");
  if (RANK[user.accessLevel] < RANK[min]) redirect("/admin");
  return user;
}

/** API/server-action gate: returns null instead of redirecting. */
export async function getAdminActor(min: AccessLevel = "staff"): Promise<AdminUser | null> {
  const user = await getAdminUser();
  if (!user) return null;
  if (user.accessLevel === "athlete") return null;
  if (RANK[user.accessLevel] < RANK[min]) return null;
  return user;
}

export function hasLevel(user: AdminUser, min: AccessLevel): boolean {
  return RANK[user.accessLevel] >= RANK[min];
}
