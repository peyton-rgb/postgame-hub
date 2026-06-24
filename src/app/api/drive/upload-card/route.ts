// src/app/api/drive/upload-card/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/upload-card
// Body: { athleteName, filename, pngBase64 }
//
// Uploads ONE exported draft-card PNG into the athlete's folder under
// DRAFTS/2026 NBA Draft/ in Drive. Ensures the per-athlete subfolder
// exists (find-or-create), then uploads the PNG bytes.
//
// Auth: refresh-token Drive client (getDriveClient) — same path the
// read routes use. The DRAFTS parent lives on a SHARED DRIVE, so every
// Drive write must pass supportsAllDrives:true (ensureFolder already does;
// the files.create upload below does too).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { createServerSupabase } from "@/lib/supabase-server";
import { getDriveClient, ensureFolder } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// DRAFTS / 2026 NBA Draft  (Shared Drive 0AOO69ML6MEr3Uk9PVA)
const DRAFTS_PARENT = "1NbLiNIFdCn311xCB1e6gToCBCZ39Mo7S";

export async function POST(request: NextRequest) {
  try {
    // Auth gate — matches the other /api/drive/* routes (staff/dashboard session).
    const authClient = createServerSupabase();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteName, filename, pngBase64 } = body;
    if (!athleteName || !filename || !pngBase64) {
      return NextResponse.json(
        { error: "Missing required fields: athleteName, filename, pngBase64" },
        { status: 400 }
      );
    }

    // 1. Find-or-create the athlete's subfolder under DRAFTS/2026 NBA Draft/.
    //    ensureFolder passes supportsAllDrives:true internally (Shared Drive safe).
    const { id: folderId } = await ensureFolder(String(athleteName), DRAFTS_PARENT);

    // 2. Decode the PNG (accept a raw base64 string OR a full data: URL).
    const b64 = String(pngBase64).replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(b64, "base64");
    if (!buffer.length) {
      return NextResponse.json({ error: "pngBase64 decoded to 0 bytes" }, { status: 400 });
    }

    // 3. Upload the PNG bytes into the athlete folder.
    //    Shared Drive → supportsAllDrives:true is REQUIRED here.
    const drive = getDriveClient();
    const res = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: String(filename),
        mimeType: "image/png",
        parents: [folderId],
      },
      media: {
        mimeType: "image/png",
        body: Readable.from(buffer),
      },
      fields: "id, name, webViewLink",
    });

    return NextResponse.json({
      ok: true,
      fileId: res.data.id,
      fileName: res.data.name,
      webViewLink: res.data.webViewLink,
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    });
  } catch (error: any) {
    console.error("[drive/upload-card] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
