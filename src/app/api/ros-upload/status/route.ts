// ============================================================
// GET /api/ros-upload/status?shootId=…&batchId=…  (PUBLIC — no session)
//
// The upload box polls this to flip a file from "Received" to "Saved to
// LucidLink" (or "Failed") once the Studio has reported on it. The batch id is
// a random id made by the uploading browser, so only that browser can ask
// about its own files.
//
// Returns: { uploads: [{ upload_id, file_name, relative_path, status, error }] }
// newest first, at most 2000 rows.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createLiveServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const shootId = request.nextUrl.searchParams.get("shootId") || "";
  const batchId = request.nextUrl.searchParams.get("batchId") || "";
  if (!UUID_RE.test(shootId) || !batchId || batchId.length > 100) {
    return NextResponse.json({ error: "Missing shootId or batchId." }, { status: 400 });
  }

  const supabase = createLiveServiceSupabase();
  const { data, error } = await supabase
    .from("ros_uploads")
    .select("upload_id, file_name, relative_path, status, error")
    .eq("ros_shoot_id", shootId)
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[ros-upload/status] read failed:", error.message);
    return NextResponse.json({ error: "Could not load upload status." }, { status: 500 });
  }

  return NextResponse.json({ uploads: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
