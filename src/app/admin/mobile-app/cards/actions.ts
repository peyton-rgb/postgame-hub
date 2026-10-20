"use server";

// ============================================================
// Mobile app cards — write path. Staff-gated, audit-logged, every
// change scoped by id: SELECT the row, write it, SELECT to verify.
//
//   saveCard       create / update one card (+ its whitelist rows)
//   setCardStatus  the Live / Off switch on the editor header
//   reorderCards   drag-and-drop order from the list (sort_order)
//   deleteCard     trash icon on the list, confirmed first
//
// Table: mobile_app_cards (migration 086). When the table or one of
// its 086 columns is missing the action stops before writing and
// reports "pending086" — nothing half-saves.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import {
  CARD_STATUSES,
  CARD_TYPES,
  type CardDraft,
  type CardStatus,
  type CardType,
  type Whitelist,
} from "@/lib/admin/mobile-app/types";

const LIST = "/admin/mobile-app/cards";

function revalidate(id?: string) {
  revalidatePath(LIST);
  revalidatePath("/admin/mobile-app/feed");
  if (id) revalidatePath(`${LIST}/${id}`);
}

// ------------------------------------------------------------
// Parsing the editor's JSON
// ------------------------------------------------------------

function text(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t.slice(0, max);
}

/** https URL or null; undefined = present but not a URL. */
function url(v: unknown): string | null | undefined {
  const t = text(v);
  if (t === null) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** CTA destination: https URL or an in-app path (/campaigns/123). */
function href(v: unknown): string | null | undefined {
  const t = text(v);
  if (t === null) return null;
  if (t.startsWith("/")) return t;
  return url(t);
}

function hex(v: unknown): string | null | undefined {
  const t = text(v);
  if (t === null) return null;
  return /^#[0-9a-f]{6}$/i.test(t) ? t.toUpperCase() : undefined;
}

/** datetime-local value → ISO, or null. undefined = unparsable. */
function when(v: unknown): string | null | undefined {
  const t = text(v);
  if (t === null) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function tags(v: unknown, kind: "college" | "sport" | "handle"): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    let t = x.trim().slice(0, 120);
    if (!t) continue;
    if (kind === "handle") t = t.replace(/^@/, "").toLowerCase();
    seen.add(t);
  }
  return Array.from(seen).slice(0, 500);
}

interface Parsed {
  row: {
    name: string;
    card_type: CardType;
    status: CardStatus;
    brand_id: string | null;
    campaign_id: number | null;
    headline: string | null;
    eyebrow: string | null;
    body: string | null;
    cta_label: string | null;
    cta_href: string | null;
    bg_color: string | null;
    media_url: string | null;
    poster_url: string | null;
    visibility: "everyone" | "whitelist";
    audience_id: string | null;
    schedule_start: string | null;
    schedule_end: string | null;
  };
  whitelist: Whitelist;
}

function parseDraft(raw: string, status: CardStatus): { parsed: Parsed | null; problem: string | null } {
  let d: Partial<CardDraft>;
  try {
    d = JSON.parse(raw) as Partial<CardDraft>;
  } catch {
    return { parsed: null, problem: "bad-json" };
  }
  const card_type = (CARD_TYPES as readonly string[]).includes(String(d.card_type)) ? (d.card_type as CardType) : null;
  if (!card_type) return { parsed: null, problem: "bad-type" };

  const media_url = url(d.media_url);
  const poster_url = url(d.poster_url);
  const cta_href = href(d.cta_href);
  const bg_color = hex(d.bg_color);
  const schedule_start = when(d.schedule_start);
  const schedule_end = when(d.schedule_end);
  if (media_url === undefined || poster_url === undefined) return { parsed: null, problem: "bad-media-url" };
  if (cta_href === undefined) return { parsed: null, problem: "bad-cta-url" };
  if (bg_color === undefined) return { parsed: null, problem: "bad-color" };
  if (schedule_start === undefined || schedule_end === undefined) return { parsed: null, problem: "bad-schedule" };
  if (schedule_start && schedule_end && schedule_start > schedule_end) return { parsed: null, problem: "schedule-order" };

  const campaign_id =
    typeof d.campaign_id === "number" && Number.isInteger(d.campaign_id) && d.campaign_id > 0 ? d.campaign_id : null;
  const brand_id = typeof d.brand_id === "string" && /^[0-9a-f-]{36}$/i.test(d.brand_id) ? d.brand_id : null;
  const audience_id = typeof d.audience_id === "string" && /^[0-9a-f-]{36}$/i.test(d.audience_id) ? d.audience_id : null;
  const visibility = d.visibility === "whitelist" ? "whitelist" : "everyone";
  const w = (d.whitelist ?? {}) as Partial<Whitelist>;

  return {
    parsed: {
      row: {
        name: text(d.name, 200) ?? "Untitled card",
        card_type,
        status,
        brand_id,
        campaign_id: card_type === "optin" ? campaign_id : null,
        headline: text(d.headline, 200),
        eyebrow: text(d.eyebrow, 60),
        body: text(d.body, 1000),
        cta_label: text(d.cta_label, 40),
        cta_href,
        bg_color,
        media_url,
        poster_url,
        visibility,
        audience_id: visibility === "whitelist" ? audience_id : null,
        schedule_start,
        schedule_end,
      },
      whitelist:
        visibility === "whitelist"
          ? { colleges: tags(w.colleges, "college"), sports: tags(w.sports, "sport"), handles: tags(w.handles, "handle") }
          : { colleges: [], sports: [], handles: [] },
    },
    problem: null,
  };
}

