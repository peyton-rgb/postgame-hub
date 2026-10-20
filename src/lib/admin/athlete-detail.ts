// ============================================================
// Loaders for the athlete and profile detail screens
// (/admin/athletes/[id], /admin/profiles/[id]). Server only.
//
// The person is a `people` row (id = people.id, the same id
// /admin/users/[id] edits). Campaign history comes from the recap
// rosters: `athletes.person_id` → `campaign_recaps` → `brands`.
// `athletes` here is the RECAP ROSTER table, not a list of athletes.
// ============================================================

export const PERSON_DETAIL_COLUMNS =
  "id, admin_user_id, first_name, last_name, email, phone, instagram_handle, instagram_followers, tiktok_handle, tiktok_followers, person_type, roster_status, college_id, college_raw, college_city, college_state, sport, gender, nil_value, nil_value_synced_at, rating, is_active, is_archived, is_international, hometown_city, hometown_state, device, admin_created_at, imported_at, admin_profile_id, dnw_flag, dnw_reason, colleges(name, ncaa_division, state)";

export interface PersonDetail {
  id: string;
  admin_user_id: number | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
  tiktok_handle: string | null;
  tiktok_followers: number | null;
  person_type: string | null;
  roster_status: string | null;
  college_id: number | null;
  college_raw: string | null;
  college_city: string | null;
  college_state: string | null;
  sport: string | null;
  gender: string | null;
  nil_value: number | null;
  nil_value_synced_at: string | null;
  rating: string | null;
  is_active: boolean | null;
  is_archived: boolean | null;
  is_international: boolean | null;
  hometown_city: string | null;
  hometown_state: string | null;
  device: string | null;
  admin_created_at: string | null;
  imported_at: string | null;
  admin_profile_id: number | null;
  dnw_flag: boolean | null;
  dnw_reason: string | null;
  colleges: { name: string | null; ncaa_division: string | null; state: string | null } | null;
}

export interface PersonCampaign {
  rosterId: string;
  recapId: string;
  name: string;
  brandName: string | null;
  logo: string | null;
  adminCampaignId: string | null;
  status: string | null;
  date: string | null;
  postType: string | null;
  postUrl: string | null;
  stage: string | null;
  approval: string | null;
}

export async function loadPerson(supabase: any, id: string): Promise<{ person: PersonDetail | null; error: string | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { person: null, error: null };
  const { data, error } = await supabase.from("people").select(PERSON_DETAIL_COLUMNS).eq("id", id).maybeSingle();
  return { person: (data as PersonDetail) ?? null, error: error?.message ?? null };
}

export async function loadPersonCampaigns(supabase: any, personId: string): Promise<PersonCampaign[]> {
  const { data: roster } = await supabase
    .from("athletes")
    .select("id, campaign_id, post_type, post_url, funnel_stage, brand_approval_status, created_at")
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (roster ?? []) as Array<{
    id: string;
    campaign_id: string | null;
    post_type: string | null;
    post_url: string | null;
    funnel_stage: string | null;
    brand_approval_status: string | null;
    created_at: string | null;
  }>;
  const ids = Array.from(new Set(rows.map((r) => r.campaign_id).filter((x): x is string => !!x)));
  if (!ids.length) return [];
  const { data: recaps } = await supabase
    .from("campaign_recaps")
    .select("id, name, client_name, brand_id, admin_campaign_id, status, admin_created_on, created_at")
    .in("id", ids);
  const recapById = new Map<string, any>(((recaps ?? []) as any[]).map((r) => [r.id, r]));
  const brandIds = Array.from(new Set(((recaps ?? []) as any[]).map((r) => r.brand_id).filter(Boolean)));
  const { data: brands } = brandIds.length
    ? await supabase.from("brands").select("id, name, logo_dark_url, logo_primary_url, logo_mark_url").in("id", brandIds)
    : { data: [] };
  const brandById = new Map<string, any>(((brands ?? []) as any[]).map((b) => [b.id, b]));

  // One line per campaign (an athlete can have several roster rows in one recap).
  const seen = new Set<string>();
  const out: PersonCampaign[] = [];
  for (const r of rows) {
    if (!r.campaign_id || seen.has(r.campaign_id)) continue;
    seen.add(r.campaign_id);
    const c = recapById.get(r.campaign_id);
    if (!c) continue;
    const b = c.brand_id ? brandById.get(c.brand_id) : null;
    out.push({
      rosterId: r.id,
      recapId: c.id,
      name: c.name ?? "Untitled campaign",
      brandName: b?.name ?? c.client_name ?? null,
      logo: b ? b.logo_dark_url || b.logo_primary_url || b.logo_mark_url || null : null,
      adminCampaignId: c.admin_campaign_id ?? null,
      status: c.status ?? null,
      date: c.admin_created_on ?? c.created_at ?? null,
      postType: r.post_type,
      postUrl: r.post_url,
      stage: r.funnel_stage,
      approval: r.brand_approval_status,
    });
  }
  return out;
}

export function personName(p: { first_name: string | null; last_name: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed athlete";
}

export function fmtDay(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function genderLabel(g: string | null): string {
  return g === "M" ? "Men" : g === "W" ? "Women" : g === "N" ? "Non-binary" : g ?? "—";
}
