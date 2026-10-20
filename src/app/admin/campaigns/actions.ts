// ============================================================
// Campaign server actions — create, save, archive, select athletes,
// attach audiences, save the opt-in page.
//
// Writes the blended `campaigns` table (migration 083) plus the
// columns migration 084 adds. Every write that touches an 084 column
// is tried with the new columns first and retried without them when
// the column is missing, so the screens work before the migration.
//
// Every action re-checks the signed-in user on the server (never
// trusts the page), writes only the columns the form owns, SELECTs
// before any UPDATE, and scopes every update to one campaign_id.
// ============================================================

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { parseOptinPage, toRow } from "@/lib/admin/campaigns/optin-page";

// ---- 083 columns the edit form owns ----
const TEXT_FIELDS = [
  "campaign_name",
  "campaign_note",
  "sow_link",
  "invoice_link",
  "campaign_brief_link",
  "campaign_details_link",
  "campaign_style_guide",
  "asana_link",
  "college_id_list",
  "affiliate_link",
  "affiliate_landing_page",
  "affiliate_ad_id",
  "affiliate_param_template",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "custom_tracking",
  "content_type",
] as const;

const NUMBER_FIELDS = [
  "total_budget",
  "est_athlete_spend",
  "est_videographer_spend",
  "management_fee",
  "other_spend",
  "est_margin_goal",
] as const;

const UUID_FIELDS = ["brand_id", "manager_person_id", "assistant_person_id"] as const;
const DATE_FIELDS = ["expected_pay_date"] as const;

// ---- 084 columns ----
const EXTRA_TEXT_FIELDS = [
  "event_venue",
  "event_activities",
  "event_wardrobe",
  "event_travel_notes",
  "internal_sheet_link",
  "external_sheet_link",
  "performance_tracker_link",
  "lucidlink_folder_path",
  "drive_folder_id",
] as const;
const EXTRA_TIME_FIELDS = ["event_start_time", "event_call_time"] as const;

type Patch = Record<string, string | number | boolean | null | string[] | object>;

