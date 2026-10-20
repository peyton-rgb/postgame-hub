// ============================================================
// /admin/content/submissions/[id]/edit — Form editor page
// Matches prototype screen S["submission-edit"].
// Form editor with App / Mobile web / Desktop web live previews.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadCampaign } from "@/lib/admin/campaigns/queries";
import { loadCampaignSubmission } from "@/lib/admin/submissions/queries";
import { ErrorNote, PageHeader } from "@/components/admin/ui";
import { SubmissionFormEditor } from "@/components/admin/submissions/SubmissionFormEditor";

export const dynamic = "force-dynamic";

interface EditSubmissionFormPageProps {
  params: { id: string };
}

export default async function EditSubmissionFormPage({ params }: EditSubmissionFormPageProps) {
  await requireAdmin("staff");

  const campaignId = Number(params.id);
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Edit submission form" />
        <ErrorNote message="Invalid campaign id." />
        <Link href="/admin/content/submissions" className="text-xs text-[#D73F09] hover:underline">
          ← Back to submission forms
        </Link>
      </div>
    );
  }

  const supabase = createServiceSupabase();
  const [{ bundle, error: campError }, submission] = await Promise.all([
    loadCampaign(supabase, campaignId),
    loadCampaignSubmission(supabase, campaignId),
  ]);

  if (campError || !bundle) {
    return (
      <div className="space-y-4">
        <PageHeader title="Edit submission form" />
        <ErrorNote message={campError ? `Could not load campaign: ${campError}` : "Campaign not found."} />
        <Link href="/admin/content/submissions" className="text-xs text-[#D73F09] hover:underline">
          ← Back to submission forms
        </Link>
      </div>
    );
  }

  return (
    <SubmissionFormEditor
      campaignId={campaignId}
      campaignName={bundle.campaign.campaign_name || "Untitled Campaign"}
      brandName={bundle.brand?.name ?? null}
      form={submission.form}
      pending087={submission.pending087}
      athleteLink={submission.athleteLink}
      lucidPath={submission.lucidPath}
    />
  );
}
