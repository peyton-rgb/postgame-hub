// ============================================================
// Staff auth helpers
//
// Staff = any logged-in profile whose role is NOT 'athlete' (campaign_manager,
// admin, brand_relations, social_media_manager). Used to gate the manager-side
// athlete-deal review views and APIs.
// ============================================================

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";

// For server components/pages: redirect non-staff away.
export async function requireStaff(): Promise<{ id: string; role: string }> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .single();

  if (error || !profile) redirect("/login");
  if (profile.role === "athlete") redirect("/athlete");
  return { id: profile.id, role: profile.role };
}

// For API routes: returns the staff user id, or null if not staff.
export async function getStaffUser(): Promise<{ id: string; role: string } | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "athlete") return null;
  return { id: profile.id, role: profile.role };
}
