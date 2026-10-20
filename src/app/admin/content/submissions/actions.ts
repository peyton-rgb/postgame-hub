"use server";

// ============================================================
// Submission forms — server actions.
// Staff-gated, audit-logged, safe schema degradation.
// ============================================================

import { revalidatePath } from "next/cache";
import { getAdminActor, isMissingSchemaError, requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import { deliverableTotals, type SubmissionFormData } from "@/lib/admin/submissions/form";

function revalidate(campaignId?: number) {
  revalidatePath("/admin/content/submissions");
  if (campaignId) {
    revalidatePath(`/admin/content/submissions/${campaignId}`);
    revalidatePath(`/admin/content/submissions/${campaignId}/edit`);
  }
}

/** Save submission form settings (title, deliverables, due date, limits, consent, confirmation). */
export async function saveSubmissionForm(
  campaignId: number,
  formData: SubmissionFormData,
  extra?: { photoMax?: string; videoMax?: string; lucidPath?: string }
): Promise<{ ok: boolean; error?: string; pending087?: boolean }> {
  try {
    const actor = await requireAdmin("staff");
    const supabase = createServiceSupabase();

    // Check if form row exists
    const { data: existing, error: findError } = await supabase
      .from("content_submission_forms")
      .select("id, status")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (findError) {
      if (isMissingSchemaError(findError)) return { ok: false, pending087: true, error: "Table content_submission_forms pending (083)" };
      return { ok: false, error: findError.message };
    }

    const totals = deliverableTotals(formData.deliverables);
    const now = new Date().toISOString();

    // Payload for 087 columns + 083 columns
    const fullPayload: Record<string, unknown> = {
      campaign_id: campaignId,
      title: formData.title,
      instructions: formData.instructions,
      accepted_types: formData.accepted_types,
      max_size_mb: formData.max_size_mb,
      deliverables: formData.deliverables,
      deadline: formData.deadline || null,
      consent_text: formData.consent_text,
      confirmation_text: formData.confirmation_text,
      lucidlink_path: extra?.lucidPath || null,
      min_photos: totals.photos,
      min_videos: totals.videos,
      updated_at: now,
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("content_submission_forms")
        .update(fullPayload)
        .eq("id", existing.id);

      if (updateError) {
        if (isMissingSchemaError(updateError)) {
          // Fall back to updating only 083 columns if 087 columns are absent
          const fallbackPayload = {
            min_photos: totals.photos,
            min_videos: totals.videos,
            updated_at: now,
          };
          await supabase.from("content_submission_forms").update(fallbackPayload).eq("id", existing.id);
          return { ok: true, pending087: true };
        }
        return { ok: false, error: updateError.message };
      }
    } else {
      fullPayload.status = "live";
      const { error: insertError } = await supabase.from("content_submission_forms").insert(fullPayload);
      if (insertError) {
        if (isMissingSchemaError(insertError)) {
          return { ok: true, pending087: true };
        }
        return { ok: false, error: insertError.message };
      }
    }

    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "content_submission_form.update",
      entity: "content_submission_forms",
      entityId: String(campaignId),
      after: {
        campaign_id: campaignId,
        deliverables_count: formData.deliverables.length,
        deadline: formData.deadline,
      },
    });

    revalidate(campaignId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Assign a videographer to a campaign */
export async function assignVideographer(
  campaignId: number,
  data: { profileId?: string; name?: string; email?: string; athletesScope?: string }
): Promise<{ ok: boolean; error?: string; pending087?: boolean }> {
  try {
    const actor = await requireAdmin("staff");
    const supabase = createServiceSupabase();

    let targetUserId = data.profileId;

    // If new videographer name and email provided, ensure profile exists
    if (!targetUserId && data.email && data.name) {
      const email = data.email.trim().toLowerCase();
      const { data: existingProf } = await supabase
        .from("videographer_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProf) {
        targetUserId = existingProf.id;
      } else {
        const { data: newProf, error: createProfError } = await supabase
          .from("videographer_profiles")
          .insert({
            full_name: data.name.trim(),
            email,
            status: "signed_up",
          })
          .select("id")
          .single();

        if (createProfError) {
          if (isMissingSchemaError(createProfError)) {
            return { ok: false, pending087: true, error: "Migration 085/087 pending" };
          }
          return { ok: false, error: createProfError.message };
        }
        targetUserId = newProf.id;
      }
    }

    if (!targetUserId) {
      return { ok: false, error: "Videographer profile could not be resolved." };
    }

    const { error: assignError } = await supabase.from("campaign_videographers").upsert(
      {
        campaign_id: campaignId,
        user_id: targetUserId,
        status: "assigned",
        lucid_access: "pending",
        assigned_by: actor.id,
      },
      { onConflict: "campaign_id,user_id" }
    );

    if (assignError) {
      if (isMissingSchemaError(assignError)) {
        return { ok: false, pending087: true, error: "Migration 087 (campaign_videographers) pending" };
      }
      return { ok: false, error: assignError.message };
    }

    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "campaign_videographer.create",
      entity: "campaign_videographers",
      entityId: `${campaignId}:${targetUserId}`,
      after: {
        campaign_id: campaignId,
        videographer_id: targetUserId,
      },
    });

    revalidate(campaignId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Unassign a videographer from a campaign */
export async function unassignVideographer(
  campaignId: number,
  assignmentId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireAdmin("staff");
    const supabase = createServiceSupabase();

    const { error } = await supabase
      .from("campaign_videographers")
      .update({ status: "removed" })
      .eq("id", assignmentId);

    if (error) {
      return { ok: false, error: error.message };
    }

    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "campaign_videographer.delete",
      entity: "campaign_videographers",
      entityId: assignmentId,
      after: {
        campaign_id: campaignId,
        assignment_id: assignmentId,
      },
    });

    revalidate(campaignId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Send reminder to a single athlete */
export async function remindAthlete(
  campaignId: number,
  optInId?: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireAdmin("staff");
    const supabase = createServiceSupabase();

    if (optInId) {
      await supabase
        .from("campaign_opt_ins")
        .update({ reminded_at: new Date().toISOString() })
        .eq("campaign_opt_in_id", optInId);
    }

    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "campaign_athlete.remind",
      entity: "campaign_athletes",
      entityId: String(optInId ?? campaignId),
      after: {
        campaign_id: campaignId,
        opt_in_id: optInId,
      },
    });

    revalidate(campaignId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Send reminders to all athletes who haven't uploaded */
export async function remindAllAthletes(campaignId: number): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const actor = await requireAdmin("staff");
    const supabase = createServiceSupabase();

    const { error } = await supabase
      .from("campaign_opt_ins")
      .update({ reminded_at: new Date().toISOString() })
      .eq("campaign_id", campaignId)
      .eq("is_selected", true);

    if (error && !isMissingSchemaError(error)) {
      return { ok: false, error: error.message };
    }

    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "campaign_athletes.remind_all",
      entity: "campaign_athletes",
      entityId: String(campaignId),
      after: {
        campaign_id: campaignId,
      },
    });

    revalidate(campaignId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
