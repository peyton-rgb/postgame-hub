// ============================================================
// POST /api/campaign-briefs/[id]/publish
// Publishes a draft brief. This triggers three side effects:
//   1. Creates a linked campaign record in brand_campaigns
//   2. Creates the Drive folder structure
//   3. Sends a Slack notification
//
// IMPORTANT: If a side effect fails, the brief STILL publishes.
// Failures are returned in the response so the user can retry.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createDriveFolders } from '@/lib/services/drive';
import { sendSlackNotification } from '@/lib/services/slack';

export const runtime = 'nodejs';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: brief, error: fetchError } = await supabase
    .from('campaign_briefs')
    .select('*, brand:brands(id, name, drive_parent_folder_id)')
    .eq('id', params.id)
    .single();

  if (fetchError || !brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  }

  if (brief.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft briefs can be published' },
      { status: 400 }
    );
  }

  const sideEffects = {
    campaign: { success: false, error: null as string | null },
    drive: { success: false, error: null as string | null, warning: null as string | null },
    slack: { success: false, error: null as string | null },
  };

  // --- Side effect 1: Create the campaign record ---
  let campaignId: string | null = null;
  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('brand_campaigns')
      .insert({
        brand_id: brief.brand_id,
        name: brief.name,
        status: 'active',
        budget: brief.budget || 0,
        has_brief: true,
        production_config: brief.production_config,
        shoot_date: brief.start_date,
        settings: { source: 'creative_brain', brief_id: brief.id },
      })
      .select('id')
      .single();

    if (campaignError) throw campaignError;
    campaignId = campaign.id;
    sideEffects.campaign.success = true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error creating campaign';
    console.error('Failed to create campaign record:', message);
    sideEffects.campaign.error = message;
  }

  // --- Side effect 2: Create Drive folder structure ---
  let driveFolderId: string | null = null;
  try {
    const brand = brief.brand as { drive_parent_folder_id?: string | null; name?: string } | null;
    const brandDriveParent = brand?.drive_parent_folder_id;

    if (!brandDriveParent) {
      sideEffects.drive.warning = "Brand has no Drive parent folder set. You'll need to link one manually.";
      sideEffects.drive.success = true;
    } else {
      const dateStr = brief.start_date
        ? new Date(brief.start_date).toISOString().slice(0, 7).replace('-', '')
        : new Date().toISOString().slice(0, 7).replace('-', '');
      const folderName = `${String(brief.name).replace(/[^a-zA-Z0-9_\- ]/g, '')}_${dateStr}`;

      driveFolderId = await createDriveFolders(brandDriveParent, folderName);
      sideEffects.drive.success = true;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error creating Drive folders';
    console.error('Failed to create Drive folders:', message);
    sideEffects.drive.error = message;
  }

  // --- Side effect 3: Slack notification ---
  try {
    const brand = brief.brand as { name?: string } | null;
    await sendSlackNotification({
      briefName: brief.name,
      brandName: brand?.name || 'Unknown brand',
      publishedBy: user.email || 'Unknown user',
    });
    sideEffects.slack.success = true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error sending Slack notification';
    console.error('Failed to send Slack notification:', message);
    sideEffects.slack.error = message;
  }

  const updatePayload: Record<string, unknown> = {
    status: 'published',
  };
  if (campaignId) updatePayload.campaign_id = campaignId;
  if (driveFolderId) updatePayload.drive_folder_id = driveFolderId;

  const { data: publishedBrief, error: updateError } = await supabase
    .from('campaign_briefs')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error publishing campaign brief:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    brief: publishedBrief,
    sideEffects,
  });
}
