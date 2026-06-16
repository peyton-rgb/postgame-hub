// ============================================================
// Athlete auth helpers (server-side)
//
// Shared gate for the /athlete app. Uses the cookie-aware server client so
// it can tell WHO is logged in, then loads their profile row. Staff and
// anonymous visitors are bounced out of the athlete experience.
// ============================================================

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";

export type AthleteProfile = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  paypal_linked: boolean;
  paypal_email: string | null;
  ig_handle: string | null;
  tiktok_handle: string | null;
  school: string | null;
  sport: string | null;
  onboarded_at: string | null;
};

// Returns the logged-in athlete's profile, or redirects:
//   - not logged in        → /athlete/login
//   - logged in but staff  → /dashboard (they belong in the staff Hub)
export async function requireAthlete(): Promise<AthleteProfile> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/athlete/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id,email,full_name,display_name,avatar_url,role,paypal_linked,paypal_email,ig_handle,tiktok_handle,school,sport,onboarded_at"
    )
    .eq("id", user.id)
    .single();

  // If the profile row is missing or the read failed, treat as unauthenticated.
  if (error || !profile) redirect("/athlete/login");

  if (profile.role !== "athlete") redirect("/dashboard");

  return profile as AthleteProfile;
}
