// src/app/api/drive/render-status/route.ts
// ─────────────────────────────────────────────────────────────
// GET /api/drive/render-status?jobId=...
// The draft tool polls this to learn when a Video-w/-graphic render finishes.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authClient = createServerSupabase();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const supabase = createServiceSupabase();
    const { data: job, error } = await supabase
      .from("video_render_jobs")
      .select("status, links, error")
      .eq("id", jobId)
      .single();
    if (error || !job) return NextResponse.json({ error: "job not found" }, { status: 404 });

    return NextResponse.json({ status: job.status, links: job.links, error: job.error });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "status failed" }, { status: 500 });
  }
}