async function writeWhitelist(
  supabase: ReturnType<typeof createServiceSupabase>,
  cardId: string,
  w: Whitelist
): Promise<"ok" | "pending" | "error"> {
  // SELECT what is there, DELETE by card_id, INSERT the new rows.
  const before = await supabase.from("mobile_app_card_whitelist").select("id").eq("card_id", cardId);
  if (before.error) return isMissingSchemaError(before.error) ? "pending" : "error";
  if ((before.data ?? []).length > 0) {
    const del = await supabase.from("mobile_app_card_whitelist").delete().eq("card_id", cardId);
    if (del.error) return "error";
  }
  const rows = [
    ...w.colleges.map((value) => ({ card_id: cardId, kind: "college", value })),
    ...w.sports.map((value) => ({ card_id: cardId, kind: "sport", value })),
    ...w.handles.map((value) => ({ card_id: cardId, kind: "handle", value })),
  ];
  if (rows.length === 0) return "ok";
  const ins = await supabase.from("mobile_app_card_whitelist").insert(rows);
  return ins.error ? "error" : "ok";
}

// ------------------------------------------------------------
// saveCard — create or update
// ------------------------------------------------------------

export async function saveCard(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = text(formData.get("id"), 40);
  const intent = String(formData.get("intent") ?? "draft");
  const backTo = id ? `${LIST}/${id}` : `${LIST}/new`;

  const status: CardStatus = intent === "publish" ? "live" : intent === "archive" ? "archived" : "draft";
  const { parsed, problem } = parseDraft(String(formData.get("data") ?? "{}"), status);
  if (!parsed) redirect(`${backTo}?result=${problem}`);

  const supabase = createServiceSupabase();

  if (id) {
    // 1 · SELECT the row we are about to change
    const before = await supabase.from("mobile_app_cards").select("*").eq("id", id).maybeSingle();
    if (before.error) redirect(`${backTo}?result=${isMissingSchemaError(before.error) ? "pending086" : "error"}`);
    if (!before.data) redirect(`${LIST}?result=notfound`);

    // 2 · UPDATE, scoped by id
    const updated = await supabase.from("mobile_app_cards").update(parsed.row).eq("id", id).select("id, status, name").maybeSingle();
    if (updated.error) {
      console.error("[mobile-app/cards] update failed", updated.error);
      redirect(`${backTo}?result=${isMissingSchemaError(updated.error) ? "pending086" : "error"}`);
    }
    // 3 · verify
    if (!updated.data || updated.data.status !== status) redirect(`${backTo}?result=error`);

    const wl = await writeWhitelist(supabase, id, parsed.whitelist);
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "mobile_app_card.update",
      entity: "mobile_app_cards",
      entityId: id,
      before: before.data,
      after: { ...parsed.row, whitelist: parsed.whitelist },
    });
    revalidate(id);
    redirect(`${backTo}?result=${wl === "ok" ? (status === "live" ? "published" : "saved") : wl === "pending" ? "saved-nowhitelist" : "saved-whitelist-error"}`);
  }

  // New card goes to the end of the list.
  const last = await supabase.from("mobile_app_cards").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (last.error) redirect(`${backTo}?result=${isMissingSchemaError(last.error) ? "pending086" : "error"}`);
  const sort_order = ((last.data as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const inserted = await supabase
    .from("mobile_app_cards")
    .insert({ ...parsed.row, sort_order })
    .select("id")
    .maybeSingle();
  if (inserted.error || !inserted.data) {
    console.error("[mobile-app/cards] insert failed", inserted.error);
    redirect(`${backTo}?result=${inserted.error && isMissingSchemaError(inserted.error) ? "pending086" : "error"}`);
  }
  const newId = String(inserted.data.id);
  const wl = await writeWhitelist(supabase, newId, parsed.whitelist);

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "mobile_app_card.create",
    entity: "mobile_app_cards",
    entityId: newId,
    before: null,
    after: { ...parsed.row, sort_order, whitelist: parsed.whitelist },
  });
  revalidate(newId);
  redirect(`${LIST}/${newId}?result=${wl === "ok" ? (status === "live" ? "published" : "created") : "saved-whitelist-error"}`);
}

