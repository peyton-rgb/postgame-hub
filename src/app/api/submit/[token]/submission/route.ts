// src/app/api/submit/[token]/submission/route.ts
// ─────────────────────────────────────────────────────────────
// PUBLIC — records the parent `submissions` row for one athlete submission.
//
//   POST /api/submit/[token]/submission
//
// The sibling route (../route.ts) owns the Drive upload pipeline and writes one
// `tier3_submissions` row per file. Identity and the two acknowledgements belong
// to the submission, not to a file — so they land here, in the parent table, and
// each file row is then stamped with `submission_id`.
//
// Order is deliberate and matches the build brief:
//   1. insert the `submissions` row
//   2. set `submission_id` on each `tier3_submissions` row from this upload
//
// This lives in its own file so the upload/chunking/storage/Drive logic in
// ../route.ts is not touched. `resolveLink` / `linkBlockedReason` are repeated
// here rather than imported for the same reason.
//
// `athlete_id` stays null — matching an athlete to a row is a separate job.
//
// Submitter type: an athlete filing their own content, or a videographer filing
// on an athlete's behalf. The athlete identity columns describe the ATHLETE on
// both paths — the videographer's own name and handle go only in the two
// videographer columns. Attribution, never the filing key.
//
// Two CHECK constraints back this up in the database, but they are the backstop:
// the shape is validated here so a bad request gets a plain-English 400 rather
// than a constraint violation surfacing as a 500.
//
// "Tier 3" is internal language: it must never appear in anything this endpoint
// returns to a caller.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface SubmissionLink {
  token: string;
  campaign_id: string;
  active: boolean;
  expires_at: string | null;
}

async function resolveLink(token: string): Promise<SubmissionLink | null> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("submission_links")
    .select("token, campaign_id, active, expires_at")
    .eq("token", token)
    .single();
  return (data as SubmissionLink) ?? null;
}

/** Reason a link can't be used — null means it's good to go. */
function linkBlockedReason(link: SubmissionLink | null): { status: number; error: string } | null {
  if (!link) return { status: 404, error: "This upload link isn't valid." };
  if (!link.active) return { status: 403, error: "This upload link is closed." };
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return { status: 410, error: "This upload link has expired." };
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept the client's tick time when it's a sane timestamp, otherwise stamp now.
 *  The column is NOT NULL and the value comes off the athlete's own clock, so a
 *  skewed or absent value must not lose the whole submission. */
function tickTime(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  // Guard against a wildly wrong device clock in either direction.
  const drift = Math.abs(d.getTime() - Date.now());
  if (drift > 24 * 60 * 60 * 1000) return new Date().toISOString();
  return d.toISOString();
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const link = await resolveLink(params.token);
  const blocked = linkBlockedReason(link);
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  // Normalise exactly as the form does, so a hand-rolled POST can't slip past it:
  // trim everything, strip a leading @ from the handle, strip non-digits from the phone.
  const first = String(body?.firstName ?? "").trim();
  const last = String(body?.lastName ?? "").trim();
  const ig = String(body?.igHandle ?? "")
    .trim()
    .replace(/^@+/, "");
  const phone = String(body?.phone ?? "").replace(/\D/g, "");
  const school = String(body?.school ?? "").trim();
  const email = String(body?.email ?? "").trim();

  const submitterType = String(body?.submitterType ?? "athlete").trim();
  if (submitterType !== "athlete" && submitterType !== "videographer") {
    return NextResponse.json({ error: "Unknown submitter type." }, { status: 400 });
  }
  const isVideographer = submitterType === "videographer";

  // Lowercased, unlike the athlete handle: videographer_ig is the de-facto
  // identity key until the directory can be linked by id, and @MarcusReedFilms
  // must not become a second person from @marcusreedfilms.
  const vidName = String(body?.videographerName ?? "").trim();
  const vidIg = String(body?.videographerIg ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

  if (isVideographer) {
    if (!vidName || !vidIg) {
      return NextResponse.json(
        { error: "Your name and your Instagram handle are both required." },
        { status: 400 }
      );
    }
  } else if (vidName || vidIg) {
    return NextResponse.json(
      { error: "Videographer details can't be sent on an athlete submission." },
      { status: 400 }
    );
  }

  // The athlete columns are required on both paths — they are what the files
  // file under. Only phone and email relax for a videographer, who is not
  // expected to hand over the athlete's contact details.
  if (!first || !last || !ig || !school) {
    return NextResponse.json(
      { error: "The athlete's first name, last name, Instagram handle and school are all required." },
      { status: 400 }
    );
  }
  if (!isVideographer && (!phone || !email)) {
    return NextResponse.json(
      { error: "First name, last name, Instagram handle, phone, school and email are all required." },
      { status: 400 }
    );
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  // Both acknowledgements are mandatory — the old Google Form did not gate this.
  if (!body?.ackInstructionsAt || !body?.ackMusicAt) {
    return NextResponse.json(
      { error: "Please confirm you've read the campaign instructions and the music rule." },
      { status: 400 }
    );
  }

  const fileRowIds: string[] = Array.isArray(body?.fileRowIds)
    ? Array.from(new Set(body.fileRowIds.map((v: unknown) => String(v ?? "")).filter((v: string) => UUID_RE.test(v))))
    : [];

  const supabase = createServiceSupabase();

  // ── 1. the parent row ──
  const { data: submission, error: insertError } = await supabase
    .from("submissions")
    .insert({
      submission_link_token: link!.token,
      campaign_id: link!.campaign_id,
      athlete_first_name: first,
      athlete_last_name: last,
      ig_handle: ig,
      // Empty strings would satisfy the NOT NULL the contact CHECK replaced;
      // null is the honest value when a videographer leaves them blank.
      phone: phone || null,
      school,
      email: email || null,
      submitter_type: submitterType,
      videographer_name: isVideographer ? vidName : null,
      videographer_ig: isVideographer ? vidIg : null,
      athlete_id: null, // matching is a separate job
      ack_instructions_at: tickTime(body.ackInstructionsAt),
      ack_music_at: tickTime(body.ackMusicAt),
    })
    .select("id, submitted_at")
    .single();

  if (insertError || !submission) {
    console.error("[submit] submissions insert failed:", insertError?.message);
    return NextResponse.json({ error: "Couldn't record your submission. Please try again." }, { status: 500 });
  }

  // ── 2. stamp submission_id onto this upload's file rows ──
  // Scoped by both the ids the client reported AND this link's campaign, so a
  // forged id can't re-parent someone else's row.
  let linkedCount = 0;
  if (fileRowIds.length > 0) {
    const { data: linked, error: linkError } = await supabase
      .from("tier3_submissions")
      .update({ submission_id: submission.id })
      .in("id", fileRowIds)
      .eq("campaign_id", link!.campaign_id)
      .is("submission_id", null)
      .select("id");

    if (linkError) {
      // The files are safely in Drive and the parent row exists; a failed link-up
      // is repairable from staff side and must not fail the athlete's submission.
      console.error("[submit] submission_id link-up failed:", linkError.message);
    } else {
      linkedCount = linked?.length ?? 0;
    }
  }

  return NextResponse.json({
    ok: true,
    submissionId: submission.id,
    submittedAt: submission.submitted_at,
    linkedFiles: linkedCount,
  });
}
