// src/lib/collab-containers.ts
// ─────────────────────────────────────────────────────────────
// Read/write helpers for collab_containers + their membership.
// A container is the persistent identity of a team folder's collab
// post. Media assigned to it is stored as media.drive_file_id =
// 'collab:<container.id>' with athlete_id = NULL.
// ─────────────────────────────────────────────────────────────

import type { createBrowserSupabase } from "@/lib/supabase";
import type { TeamFolderMatch } from "@/lib/team-folders";

type SupabaseClient = ReturnType<typeof createBrowserSupabase>;

export interface CollabContainer {
  id: string;
  campaign_id: string;
  team_name: string;
  school: string | null;
  sport: string | null;
  drive_folder_id: string | null;
  platform: string | null;
  post_url: string | null;
  source: string;
  created_at: string;
}

export interface DetectedTeam extends TeamFolderMatch {
  folderId: string;
  teamName: string;
}

/**
 * Ensure a collab container exists for a detected team folder, plus a
 * membership row for each team athlete. Idempotent via the unique
 * (campaign_id, drive_folder_id) and (container_id, athlete_id)
 * constraints. Returns the container row.
 *
 * NOTE: the membership upsert only sends the key columns, so an existing
 * row's `included` flag (a prior uncheck) is preserved.
 */
export async function ensureTeamContainer(
  supabase: SupabaseClient,
  recapId: string,
  team: DetectedTeam,
): Promise<CollabContainer | null> {
  const { data: container, error } = await supabase
    .from("collab_containers")
    .upsert(
      {
        campaign_id: recapId,
        team_name: team.teamName,
        school: team.school,
        sport: team.sport,
        drive_folder_id: team.folderId,
        source: "auto",
      },
      { onConflict: "campaign_id,drive_folder_id" },
    )
    .select()
    .single();

  if (error || !container) return null;

  const rows = team.athletes.map((a) => ({
    container_id: container.id,
    athlete_id: a.id,
  }));
  if (rows.length) {
    await supabase
      .from("collab_container_athletes")
      .upsert(rows, { onConflict: "container_id,athlete_id" });
  }

  return container as CollabContainer;
}

/** Load all containers for a recap (used by the picker + recap render later). */
export async function loadContainers(
  supabase: SupabaseClient,
  recapId: string,
): Promise<CollabContainer[]> {
  const { data } = await supabase
    .from("collab_containers")
    .select("*")
    .eq("campaign_id", recapId);
  return (data || []) as CollabContainer[];
}