// ------------------------------------------------------------
// setCardStatus — the Live / Off switch
// ------------------------------------------------------------

export async function setCardStatus(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = text(formData.get("id"), 40);
  const status = String(formData.get("status") ?? "") as CardStatus;
  const returnTo = String(formData.get("return_to") ?? "") === "list" ? LIST : id ? `${LIST}/${id}` : LIST;
  if (!id || !(CARD_STATUSES as readonly string[]).includes(status)) redirect(`${returnTo}?result=error`);

  const supabase = createServiceSupabase();
  const before = await supabase.from("mobile_app_cards").select("id, name, status").eq("id", id).maybeSingle();
  if (before.error) redirect(`${returnTo}?result=${isMissingSchemaError(before.error) ? "pending086" : "error"}`);
  if (!before.data) redirect(`${LIST}?result=notfound`);
  if (before.data.status === status) redirect(`${returnTo}?result=unchanged`);

  const updated = await supabase.from("mobile_app_cards").update({ status }).eq("id", id).select("id, status").maybeSingle();
  if (updated.error || updated.data?.status !== status) redirect(`${returnTo}?result=error`);

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "mobile_app_card.status",
    entity: "mobile_app_cards",
    entityId: id,
    before: { status: before.data.status },
    after: { status },
  });
  revalidate(id);
  redirect(`${returnTo}?result=${status === "live" ? "went-live" : status === "draft" ? "went-off" : "archived"}`);
}

// ------------------------------------------------------------
// reorderCards — called straight from the list's drag handles
// ------------------------------------------------------------

export interface ReorderResult {
  ok: boolean;
  message: string;
}

export async function reorderCards(formData: FormData): Promise<ReorderResult> {
  const actor = await getAdminActor("staff");
  if (!actor) return { ok: false, message: "Not signed in." };

  let ids: string[];
  try {
    const parsed = JSON.parse(String(formData.get("ids") ?? "[]"));
    ids = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, 500) : [];
  } catch {
    return { ok: false, message: "Bad order payload." };
  }
  if (ids.length === 0) return { ok: true, message: "Nothing to reorder." };

  const supabase = createServiceSupabase();
  // 1 · SELECT the rows we are about to touch (all of them must exist).
  const before = await supabase.from("mobile_app_cards").select("id, sort_order").in("id", ids);
  if (before.error) {
    return { ok: false, message: isMissingSchemaError(before.error) ? "Cards table not migrated yet (migration 086)." : before.error.message };
  }
  const found = new Set((before.data ?? []).map((r) => String(r.id)));
  if (found.size !== ids.length) return { ok: false, message: "A card in that list no longer exists — refresh and try again." };

  // 2 · UPDATE each by id with its new position.
  for (let i = 0; i < ids.length; i++) {
    const res = await supabase.from("mobile_app_cards").update({ sort_order: i }).eq("id", ids[i]).select("id, sort_order").maybeSingle();
    if (res.error || res.data?.sort_order !== i) return { ok: false, message: "Order didn't save. Refresh to see the current order." };
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "mobile_app_card.reorder",
    entity: "mobile_app_cards",
    entityId: null,
    before: before.data,
    after: ids.map((id, sort_order) => ({ id, sort_order })),
  });
  revalidate();
  return { ok: true, message: "Order saved." };
}

// ------------------------------------------------------------
// deleteCard
// ------------------------------------------------------------

export async function deleteCard(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = text(formData.get("id"), 40);
  if (!id) redirect(`${LIST}?result=error`);

  const supabase = createServiceSupabase();
  const before = await supabase.from("mobile_app_cards").select("*").eq("id", id).maybeSingle();
  if (before.error) redirect(`${LIST}?result=${isMissingSchemaError(before.error) ? "pending086" : "error"}`);
  if (!before.data) redirect(`${LIST}?result=notfound`);

  // Whitelist rows cascade with the card (086), but clear them explicitly
  // so an 083-shaped whitelist table can't keep an orphan either.
  await supabase.from("mobile_app_card_whitelist").delete().eq("card_id", id);
  const del = await supabase.from("mobile_app_cards").delete().eq("id", id).select("id");
  if (del.error) redirect(`${LIST}?result=error`);
  const after = await supabase.from("mobile_app_cards").select("id").eq("id", id).maybeSingle();
  if (after.data) redirect(`${LIST}?result=error`);

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "mobile_app_card.delete",
    entity: "mobile_app_cards",
    entityId: id,
    before: before.data,
    after: null,
  });
  revalidate(id);
  redirect(`${LIST}?result=deleted`);
}
