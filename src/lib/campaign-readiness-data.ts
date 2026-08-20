/**
 * campaign-readiness-data — the bulk read behind /dashboard/readiness.
 *
 * SERVER ONLY (imports next/headers via supabase-server). Types, column order
 * and link targets live in campaign-readiness.ts so the client can share them.
 *
 * Seven queries for all 626 campaigns — no per-row lookups. A query inside the
 * row loop would be ~7,500 round trips on the Hub's landing page.
 */
import { createServerSupabase } from "@/lib/supabase-server";
import { COLUMNS, SCORE, kitScore, pickLogo, txt } from "@/lib/campaign-readiness";
import type { ColumnKey, ReadinessRow, State } from "@/lib/campaign-readiness";

export interface ReadinessData {
  rows: ReadinessRow[];
  liveCount: number;
  totalCount: number;
}

export async function getReadiness(): Promise<ReadinessData> {
  const supabase = createServerSupabase();

  const [recapsRes, brandsRes, csRes, pressRes, subRes, mediaRes, athletesRes] = await Promise.all([
    supabase
      .from("campaign_recaps")
      .select("id,name,slug,admin_campaign_id,admin_is_active,brand_id,drive_folder_id,frameio_url,brief_url,published,visibility")
      .limit(5000),
    supabase.from("brands").select("*").limit(5000),
    supabase.from("case_study_campaigns").select("campaign_recap_id").limit(20000),
    supabase.from("press_campaigns").select("campaign_recap_id").limit(20000),
    supabase.from("submission_links").select("campaign_id").eq("active", true).limit(20000),
    supabase.from("media").select("campaign_id").limit(50000),
    supabase.from("athletes").select("campaign_id").limit(50000),
  ]);

  // Surface failures rather than silently rendering an empty landing page.
  for (const [label, res] of [
    ["campaign_recaps", recapsRes], ["brands", brandsRes], ["case_study_campaigns", csRes],
    ["press_campaigns", pressRes], ["submission_links", subRes], ["media", mediaRes],
    ["athletes", athletesRes],
  ] as const) {
    if (res.error) throw new Error(`readiness: ${label} query failed — ${res.error.message}`);
  }

  const brandsById = new Map<string, Record<string, unknown>>();
  for (const b of (brandsRes.data ?? []) as Record<string, unknown>[]) {
    if (typeof b.id === "string") brandsById.set(b.id, b);
  }

  const idSet = (rows: unknown[] | null, key: string) => {
    const s = new Set<string>();
    for (const r of (rows ?? []) as Record<string, unknown>[]) {
      const v = r[key];
      if (typeof v === "string" && v) s.add(v);
    }
    return s;
  };

  const hasCaseStudy = idSet(csRes.data, "campaign_recap_id");
  const hasPress = idSet(pressRes.data, "campaign_recap_id");
  const hasSubmission = idSet(subRes.data, "campaign_id");
  const hasMedia = idSet(mediaRes.data, "campaign_id");
  const hasRoster = idSet(athletesRes.data, "campaign_id");

  const rows: ReadinessRow[] = [];
  let liveCount = 0;

  for (const c of (recapsRes.data ?? []) as Record<string, unknown>[]) {
    const id = String(c.id);
    const brandRaw = typeof c.brand_id === "string" ? brandsById.get(c.brand_id) : undefined;
    const kitCount = kitScore(brandRaw);
    const { url: logoUrl, chip } = pickLogo(brandRaw);

    const live = c.admin_is_active === true;
    if (live) liveCount++;

    const driveFolderId = txt(c.drive_folder_id);
    const frameioUrl = txt(c.frameio_url);
    const briefUrl = txt(c.brief_url);

    // Recap: published = live; any media or roster = draft; else nothing.
    // NOT lifecycle_status — it reads 'draft' on every row including published ones.
    const recap: State = c.published === true ? "g" : hasMedia.has(id) || hasRoster.has(id) ? "y" : "r";

    const states: Record<ColumnKey, State> = {
      drive: driveFolderId ? "g" : "r",
      frameio: frameioUrl ? "g" : "r",
      kit: kitCount === 4 ? "g" : kitCount > 0 ? "y" : "r",
      brief: briefUrl ? "g" : "r",
      // Both are permanently 'r'. optin_campaigns.admin_campaign_id is null on
      // every row; campaign_instructions has no campaign key at all. Neither
      // can be joined to a campaign — see the COLUMNS comment in
      // campaign-readiness.ts before assuming either is a bug.
      optin: "r",
      instructions: "r",
      submission: hasSubmission.has(id) ? "g" : "r",
      recap,
      clients: brandRaw?.show_on_clients_page === true ? "g" : "r",
      campaign: c.published === true && (c as { visibility?: string }).visibility === "public" ? "g" : "r",
      casestudy: hasCaseStudy.has(id) ? "g" : "r",
      press: hasPress.has(id) ? "g" : "r",
    };

    rows.push({
      id,
      name: txt(c.name) ?? "Untitled campaign",
      slug: txt(c.slug),
      adminId: txt(c.admin_campaign_id),
      live,
      brand: brandRaw
        ? {
            id: String(brandRaw.id),
            name: txt(brandRaw.name) ?? "Unnamed brand",
            slug: txt(brandRaw.slug),
            logoUrl,
            chip,
          }
        : null,
      driveFolderId,
      frameioUrl,
      briefUrl,
      kitCount,
      states,
      score: COLUMNS.reduce((n, k) => n + SCORE[states[k]], 0),
    });
  }

  // Least-ready first — the page opens on work.
  rows.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

  return { rows, liveCount, totalCount: rows.length };
}

