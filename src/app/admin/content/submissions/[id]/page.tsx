// ============================================================
// /admin/content/submissions/[id] — Campaign submission detail
// Matches prototype screen S["submission-campaign"].
// Displays campaign-level submission overview with Athletes /
// Videographers / Settings tabs.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadCampaign } from "@/lib/admin/campaigns/queries";
import { loadCampaignSubmission } from "@/lib/admin/submissions/queries";
import { ErrorNote, PageHeader } from "@/components/admin/ui";
import { CampaignSubmissionDetail } from "@/components/admin/submissions/CampaignSubmissionDetail";
import type { SubmissionTab } from "@/lib/admin/submissions/types";

export const dynamic = "force-dynamic";

interface CampaignSubmissionPageProps {
  params: { id: string };
  searchParams: { tab?: string };
}

export default async function CampaignSubmissionPage({
  params,
  searchParams,
}: CampaignSubmissionPageProps) {
  await requireAdmin("staff");

  const campaignId = Number(params.id);
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Content submission" />
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
        <PageHeader title="Content submission" />
        <ErrorNote message={campError ? `Could not load campaign: ${campError}` : "Campaign not found."} />
        <Link href="/admin/content/submissions" className="text-xs text-[#D73F09] hover:underline">
          ← Back to submission forms
        </Link>
      </div>
    );
  }

  const tab = (searchParams.tab === "videographers" || searchParams.tab === "settings"
    ? searchParams.tab
    : "athletes") as SubmissionTab;

  return (
    <CampaignSubmissionDetail
      campaignId={campaignId}
      campaignName={bundle.campaign.campaign_name || "Untitled Campaign"}
      brandName={bundle.brand?.name ?? null}
      submission={submission}
      initialTab={tab}
    />
  );
}
