// ============================================================
// Submission form detail — /dashboard/submission-forms/[id]
//
// [id] is the link TOKEN, not an id. That is what the list has always linked
// with; it is not a bug to be tidied up.
//
// Renders the same split view as the index route with this form pre-selected,
// so a deep link opens exactly the view you would have reached by clicking.
// ============================================================

import DashboardContent from "@/components/DashboardContent";
import SplitView from "@/components/submission-forms/SplitView";
import { anton } from "../fonts";

export default function SubmissionFormDetail({ params }: { params: { id: string } }) {
  return (
    <DashboardContent>
      <div className={anton.variable}>
        <SplitView initialToken={params.id} />
      </div>
    </DashboardContent>
  );
}
