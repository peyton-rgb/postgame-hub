// ============================================================
// Athlete App — authenticated tab-bar group
//
// Every page in this group requires a logged-in athlete (requireAthlete
// redirects otherwise) and renders the bottom tab bar. Athletes who have
// not finished profile setup are routed to onboarding first.
// ============================================================

import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/athlete-auth";
import AthleteTabBar from "@/components/athlete/AthleteTabBar";

export default async function AthleteAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAthlete();

  // First-run gate: unfinished profile → onboarding (which lives outside
  // this group so it renders without the tab bar).
  if (!profile.onboarded_at) redirect("/athlete/onboarding");

  return (
    <>
      <div className="a-content">{children}</div>
      <AthleteTabBar />
    </>
  );
}
