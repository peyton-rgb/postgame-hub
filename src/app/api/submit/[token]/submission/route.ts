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
// This lives in its own file so the upload/chunking/storage logic in
// ../route.ts is not touched. `resolveLink` / `linkBlockedReason` are repeated
// here rather than imported for the same reason.
//
// It does make one read-only Drive call, to recover the athlete's folder id for
// `athlete_folder_id` — see the note at step 0. Nothing here writes to Drive.
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
import { getDriveClient } from "@/lib/google-drive";
import { dmCampaignManager } from "@/lib/slack-dm";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Pluralise a count without the "(s)" hedge: 1 photo, 2 photos, 0 photos. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * DM the campaign's manager that content just landed.
 *
 * FIRE-AND-FORGET. Every path through this function swallows its own errors:
 * the athlete's submission is already recorded and committed by the time it
 * runs, and a Slack outage, a missing scope or an unmapped manager must never
 * turn a successful submission into an error on the athlete's screen.
 */
async function notifyManager(
  supabase: ReturnType<typeof createServiceSupabase>,
  submissionId: string,
  campaignId: string,
  linkToken: string | null,
  athlete: { first: string; last: string; school: string | null; ig: string },
): Promise<void> {
  try {
    const [{ data: campaign }, { data: files }] = await Promise.all([
      supabase
        .from("campaign_recaps")
        .select("id, name, client_name, manager_email, manager_name")
        .eq("id", campaignId)
        .single(),
      // asset_type is NOT NULL and is exactly 'photo' or 'video' in this table
      // (file_class is unpopulated) — it is the honest source for the counts.
      supabase.from("tier3_submissions").select("asset_type").eq("submission_id", submissionId),
    ]);

    if (!campaign) {
      console.error("[submit] manager DM skipped: campaign row not found");
      return;
    }

    const rows = (files as Array<{ asset_type: string | null }> | null) ?? [];
    const photos = rows.filter((r) => r.asset_type === "photo").length;
    const videos = rows.filter((r) => r.asset_type === "video").length;

    const who = `${athlete.first} ${athlete.last}`.trim();
    const where = athlete.school ? ` (${athlete.school})` : "";
    const text = [
      `📥 *New content submission* — ${campaign.client_name} · ${campaign.name}`,
      `${who}${where} · @${athlete.ig}`,
      `${count(photos, "photo")} + ${count(videos, "video")}`,
      // Straight to the review queue for THIS form rather than the campaign
      // dashboard — the manager's next action is reviewing what just landed,
      // not editing the recap. /dashboard/submission-forms/[id] takes the link
      // TOKEN as its [id] (the page documents this), and opens the split view
      // with that form already selected.
      //
      // There is no way to point deeper than the form: the page passes only
      // `initialToken` to SplitView, and nothing under submission-forms reads a
      // search param. The neighbouring review/[submissionId] route is the
      // per-FILE AI-editing surface, not a queue highlight, so it is not a
      // substitute. Falls back to the campaign dashboard if the token is
      // somehow absent — a link to the wrong page beats no link at all.
      //
      // Canonical domain, never the request origin: this submission can arrive
      // through a deployment alias the recipient has no access to.
      linkToken
        ? `→ ${siteUrl()}/dashboard/submission-forms/${encodeURIComponent(linkToken)}`
        : `→ ${siteUrl()}/dashboard/${campaign.id}`,
    ].join("\n");

    const result = await dmCampaignManager(
      campaign.manager_email,
      text,
      "⚠️ No campaign manager linked in Asana for this campaign — you're getting this as the fallback.",
    );

    if (!result.ok) {
      console.error(`[submit] manager DM not delivered: ${result.reason}`);
    }
  } catch (e) {
    console.error("[submit] manager DM failed:", e instanceof Error ? e.message : e);
  }
}

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
  // Lowercased for the same reason videographer_ig is: ig_handle is the match
  // key, so "@Marcus", "Marcus" and "marcus" have to converge on one value or
  // the same athlete arrives as three.
  const ig = String(body?.igHandle ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
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

  // The athlete's name and handle are required on both paths — they are what
  // the files file under, and ig_handle is the match key (NOT NULL in the
  // database). School, phone and email relax for a videographer, who is filing
  // someone else's content and is not asked for any of the three. This mirrors
  // submissions_athlete_contact_check, which demands all three only when
  // submitter_type = 'athlete'.
  if (!first || !last || !ig) {
    return NextResponse.json(
      { error: "The athlete's first name, last name and Instagram handle are all required." },
      { status: 400 }
    );
  }
  if (!isVideographer && (!phone || !school || !email)) {
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

  // ── 0. the athlete's Drive folder ──
  // athlete_folder_id has existed since #160 and nothing wrote it, so every
  // per-athlete Drive icon in the Hub renders dimmed. The sibling route already
  // creates the folder during upload; the id is read back here from a file that
  // actually landed, rather than being taken from the request body — this
  // endpoint is public, and a caller-supplied id would put an arbitrary Drive
  // link in front of staff.
  //
  // Reading the file's parent also means no find-or-CREATE call from this
  // route, so a submission that uploaded nothing cannot leave an empty folder
  // behind. Best-effort throughout: the files are safely in Drive and a missing
  // id only dims an icon, which is not worth failing a submission over.
  let athleteFolderId: string | null = null;
  if (fileRowIds.length > 0) {
    try {
      const { data: sample } = await supabase
        .from("tier3_submissions")
        .select("drive_file_id")
        .in("id", fileRowIds)
        .eq("campaign_id", link!.campaign_id)
        .not("drive_file_id", "is", null)
        .limit(1);

      const driveFileId = (sample as Array<{ drive_file_id: string | null }> | null)?.[0]?.drive_file_id;
      if (driveFileId) {
        const meta = await getDriveClient().files.get({
          fileId: driveFileId,
          fields: "parents",
          supportsAllDrives: true,
        });
        athleteFolderId = meta.data.parents?.[0] ?? null;
      }
    } catch (e) {
      console.error("[submit] athlete_folder_id lookup failed:", e);
    }
  }

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
      // null is the honest value when a videographer is never asked for them.
      phone: phone || null,
      school: school || null,
      email: email || null,
      submitter_type: submitterType,
      videographer_name: isVideographer ? vidName : null,
      videographer_ig: isVideographer ? vidIg : null,
      athlete_folder_id: athleteFolderId,
      athlete_id: null, // matching is a separate job
      ack_instructions_at: tickTime(body.ackInstructionsAt),
      ack_music_at: tickTime(body.ackMusicAt),
    })
    // submission_link_token comes back rather than being reused from `link`, so
    // the DM's review-queue link is built from what actually landed in the row.
    .select("id, submitted_at, submission_link_token")
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

  // ── 3. tell the campaign manager ──
  // Awaited so the DM actually goes out: this runs on a serverless function that
  // can be frozen the moment the response is returned, and a floating promise
  // would be lost. notifyManager never throws and never rejects, so awaiting it
  // cannot change what the athlete sees — only how long the request takes.
  await notifyManager(supabase, submission.id, link!.campaign_id, submission.submission_link_token ?? null, {
    first,
    last,
    school: school || null,
    ig,
  });

  return NextResponse.json({
    ok: true,
    submissionId: submission.id,
    submittedAt: submission.submitted_at,
    linkedFiles: linkedCount,
  });
}
