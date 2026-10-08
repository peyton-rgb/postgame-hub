// ============================================================
// POST /api/ros-upload/report  (called by the Mac Studio only)
//
// The Studio posts one report per file once it has been moved into LucidLink
// (or has failed). The request is trusted only if the x-ros-signature header
// is the hex HMAC of the raw body under the shared secret.
//
// Body: { shoot_id, upload_id, batch_id, file_name, relative_path,
//         uploader_name, uploader_role, file_kind, size, sha256, lucid_path,
//         status: "in_lucid" | "failed", error }
//
// Upserts on upload_id, so the Studio's retries are safe to repeat.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { verifyReportSignature } from "@/lib/ros-upload";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

export async function POST(request: NextRequest) {
  if (!process.env.ROS_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // The signature covers the bytes as sent, so read the body as text first.
  const raw = await request.text();
  if (!verifyReportSignature(raw, request.headers.get("x-ros-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let report: Record<string, unknown>;
  try {
    report = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shootId = text(report.shoot_id);
  const uploadId = text(report.upload_id);
  const fileName = text(report.file_name);
  const status = report.status;
  const fileKind = report.file_kind;
  if (
    !shootId || !UUID_RE.test(shootId) || !uploadId || !fileName ||
    (status !== "in_lucid" && status !== "failed") ||
    (fileKind !== "raw" && fileKind !== "working")
  ) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  const size = Number(report.size);
  const supabase = createLiveServiceSupabase();
  const { error } = await supabase.from("ros_uploads").upsert(
    {
      ros_shoot_id: shootId,
      upload_id: uploadId,
      batch_id: text(report.batch_id),
      file_name: fileName,
      relative_path: text(report.relative_path),
      uploader_name: text(report.uploader_name),
      uploader_role: text(report.uploader_role),
      file_kind: fileKind,
      size: Number.isFinite(size) && report.size != null ? size : null,
      sha256: text(report.sha256),
      lucid_path: text(report.lucid_path),
      status,
      error: text(report.error),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "upload_id" }
  );

  if (error) {
    console.error("[ros-upload/report] upsert failed:", error.message);
    // 23503 = the shoot no longer exists; retrying will never fix that.
    const status = error.code === "23503" ? 422 : 500;
    return NextResponse.json({ error: "Could not save report" }, { status });
  }

  return NextResponse.json({ ok: true });
}
