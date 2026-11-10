// ============================================================
// GET /api/carousels/[slug]/profile   (staff only)
//
// The athlete's Instagram profile details for the carousel preview video:
// handle, name, blue check, counts, bio lines, profile photo and recent feed
// photos (small data URIs). `profile: null` when none is captured yet.
//
// PUT saves them (staff only) — used when a profile or feed is (re)captured.
// The feed photos are the athlete's own posts: internal review use only.
// ============================================================

import { NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const COLS = "slug, handle, display_name, verified, followers, following, posts, bio, avatar, grid, captured_at, updated_at";
const DATA_URI = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const staff = await getHubStaff();
  if (!staff.ok) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const { data, error } = await createLiveServiceSupabase()
    .from("carousel_ig_profiles").select(COLS).eq("slug", params.slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data ?? null });
}

type BioLine = { t: string; k?: "" | "cat" | "link" };
type ProfileIn = {
  handle?: unknown; display_name?: unknown; verified?: unknown; followers?: unknown; following?: unknown;
  posts?: unknown; bio?: unknown; avatar?: unknown; grid?: unknown;
};

export async function PUT(req: Request, { params }: { params: { slug: string } }) {
  const staff = await getHubStaff();
  if (!staff.ok) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as ProfileIn | null;
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const row: Record<string, unknown> = { slug: params.slug, updated_at: new Date().toISOString() };
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  if (b.handle !== undefined) {
    const h = str(b.handle, 60)?.replace(/^@/, "");
    if (!h || !/^[A-Za-z0-9._]+$/.test(h)) return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
    row.handle = h;
  }
  if (b.display_name !== undefined) row.display_name = str(b.display_name, 80) ?? null;
  if (b.verified !== undefined) row.verified = b.verified === true;
  if (b.followers !== undefined) row.followers = str(b.followers, 20) ?? null;
  if (b.following !== undefined) row.following = str(b.following, 20) ?? null;
  if (b.posts !== undefined) row.posts = Number.isFinite(b.posts) ? Math.max(0, Math.round(b.posts as number)) : null;
  if (b.bio !== undefined) {
    if (!Array.isArray(b.bio)) return NextResponse.json({ error: "Invalid bio" }, { status: 400 });
    row.bio = (b.bio as BioLine[]).slice(0, 8).map((l) => ({ t: String(l?.t ?? "").slice(0, 160), k: l?.k === "cat" || l?.k === "link" ? l.k : "" }));
  }
  const okImage = (v: unknown, maxLen: number) => typeof v === "string" && v.length <= maxLen && DATA_URI.test(v);
  if (b.avatar !== undefined) {
    if (b.avatar !== null && !okImage(b.avatar, 60_000)) return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
    row.avatar = b.avatar;
  }
  if (b.grid !== undefined) {
    if (!Array.isArray(b.grid) || b.grid.length > 12 || !b.grid.every((g) => okImage(g, 120_000)))
      return NextResponse.json({ error: "Invalid feed photos" }, { status: 400 });
    row.grid = b.grid;
    row.captured_at = row.updated_at;
  }

  const supabase = createLiveServiceSupabase();
  const { data: existing } = await supabase.from("carousel_ig_profiles").select("slug").eq("slug", params.slug).maybeSingle();
  if (!existing && !row.handle) return NextResponse.json({ error: "A new profile needs a handle" }, { status: 400 });
  const q = existing
    ? supabase.from("carousel_ig_profiles").update(row).eq("slug", params.slug)
    : supabase.from("carousel_ig_profiles").insert(row);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
