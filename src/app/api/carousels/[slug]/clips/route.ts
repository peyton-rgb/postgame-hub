// ============================================================
// GET /api/carousels/[slug]/clips   (staff only)
//
// The carousel editor's content picker. Returns the clips this athlete may
// use — SELECTED CLIPS, anything marked Approved, and the images in their
// PHOTOS folder —
// with Frame.io's own short-lived thumbnail and play links. Read-only: it
// never changes anything in Frame.io.
// ============================================================

import { NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { frameioGet, getFrameioAccessToken } from "@/lib/frameio";
import { athletePickerClips } from "@/lib/carousel/frameio-clips";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const staff = await getHubStaff();
  if (!staff.ok) return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const supabase = createLiveServiceSupabase();
  const { data: athlete, error } = await supabase
    .from("carousel_athletes")
    .select("slug, name, frameio_root_folder_id, frameio_selected_folder_id")
    .eq("slug", params.slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!athlete) return NextResponse.json({ error: "Unknown athlete" }, { status: 404 });
  if (!athlete.frameio_selected_folder_id) {
    return NextResponse.json({ error: `${athlete.name} has no Frame.io folders linked yet` }, { status: 409 });
  }

  const { data: conn } = await supabase.from("frameio_connection").select("account_id").eq("id", 1).maybeSingle();
  if (!conn?.account_id) {
    return NextResponse.json({ error: "Frame.io is not connected — visit /api/frameio/connect" }, { status: 409 });
  }

  try {
    const token = await getFrameioAccessToken(supabase);
    // The athlete's main folder is the folder SELECTED CLIPS sits in, unless
    // one is saved explicitly.
    let rootFolderId: string | null = athlete.frameio_root_folder_id;
    if (!rootFolderId) {
      const sel = await frameioGet<{ data?: { parent_id?: string } }>(
        token,
        `/accounts/${conn.account_id}/folders/${athlete.frameio_selected_folder_id}`
      );
      rootFolderId = sel.data?.parent_id ?? null;
    }
    if (!rootFolderId) throw new Error("Could not find the athlete's main Frame.io folder");
    const clips = await athletePickerClips({
      token,
      accountId: conn.account_id,
      rootFolderId,
      selectedFolderId: athlete.frameio_selected_folder_id,
    });
    return NextResponse.json({ athlete: athlete.name, fetchedAt: new Date().toISOString(), ...clips });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[carousel-clips]", params.slug, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
