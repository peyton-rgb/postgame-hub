"use server";

// ============================================================
// Ratings bulk-assign (ratings.cfm absorbed into the registry).
// Confirmed POST: re-resolves the pasted handles server-side at
// submit time (never trusts the preview), scopes the UPDATE to the
// matched ids, audit-logs the batch with the full handle list.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import { parseHandles } from "@/lib/admin/handles";

export async function bulkAssignRatings(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const rating = String(formData.get("rating") ?? "").trim().toUpperCase();
  const handles = parseHandles(String(formData.get("handles") ?? ""));
  if (!["A", "B", "C", "D", "F"].includes(rating))
    redirect("/admin/users/ratings?result=bad-rating");
  if (handles.length === 0) redirect("/admin/users/ratings?result=no-handles");

  const supabase = createServiceSupabase();

  // SELECT first — resolve handles to ids (chunked .in() calls).
  const matchedIds: string[] = [];
  const matchedHandles: string[] = [];
  for (let i = 0; i < handles.length; i += 100) {
    const chunk = handles.slice(i, i + 100);
    const { data } = await supabase
      .from("people")
      .select("id, instagram_handle")
      .in("instagram_handle", chunk);
    for (const row of data ?? []) {
      matchedIds.push(row.id);
      matchedHandles.push(row.instagram_handle ?? "");
    }
  }
  if (matchedIds.length === 0) redirect("/admin/users/ratings?result=no-matches");

  const { error } = await supabase.from("people").update({ rating }).in("id", matchedIds);
  if (!error) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "person.rating_bulk_assign",
      entity: "people",
      after: {
        rating,
        matched: matchedIds.length,
        submitted: handles.length,
        handles: matchedHandles,
      },
    });
  }
  revalidatePath("/admin/users/ratings");
  redirect(
    `/admin/users/ratings?result=${error ? "error" : "applied"}&matched=${matchedIds.length}&submitted=${handles.length}`
  );
}
