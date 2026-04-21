import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createServiceSupabase } from "@/lib/supabase";
import { appendBtsRow, SheetSyncError } from "@/lib/google-sheets";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// /api/bts/[id]
//
// PATCH — toggle hold_posting on a bts_submissions row.
//         Body: { holdPosting: boolean }
// POST  — retry the Google Sheet mirror for this row. Re-runs appendBtsRow
//         and updates sheet_synced_at (success) or sheet_sync_error
//         (failure). Request body is ignored.
//
// Both require an authenticated Hub session (server Supabase client reads
// the auth cookie). No session → 401. DB writes use the service-role
// client to bypass RLS; the session check above gates the endpoint.
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/** Confirm the caller has a Hub session; returns true if authenticated. */
async function isAuthed(): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return !!data.user;
}

// ── PATCH: toggle hold_posting ─────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthed())) return unauthorized();

    const id = params.id;
    if (!UUID_RE.test(id)) return badRequest("Invalid id");

    const body = (await req.json().catch(() => null)) as
      | { holdPosting?: unknown }
      | null;
    if (!body || typeof body.holdPosting !== "boolean") {
      return badRequest("holdPosting must be a boolean");
    }

    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("bts_submissions")
      .update({ hold_posting: body.holdPosting })
      .eq("id", id)
      .select("id, hold_posting")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to update: " + (error?.message ?? "unknown") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      holdPosting: !!data.hold_posting,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: retry sheet sync ─────────────────────────────────────────────
// Returns HTTP 200 whether or not the external Sheets append succeeds.
// The request itself succeeded (we attempted the retry, logged the
// result, persisted it). The sheets outcome is data: { synced: bool }.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthed())) return unauthorized();

    const id = params.id;
    if (!UUID_RE.test(id)) return badRequest("Invalid id");

    const supabase = createServiceSupabase();

    // Re-fetch the row with brand + campaign names so we rebuild the
    // sheet row from source, not from client-sent data.
    const { data: row, error: rowErr } = await supabase
      .from("bts_submissions")
      .select(
        `
          id, athlete_name, submitter_name, hold_posting,
          video_url, submitted_at,
          brand:brands ( name ),
          campaign:campaign_recaps ( name )
        `
      )
      .eq("id", id)
      .maybeSingle();
    if (rowErr) {
      return NextResponse.json(
        { error: "Failed to read submission: " + rowErr.message },
        { status: 500 }
      );
    }
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const brandName =
      (Array.isArray((row as any).brand)
        ? (row as any).brand[0]?.name
        : (row as any).brand?.name) ?? null;
    const campaignName =
      (Array.isArray((row as any).campaign)
        ? (row as any).campaign[0]?.name
        : (row as any).campaign?.name) ?? null;

    try {
      await appendBtsRow({
        submittedAt: new Date(row.submitted_at as string),
        athleteName: (row.athlete_name as string) ?? "",
        brandName,
        campaignName,
        holdPosting: !!row.hold_posting,
        submitterName: (row.submitter_name as string | null) ?? null,
        videoUrl: (row.video_url as string) ?? "",
        supabaseId: row.id as string,
      });

      const nowIso = new Date().toISOString();
      await supabase
        .from("bts_submissions")
        .update({ sheet_synced_at: nowIso, sheet_sync_error: null })
        .eq("id", id);

      return NextResponse.json({ synced: true, sheetSyncedAt: nowIso });
    } catch (rawErr) {
      const wrapped = new SheetSyncError("BTS sheet append failed", rawErr);
      await supabase
        .from("bts_submissions")
        .update({ sheet_sync_error: wrapped.message })
        .eq("id", id);
      return NextResponse.json({ synced: false, error: wrapped.message });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
