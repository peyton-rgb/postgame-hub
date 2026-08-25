// ============================================================
// Deliverable status transitions — the ONE writer
//
// Every write to athlete_deliverables.status goes through here. The staff
// action route, the brand decision routes and the staff queue all call it.
// Two writers is how the session and deliverable state machines drifted apart
// in the first place; this exists so there is never a second one.
//
// Transitions:
//   approve / reject / verify   — the staff gates, unchanged behaviour
//   send_to_brand               — in_review | in_edit -> brand_review
//   brand_approve              — the brand cleared it -> approved
//   brand_reject               — the brand sent it back -> in_edit
//   send_back_to_athlete       — in_edit -> changes_requested
//
// On notifications: approval reaches the athlete immediately, because nothing
// bad comes of hearing sooner. A brand rejection does NOT notify — it stops at
// in_edit for a person to read the brand's words and decide what the athlete
// should actually see. The athlete hears at send_back_to_athlete.
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";
import { createPendingPayout } from "@/lib/payouts";
import { notifyAthlete } from "@/lib/notify";
import { slotLabel } from "@/lib/deliverable-status";

export type DeliverableTransition =
  | "approve"
  | "reject"
  | "verify"
  | "send_to_brand"
  | "brand_approve"
  | "brand_reject"
  | "send_back_to_athlete";

export type TransitionResult =
  | { ok: true; dealComplete: boolean; noop: boolean }
  | { ok: false; status: number; error: string };

// Statuses a staff approve/reject decision can legitimately act on.
//   in_review    — the athlete has submitted; the original decision point.
//   brand_review — the deal is sitting with the brand; this is exactly where a
//                  brand decision lands, so staff must be able to record it.
// in_edit is deliberately excluded from the STAFF gates: content is mid-edit,
// so the artifact being judged is still changing.
const DECIDABLE_STATUSES = ["in_review", "brand_review"];

// A brand decision can arrive whether or not staff used send-to-brand first,
// so these accept the pre-send states too.
const BRAND_DECIDABLE = ["in_review", "in_edit", "brand_review"];

// Sending is only meaningful from a state where content exists and is not
// already out or decided.
const SENDABLE = ["in_review", "in_edit"];

