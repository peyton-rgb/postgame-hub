// ============================================================
// Pitches Page — /dashboard/pitches
//
// Restores the pitch list under the unified sidebar's "Pitches"
// tab. Renders the existing PitchList component (New Pitch flow,
// Brand / Athlete split, delete, etc.) inside the standard
// dashboard content wrapper so it matches the other pages
// (Recaps, etc.).
//
// PitchList uses useSearchParams (for its All / Brand / Athlete
// filter), so in the App Router it must sit inside a <Suspense>
// boundary — otherwise the build fails.
// ============================================================

import { Suspense } from "react";
import DashboardContent from "@/components/DashboardContent";
import PitchList from "@/components/PitchList";

export default function PitchesPage() {
  return (
    <DashboardContent>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
            Loading pitch pages...
          </div>
        }
      >
        <PitchList />
      </Suspense>
    </DashboardContent>
  );
}
