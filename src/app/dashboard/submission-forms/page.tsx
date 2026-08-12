// ============================================================
// Submission Forms — /dashboard/submission-forms
//
// The split layout: campaign list on the left, full detail on the right.
// This route selects the first form; [id] selects a specific one. Both render
// the same component, so there is one implementation of the view and nothing
// to keep in sync between them.
//
// The four metric cards and the flat list this replaced are gone, along with
// the ••• menu — which means the broken "Regenerate link" action goes with
// them rather than being carried across.
// ============================================================

import DashboardContent from "@/components/DashboardContent";
import SplitView from "@/components/submission-forms/SplitView";
import { anton } from "./fonts";

export default function SubmissionFormsPage() {
  return (
    <DashboardContent>
      {/* Anton is loaded per-route, not globally — see ./fonts.ts */}
      <div className={anton.variable}>
        <SplitView />
      </div>
    </DashboardContent>
  );
}