export async function applyDeliverableTransition(
  deliverableId: string,
  transition: DeliverableTransition,
  opts: { note?: string | null } = {}
): Promise<TransitionResult> {
  const service = createServiceSupabase();
  const { data: deliverable } = await service
    .from("athlete_deliverables")
    .select(
      "id,status,optin_id,slot,athlete_id,optin_campaign_id,campaign:optin_campaigns(title,brand:brands(name))"
    )
    .eq("id", deliverableId)
    .maybeSingle();
  if (!deliverable) {
    return { ok: false, status: 404, error: "Deliverable not found" };
  }

  const campaign = Array.isArray((deliverable as any).campaign)
    ? (deliverable as any).campaign[0]
    : (deliverable as any).campaign;
  const brand = campaign ? (Array.isArray(campaign.brand) ? campaign.brand[0] : campaign.brand) : null;
  const brandName = brand?.name || "your brand";
  const dealLink = `/athlete/my-deals/${deliverable.optin_id}`;

  const now = new Date().toISOString();
  let update: Record<string, any> = { updated_at: now };

  if (transition === "approve") {
    if (!DECIDABLE_STATUSES.includes(deliverable.status)) {
      return { ok: false, status: 409, error: "Only in-review content can be approved." };
    }
    update = { ...update, status: "approved", approved_at: now, review_note: null };
  } else if (transition === "reject") {
    if (!DECIDABLE_STATUSES.includes(deliverable.status)) {
      return { ok: false, status: 409, error: "Only in-review content can be rejected." };
    }
    update = {
      ...update,
      status: "changes_requested",
      review_note: opts.note || "Please revise and re-upload.",
    };
  } else if (transition === "verify") {
    if (deliverable.status !== "pending_verification") {
      return {
        ok: false,
        status: 409,
        error: "Only posted content awaiting verification can be verified.",
      };
    }
    update = { ...update, status: "verified", verified_at: now };
  } else if (transition === "send_to_brand") {
    // Already out with the brand: nothing to do, and not an error — the caller
    // may be re-sending the link to a second contact.
    if (deliverable.status === "brand_review") {
      return { ok: true, dealComplete: false, noop: true };
    }
    if (!SENDABLE.includes(deliverable.status)) {
      return { ok: false, status: 409, error: "This content isn't ready to send to the brand." };
    }
    update = { ...update, status: "brand_review", sent_to_brand_at: now };
  } else if (transition === "brand_approve") {
    // Idempotent: gate 2 can be reached more than once.
    if (deliverable.status === "approved") {
      return { ok: true, dealComplete: false, noop: true };
    }
    if (!BRAND_DECIDABLE.includes(deliverable.status)) {
      return { ok: false, status: 409, error: "This content isn't awaiting a brand decision." };
    }
    update = { ...update, status: "approved", approved_at: now, review_note: null };
  } else if (transition === "brand_reject") {
    if (deliverable.status === "in_edit") {
      // Already sent back; refresh the compiled note but do not restart the clock.
      update = { ...update, ...(opts.note ? { review_note: opts.note } : {}) };
      const { error } = await service
        .from("athlete_deliverables")
        .update(update)
        .eq("id", deliverableId);
      if (error) {
        console.error("brand_reject refresh error:", error.message);
        return { ok: false, status: 500, error: "Couldn't update. Please try again." };
      }
      return { ok: true, dealComplete: false, noop: true };
    }
    if (!BRAND_DECIDABLE.includes(deliverable.status)) {
      return { ok: false, status: 409, error: "This content isn't awaiting a brand decision." };
    }
    // in_edit, NOT changes_requested. changes_requested is athlete-facing and
    // means the athlete must act; a brand send-back usually means Postgame acts
    // first. An employee decides which it becomes.
    update = {
      ...update,
      status: "in_edit",
      edit_started_at: now,
      ...(opts.note ? { review_note: opts.note } : {}),
    };
  } else if (transition === "send_back_to_athlete") {
    if (deliverable.status !== "in_edit") {
      return { ok: false, status: 409, error: "Only content in edit can be sent back to the athlete." };
    }
    update = {
      ...update,
      status: "changes_requested",
      ...(opts.note ? { review_note: opts.note } : {}),
    };
  }

  const { error: updErr } = await service
    .from("athlete_deliverables")
    .update(update)
    .eq("id", deliverableId);
  if (updErr) {
    console.error("deliverable transition error:", updErr.message);
    return { ok: false, status: 500, error: "Couldn't update. Please try again." };
  }

  // Next-step nudge to the athlete (mockup screen 9). brand_reject and
  // send_to_brand are deliberately silent — see the header.
  if (transition === "approve" || transition === "brand_approve") {
    await notifyAthlete(deliverable.athlete_id, {
      type: "content_approved",
      title: `Your ${brandName} content is approved`,
      message: `Time to post your ${slotLabel(deliverable.slot).toLowerCase()}. Tap for your file, caption, and link.`,
      linkUrl: dealLink,
      campaignId: deliverable.optin_campaign_id,
    });
  } else if (transition === "reject" || transition === "send_back_to_athlete") {
    await notifyAthlete(deliverable.athlete_id, {
      type: "changes_requested",
      title: `Changes needed on your ${brandName} content`,
      message: update.review_note || "Tap to see what to update and re-upload.",
      linkUrl: dealLink,
      campaignId: deliverable.optin_campaign_id,
    });
  } else if (transition === "verify") {
    await notifyAthlete(deliverable.athlete_id, {
      type: "post_verified",
      title: `Your ${brandName} post is verified`,
      message: `Nice — your ${slotLabel(deliverable.slot).toLowerCase()} is confirmed live.`,
      linkUrl: dealLink,
      campaignId: deliverable.optin_campaign_id,
    });
  }

  // After a verify, see if the whole deal is done.
  let dealComplete = false;
  if (transition === "verify") {
    const { data: siblings } = await service
      .from("athlete_deliverables")
      .select("status")
      .eq("optin_id", deliverable.optin_id);
    dealComplete =
      !!siblings &&
      siblings.length > 0 &&
      siblings.every((s) => s.status === "verified" || s.status === "paid");
    if (dealComplete) {
      await service
        .from("athlete_campaign_optins")
        .update({ status: "completed", updated_at: now })
        .eq("id", deliverable.optin_id);
      // Phase 5: schedule the payout (stubbed execution).
      await createPendingPayout(deliverable.optin_id);
      await notifyAthlete(deliverable.athlete_id, {
        type: "payout_scheduled",
        title: `Payout scheduled for ${brandName}`,
        message:
          "All your posts are verified. Your payout is scheduled — link your PayPal to get paid.",
        linkUrl: "/athlete/earnings",
        campaignId: deliverable.optin_campaign_id,
      });
    }
  }

  return { ok: true, dealComplete, noop: false };
}

// ------------------------------------------------------------
// Brand feedback -> review_note
//
// The athlete's card renders athlete_deliverables.review_note; brand feedback
// lives in review_comments. This bridges them by STRAIGHT CONCATENATION —
// no summarising, no rewriting, no softening. An employee edits this before it
// reaches the athlete, and putting anything between the brand's words and the
// person who has to act on them would hide what was actually said.
// ------------------------------------------------------------

function formatTimecode(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export async function compileBrandFeedback(sessionId: string): Promise<string | null> {
  const service = createServiceSupabase();
  const { data: comments } = await service
    .from("review_comments")
    .select("body,timestamp_seconds,created_at")
    .eq("session_id", sessionId)
    .eq("author_type", "brand")
    .order("created_at", { ascending: true });

  if (!comments?.length) return null;

  const lines = comments
    .map((c: any) => {
      const body = (c.body ?? "").trim();
      if (!body) return null;
      // Photos have no timeline, so they have no timestamp — omit the prefix
      // rather than writing 0:00.
      return c.timestamp_seconds !== null && c.timestamp_seconds !== undefined
        ? `${formatTimecode(Number(c.timestamp_seconds))} — ${body}`
        : body;
    })
    .filter(Boolean);

  return lines.length ? lines.join("\n\n") : null;
}
