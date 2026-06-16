// ============================================================
// Athlete profile setup (mockup screen 13)
//
// Lives outside the (app) tab-bar group so it renders full-screen with no
// tabs. Requires a logged-in athlete; pre-fills anything already on file so
// it doubles as "edit profile".
// ============================================================

import { requireAthlete } from "@/lib/athlete-auth";
import OnboardingForm from "@/components/athlete/OnboardingForm";

export const metadata = { title: "Set up your profile — Postgame" };

export default async function OnboardingPage() {
  const profile = await requireAthlete();
  return <OnboardingForm profile={profile} />;
}
