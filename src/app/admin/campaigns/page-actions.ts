// ============================================================
// Campaign page drafts — server action for the five draft editors
// (/admin/campaigns/[id]/{contract,deal,posting,brief,recap}).
//
// One action: parse the posted JSON into the kind's shape, SELECT the
// campaign and the existing row, then upsert campaign_pages scoped to
// (campaign_id, kind). "Publish" / "Send for signature" flips status
// to live; nothing is sent anywhere yet (that's the app slice), and the
// result note says so. Before migration 088 the table is missing and
// the action reports that instead of failing silently.
// ============================================================

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_KINDS, parseDraft, type PageKind } from "@/lib/admin/campaigns/page-drafts";

export async function saveCampaignPage(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = Number(formData.get("campaign_id"));
  if (!Number.isInteger(id) || id <= 0) redirect("/admin/campaigns");
  const kind = String(formData.get("kind") ?? "") as PageKind;
  if (!PAGE_KINDS.includes(kind)) redirect(`/admin/campaigns/${id}`);
  const back = `/admin/campaigns/${id}/${kind}`;

  const intent = formData.get("intent") === "publish" ? "publish" : "save";
  let raw: unknown;
  let filledFrom: unknown;
  try {
    raw = JSON.parse(String(formData.get("content") ?? "{}"));
    filledFrom = JSON.parse(String(formData.get("filled_from") ?? "[]"));
  } catch {
    redirect(`${back}?result=error`);
  }
  const content = parseDraft(kind, raw);
  const filled_from = Array.isArray(filledFrom) ? filledFrom.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  const variantRaw = String(formData.get("variant") ?? "");
  const variant = kind === "contract" ? (variantRaw === "event" ? "event" : "standard") : variantRaw || null;

  const supabase = createServiceSupabase();
  // SELECT before writing: the campaign must exist, and we look at the
  // row we're about to replace so the write is scoped to exactly it.
  const { data: campaign } = await supabase.from("campaigns").select("campaign_id").eq("campaign_id", id).maybeSingle();
  if (!campaign) redirect("/admin/campaigns");

  const existing = await supabase.from("campaign_pages").select("id, status").eq("campaign_id", id).eq("kind", kind).maybeSingle();
  if (existing.error && isMissingSchemaError(existing.error)) redirect(`${back}?result=pages-pending`);

  const status = intent === "publish" ? "live" : existing.data?.status === "live" ? "live" : "draft";
  const row = { campaign_id: id, kind, status, variant, content, filled_from, updated_by: actor.id };
  const { error } = existing.data
    ? await supabase.from("campaign_pages").update(row).eq("id", existing.data.id).eq("campaign_id", id).eq("kind", kind)
    : await supabase.from("campaign_pages").insert(row);
  if (error) {
    console.error("[admin/campaigns] page save failed", id, kind, error);
    redirect(`${back}?result=${isMissingSchemaError(error) ? "pages-pending" : "error"}`);
  }

  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath(back);
  redirect(`${back}?result=${intent === "publish" ? "published" : "saved"}`);
}
