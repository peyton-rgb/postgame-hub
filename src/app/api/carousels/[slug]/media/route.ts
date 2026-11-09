// ============================================================
// POST /api/carousels/[slug]/media   (staff only)   body: { fioId }
//
// Adds a Frame.io clip to the media this athlete's carousel can use. The
// picker rule is enforced here too, not just in the browser: the file must be
// in the athlete's SELECTED CLIPS folder or marked Approved in their folder.
// Records the clip in carousel_media as `fio_<id>` (nothing is copied out of
// Frame.io) and returns it with fresh play/thumbnail links.
// ============================================================

import { NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { frameioGet, getFrameioAccessToken } from "@/lib/frameio";
import { athletePickerClips } from "@/lib/carousel/frameio-clips";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const staff = await getHubStaff();
  if (!staff.ok) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const { fioId } = (await req.json().catch(() => ({}))) as { fioId?: string };
  if (!fioId || !/^[0-9a-f-]{36}$/i.test(fioId)) return NextResponse.json({ error: "Missing clip" }, { status: 400 });

  const supabase = createLiveServiceSupabase();
  const { data: athlete } = await supabase
    .from("carousel_athletes")
    .select("slug, frameio_root_folder_id, frameio_selected_folder_id")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!athlete?.frameio_selected_folder_id) return NextResponse.json({ error: "This athlete has no Frame.io folders linked" }, { status: 409 });
  const { data: conn } = await supabase.from("frameio_connection").select("account_id").eq("id", 1).maybeSingle();
  if (!conn?.account_id) return NextResponse.json({ error: "Frame.io is not connected" }, { status: 409 });

  try {
    const token = await getFrameioAccessToken(supabase);
    let rootFolderId: string | null = athlete.frameio_root_folder_id;
    if (!rootFolderId) {
      const sel = await frameioGet<{ data?: { parent_id?: string } }>(token, `/accounts/${conn.account_id}/folders/${athlete.frameio_selected_folder_id}`);
      rootFolderId = sel.data?.parent_id ?? null;
    }
    if (!rootFolderId) throw new Error("Could not find the athlete's main Frame.io folder");
    const { selected, approvedElsewhere } = await athletePickerClips({
      token, accountId: conn.account_id, rootFolderId, selectedFolderId: athlete.frameio_selected_folder_id,
    });
    const clip = [...selected, ...approvedElsewhere].find((c) => c.id === fioId);
    if (!clip) return NextResponse.json({ error: "That clip isn't in SELECTED CLIPS or marked Approved" }, { status: 403 });
    if (clip.kind === "video" ? !clip.play : !clip.thumb) return NextResponse.json({ error: "Frame.io can't play that file" }, { status: 422 });

    const key = `fio_${clip.id}`;
    const info = {
      kind: clip.kind, w: clip.width ?? 1920, h: clip.height ?? 1080,
      ...(clip.kind === "video" ? { dur: clip.duration ?? 6, in0: 0 } : {}),
      label: clip.name, athlete: params.slug, source: "frameio", fio_id: clip.id,
    };
    const { error } = await supabase.from("carousel_media").upsert({ media_key: key, info, files: {} }, { onConflict: "media_key" });
    if (error) throw new Error(error.message);
    return NextResponse.json({
      key,
      media: { ...info, hasFull: clip.kind === "video", stream: clip.kind === "video" ? "hls" : null,
        src: clip.kind === "video" ? clip.play : clip.thumb, thumb: clip.thumb, strip: null },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[carousel-media]", params.slug, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