function text(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.replace(/[$,%\s]/g, "") : "";
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function date(v: FormDataEntryValue | null): string | null {
  const s = text(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function time(v: FormDataEntryValue | null): string | null {
  const s = text(v);
  return s && /^\d{1,2}:\d{2}/.test(s) ? s.slice(0, 5) : null;
}

function campaignType(v: FormDataEntryValue | null): "social" | "event" {
  return v === "event" ? "event" : "social";
}

function campaignIdFrom(formData: FormData): number | null {
  const n = Number(formData.get("campaign_id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Split a patch: base (083) vs extras (084). */
function extrasPatch(formData: FormData): Patch {
  const p: Patch = { campaign_type: campaignType(formData.get("campaign_type")) };
  p.event_date = date(formData.get("event_date"));
  for (const f of EXTRA_TIME_FIELDS) p[f] = time(formData.get(f));
  for (const f of EXTRA_TEXT_FIELDS) p[f] = text(formData.get(f));
  const approves = text(formData.get("brand_approves_in"));
  p.brand_approves_in = approves === "portal" || approves === "sheet" || approves === "email" ? approves : null;
  return p;
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------

export async function createCampaign(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const name = text(formData.get("campaign_name"));
  if (!name) redirect("/admin/campaigns/new?result=name-required");

  const base: Patch = {
    campaign_name: name,
    brand_id: text(formData.get("brand_id")),
    manager_person_id: text(formData.get("manager_person_id")),
    campaign_note: text(formData.get("campaign_note")),
    total_budget: num(formData.get("total_budget")),
    is_active: true,
    date_stamp: new Date().toISOString(),
    user_stamp: actor.email,
  };
  // The three Google Sheets are recorded as empty on purpose: creating
  // them is a later integration, and an empty link is honest.
  const extras: Patch = {
    campaign_type: campaignType(formData.get("campaign_type")),
    internal_sheet_link: null,
    external_sheet_link: null,
    performance_tracker_link: null,
  };

  const supabase = createServiceSupabase();
  let res = await supabase.from("campaigns").insert({ ...base, ...extras }).select("campaign_id").single();
  if (res.error && isMissingSchemaError(res.error)) {
    // Migration 084 not applied yet: create without the new columns.
    res = await supabase.from("campaigns").insert(base).select("campaign_id").single();
  }
  if (res.error || !res.data) {
    console.error("[admin/campaigns] create failed", res.error);
    redirect("/admin/campaigns/new?result=error");
  }

  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${res.data.campaign_id}?result=created`);
}

// ------------------------------------------------------------
// Save (edit screen)
// ------------------------------------------------------------

export async function saveCampaign(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = campaignIdFrom(formData);
  if (!id) redirect("/admin/campaigns");

  const base: Patch = {
    is_active: formData.get("is_active") === "on",
    is_auto_select: formData.get("is_auto_select") === "on",
    user_stamp: actor.email,
  };
  for (const f of TEXT_FIELDS) base[f] = text(formData.get(f));
  for (const f of NUMBER_FIELDS) base[f] = num(formData.get(f));
  for (const f of UUID_FIELDS) base[f] = text(formData.get(f));
  for (const f of DATE_FIELDS) base[f] = date(formData.get(f));
  if (!base.campaign_name) redirect(`/admin/campaigns/${id}/edit?result=name-required`);
  const extras = extrasPatch(formData);

  const supabase = createServiceSupabase();
  // SELECT before UPDATE: confirm the row exists and is the one we mean.
  const { data: existing, error: selErr } = await supabase
    .from("campaigns")
    .select("campaign_id")
    .eq("campaign_id", id)
    .maybeSingle();
  if (selErr || !existing) redirect(`/admin/campaigns/${id}/edit?result=error`);

  let extrasSkipped = false;
  let { error } = await supabase.from("campaigns").update({ ...base, ...extras }).eq("campaign_id", id);
  if (error && isMissingSchemaError(error)) {
    extrasSkipped = true;
    ({ error } = await supabase.from("campaigns").update(base).eq("campaign_id", id));
  }
  if (error) {
    console.error("[admin/campaigns] save failed", id, error);
    redirect(`/admin/campaigns/${id}/edit?result=error`);
  }

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  redirect(`/admin/campaigns/${id}/edit?result=${extrasSkipped ? "saved-partial" : "saved"}`);
}

// ------------------------------------------------------------
// Archive (the "delete zone" — never a hard delete)
// ------------------------------------------------------------

export async function archiveCampaign(formData: FormData) {
  const actor = await getAdminActor("admin");
  if (!actor) redirect("/admin/campaigns");

  const id = campaignIdFrom(formData);
  if (!id) redirect("/admin/campaigns");
  if (formData.get("confirm") !== "ARCHIVE") {
    redirect(`/admin/campaigns/${id}/edit?result=archive-unconfirmed`);
  }

  const supabase = createServiceSupabase();
  const { data: existing } = await supabase
    .from("campaigns")
    .select("campaign_id, is_active")
    .eq("campaign_id", id)
    .maybeSingle();
  if (!existing) redirect("/admin/campaigns");

  const { error } = await supabase
    .from("campaigns")
    .update({ is_active: false, user_stamp: actor.email })
    .eq("campaign_id", id);
  if (error) {
    console.error("[admin/campaigns] archive failed", id, error);
    redirect(`/admin/campaigns/${id}/edit?result=error`);
  }

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  redirect(`/admin/campaigns/${id}?result=archived`);
}

// ------------------------------------------------------------
// Select athletes (Opt-ins tab → "+ Select" / "Select & notify")
// ------------------------------------------------------------

export async function selectAthletes(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = campaignIdFrom(formData);
  if (!id) redirect("/admin/campaigns");
  const back = `/admin/campaigns/${id}?stage=optins`;

  const ids = formData
    .getAll("opt_in_id")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) redirect(`${back}&result=none-picked`);
  const notify = formData.get("notify") === "1";

  const supabase = createServiceSupabase();
  // SELECT first, scoped to this campaign, so a stray id from another
  // campaign can never be flipped.
  const { data: rows, error: selErr } = await supabase
    .from("campaign_opt_ins")
    .select("campaign_opt_in_id")
    .eq("campaign_id", id)
    .eq("is_optin", true)
    .in("campaign_opt_in_id", ids);
  if (selErr) redirect(`${back}&result=error`);
  const valid = (rows ?? []).map((r) => r.campaign_opt_in_id as number);
  if (valid.length === 0) redirect(`${back}&result=none-picked`);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("campaign_opt_ins")
    .update({
      is_selected: true,
      date_selected: now,
      selected_by: actor.id,
      notify,
      unselected_at: null,
    })
    .eq("campaign_id", id)
    .in("campaign_opt_in_id", valid);
  if (error) {
    console.error("[admin/campaigns] select failed", id, error);
    redirect(`${back}&result=error`);
  }

  // Keep the denormalised counter on the campaign row in step.
  const { count } = await supabase
    .from("campaign_opt_ins")
    .select("campaign_opt_in_id", { count: "exact", head: true })
    .eq("campaign_id", id)
    .eq("is_selected", true);
  await supabase.from("campaigns").update({ total_is_selected: count ?? valid.length }).eq("campaign_id", id);

  revalidatePath(`/admin/campaigns/${id}`);
  redirect(`/admin/campaigns/${id}?stage=selected&result=selected-${valid.length}${notify ? "-notify" : ""}`);
}

// ------------------------------------------------------------
// Attach / detach a saved audience (campaign_audiences, migration 084)
// ------------------------------------------------------------

export async function attachAudience(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = campaignIdFrom(formData);
  if (!id) redirect("/admin/campaigns");
  const audienceId = text(formData.get("audience_id"));
  const back = `/admin/campaigns/${id}?stage=audience`;
  if (!audienceId) redirect(back);

  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("campaign_audiences")
    .upsert({ campaign_id: id, audience_id: audienceId, attached_by: actor.id }, { onConflict: "campaign_id,audience_id" });
  if (error) {
    console.error("[admin/campaigns] attach audience failed", id, error);
    redirect(`${back}&result=${isMissingSchemaError(error) ? "audiences-pending" : "error"}`);
  }
  revalidatePath(`/admin/campaigns/${id}`);
  redirect(`${back}&audience=${audienceId}&result=audience-attached`);
}

export async function detachAudience(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = campaignIdFrom(formData);
  if (!id) redirect("/admin/campaigns");
  const audienceId = text(formData.get("audience_id"));
  const back = `/admin/campaigns/${id}?stage=audience`;
  if (!audienceId) redirect(back);

  const supabase = createServiceSupabase();
  const { data: existing } = await supabase
    .from("campaign_audiences")
    .select("audience_id")
    .eq("campaign_id", id)
    .eq("audience_id", audienceId)
    .maybeSingle();
  if (existing) {
    await supabase.from("campaign_audiences").delete().eq("campaign_id", id).eq("audience_id", audienceId);
  }
  revalidatePath(`/admin/campaigns/${id}`);
  redirect(`${back}&result=audience-removed`);
}

// ------------------------------------------------------------
// Opt-in page (builder → campaign_optin_pages)
// ------------------------------------------------------------

export async function saveOptinPage(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = campaignIdFrom(formData);
  if (!id) redirect("/admin/campaigns");
  const back = `/admin/campaigns/${id}/page`;

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("data") ?? "{}"));
  } catch {
    redirect(`${back}?result=error`);
  }
  const data = parseOptinPage(parsed);
  const { base, extras } = toRow(id, data);

  const supabase = createServiceSupabase();
  const { data: campaign } = await supabase.from("campaigns").select("campaign_id").eq("campaign_id", id).maybeSingle();
  if (!campaign) redirect("/admin/campaigns");

  let extrasSkipped = false;
  let { error } = await supabase
    .from("campaign_optin_pages")
    .upsert({ ...base, ...extras, updated_by: actor.id }, { onConflict: "campaign_id" });
  if (error && isMissingSchemaError(error)) {
    extrasSkipped = true;
    ({ error } = await supabase
      .from("campaign_optin_pages")
      .upsert({ ...base, updated_by: actor.id }, { onConflict: "campaign_id" }));
  }
  if (error) {
    console.error("[admin/campaigns] opt-in page save failed", id, error);
    redirect(`${back}?result=error`);
  }

  // Athlete contract lives on the campaign row (083: contract_title, contract).
  const contractTitle = text(formData.get("contract_title"));
  const contract = text(formData.get("contract"));
  if (formData.has("contract")) {
    await supabase
      .from("campaigns")
      .update({ contract_title: contractTitle, contract, user_stamp: actor.email })
      .eq("campaign_id", id);
  }

  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath(`/admin/campaigns/${id}/page`);
  revalidatePath(`/join/${id}`);
  redirect(`${back}?result=${extrasSkipped ? "saved-partial" : "saved"}`);
}
