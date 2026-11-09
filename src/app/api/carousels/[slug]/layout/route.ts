// ============================================================
// GET /api/carousels/[slug]/layout   (staff only)
//
// One athlete's saved carousel: the layout (as carried over from the old
// artifact, migration 100) plus, for every media key it uses, the media's
// size/kind and short-lived signed links into the private `carousels` bucket.
//
// PUT saves a new layout. The client sends the `updatedAt` it loaded; if
// someone saved in between, the save is refused (409) rather than silently
// overwriting their work. Every save is also kept in carousel_layout_versions.
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

type LayerIn = { id?: unknown; media?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown };
function validLayout(l: unknown): l is { layers: LayerIn[] } {
  if (!l || typeof l !== "object" || !Array.isArray((l as { layers?: unknown }).layers)) return false;
  return (l as { layers: LayerIn[] }).layers.every(
    (o) => typeof o.id === "string" && ["x", "y", "w", "h"].every((k) => Number.isFinite(o[k as keyof LayerIn] as number)),
  );
}

export async function PUT(req: Request, { params }: { params: { slug: string } }) {
  const staff = await getHubStaff();
  if (!staff.ok) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !validLayout(body.layout)) return NextResponse.json({ error: "Invalid layout" }, { status: 400 });

  const supabase = createLiveServiceSupabase();
  const { data: row, error } = await supabase
    .from("carousel_layouts")
    .select("updated_at")
    .eq("slug", params.slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (row && body.baseUpdatedAt && row.updated_at !== body.baseUpdatedAt) {
    return NextResponse.json({ error: "This carousel was saved somewhere else since you opened it. Reload to get the latest.", updatedAt: row.updated_at }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: vErr } = await supabase
    .from("carousel_layout_versions")
    .insert({ slug: params.slug, layout: body.layout, saved_by: staff.id, saved_at: now });
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  const { data: saved, error: uErr } = await supabase
    .from("carousel_layouts")
    .upsert({ slug: params.slug, layout: body.layout, device: "Hub", saved_at: now, updated_at: now }, { onConflict: "slug" })
    .select("updated_at, saved_at")
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt: saved.updated_at, savedAt: saved.saved_at });
}
