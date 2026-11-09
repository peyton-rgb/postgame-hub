// ============================================================
// GET /api/carousels/[slug]/layout   (staff only)
//
// One athlete's saved carousel: the layout (as carried over from the old
// artifact, migration 100) plus, for every media key it uses, the media's
// size/kind and short-lived signed links into the private `carousels` bucket.
// Read-only.
// ============================================================

import { NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
const LINK_SECONDS = 60 * 60 * 6; // links outlive a long editing session

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const staff = await getHubStaff();
  if (!staff.ok) return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const supabase = createLiveServiceSupabase();
  const { data: row, error } = await supabase
    .from("carousel_layouts")
    .select("slug, layout, saved_at, updated_at")
    .eq("slug", params.slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ layout: null, media: {} });

  const keys = Array.from(new Set((row.layout.layers ?? []).map((l: { media?: string }) => l.media).filter(Boolean))) as string[];
  const { data: mediaRows, error: mErr } = await supabase
    .from("carousel_media")
    .select("media_key, info, files")
    .in("media_key", keys.length ? keys : ["-"]);
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // One signing call for every file path the layout needs.
  const paths = Array.from(new Set((mediaRows ?? []).flatMap((m) => Object.values(m.files as Record<string, string>))));
  const signed: Record<string, string> = {};
  if (paths.length) {
    const { data: urls, error: sErr } = await supabase.storage.from("carousels").createSignedUrls(paths, LINK_SECONDS);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed[u.path] = u.signedUrl;
  }

  const media: Record<string, unknown> = {};
  for (const m of mediaRows ?? []) {
    const f = m.files as Record<string, string>;
    const link = (k: string) => (f[k] ? signed[f[k]] ?? null : null);
    media[m.media_key] = { ...(m.info as object), hasFull: !!f.full, src: link("full") ?? link("proxy"), thumb: link("thumb"), strip: link("strip") };
  }
  return NextResponse.json({ layout: row.layout, savedAt: row.saved_at, updatedAt: row.updated_at, media });
}
