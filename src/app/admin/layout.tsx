// ============================================================
// /admin layout — access gate + shell.
//
// Gate: any signed-in staff profile (athletes bounce to /athlete,
// anonymous to /login → existing Google OAuth /authorize flow).
// Exec-only areas gate again at their own layout/page level.
//
// The Postgame wordmark is loaded from the brands table row
// (logo_light_url — light-ink mark for the dark sidebar). Never
// rendered as text (standing brand rule).
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { ADMIN_NAV, ADMIN_TABS } from "@/lib/admin/nav";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

const POSTGAME_BRAND_ID = "7a0e28e9-d62f-427d-a207-cd22596fcf50";

export const metadata = { title: "Postgame Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin("staff");

  let logoUrl: string | null = null;
  try {
    const supabase = createServiceSupabase();
    const { data } = await supabase
      .from("brands")
      .select("logo_light_url, logo_white_url, logo_primary_url")
      .eq("id", POSTGAME_BRAND_ID)
      .single();
    logoUrl = data?.logo_light_url || data?.logo_white_url || data?.logo_primary_url || null;
  } catch {
    logoUrl = null;
  }

  return (
    <AdminShell
      nav={ADMIN_NAV}
      tabs={ADMIN_TABS}
      logoUrl={logoUrl}
      userLabel={user.email ?? "Signed in"}
      accessLevel={user.accessLevel}
      accessLevelPending={user.accessLevelPending}
    >
      {children}
    </AdminShell>
  );
}
