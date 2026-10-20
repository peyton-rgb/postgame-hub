// ============================================================
// /admin/audiences/new — Make an audience (the prototype's
// S["audience-new"]). Also edits a saved one: ?id=<saved_audiences id>.
//
// The form (AudienceBuilder, client) mirrors its filters into this
// page's URL; this server page answers with the exact count from
// `people`, a plain-English summary and the next steps. The CSV
// download works today; saving needs saved_audiences (migration 083).
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { Card } from "@/components/admin/campaign/bits";
import { Note } from "@/components/admin/people/bits";
import AudienceBuilder from "@/components/admin/people/AudienceBuilder";
import type { AudienceDraft } from "@/components/admin/people/audience-types";
import {
  audienceQuery,
  buildAudienceFilters,
  countAudience,
  describeAudience,
  resolveExcludedPeople,
  savedFiltersToParams,
} from "@/lib/admin/audience";
import { applyAthleteBase, applyAthleteLevel, ATHLETE_LEVELS } from "@/lib/admin/athletes";
import { KNOWN_SPORTS } from "@/lib/team-folders";

export const dynamic = "force-dynamic";

const US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");

const CSV_COLS = ["First name", "Last name", "Instagram", "Instagram followers", "TikTok", "College", "Sport", "Gender", "State", "Rating", "NIL value", "On the app"];

const RESULT: Record<string, string> = {
  pending: "Saving audiences needs the saved_audiences table (migration 083, written, not applied). Your filters are still here, and Download CSV works now.",
  error: "Save failed. Nothing was changed.",
};

export default async function NewAudiencePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const db = supabase as any; // saved_audiences (083) is not in the generated types yet

  // Editing a saved audience with no filters in the URL yet → start from the saved ones.
  let sp: Record<string, string | undefined> = { ...searchParams };
  let savedName = "";
  let savedDescription = "";
  const id = /^[0-9a-f-]{36}$/i.test(searchParams.id ?? "") ? searchParams.id! : null;
  if (id) {
    const saved = await safeQuery<{ name: string; description: string | null; filters: Record<string, unknown> }>(
      () => db.from("saved_audiences").select("name, description, filters").eq("id", id).maybeSingle()
    );
    if (saved.data) {
      savedName = saved.data.name;
      savedDescription = saved.data.description ?? "";
      if (!searchParams.levels) sp = { ...savedFiltersToParams(saved.data.filters), id, name: searchParams.name };
    }
  }
  if (sp.levels == null) sp.levels = "college";

  const f = buildAudienceFilters(sp);
  const excluded = await resolveExcludedPeople(supabase, f);

  const head = () => supabase.from("people").select("id", { count: "exact", head: true });
  const [count, collegesRes, campaignsRes, ...levelCounts] = await Promise.all([
    countAudience(supabase, f, excluded),
    supabase.from("colleges").select("name").order("name").limit(1500),
    supabase.from("campaign_recaps").select("id, name, client_name").order("created_at", { ascending: false }).limit(200),
    ...ATHLETE_LEVELS.map((l) => applyAthleteLevel(applyAthleteBase(head()).eq("is_active", true), l.key)),
  ]);

  const campaigns = ((campaignsRes.data ?? []) as Array<{ id: string; name: string | null; client_name: string | null }>).map((c) => ({
    id: c.id,
    label: [c.client_name, c.name].filter(Boolean).join(" – ") || "Untitled campaign",
  }));
  const campaignNames = new Map(campaigns.map((c) => [c.id, c.label]));
  const lines = describeAudience(f, campaignNames);
  const csvHref = `/admin/audiences/export?${audienceQuery(f)}`;

  const draft: AudienceDraft = {
    id,
    name: sp.name ?? savedName,
    description: savedDescription,
    include: f.include,
    levels: f.levels ?? ["college", "high_school", "pro", "former"],
    influencers: f.influencersOnly,
    handles: f.handles.join("\n"),
    states: f.states,
    genders: f.genders,
    colleges: f.colleges,
    sports: f.sports,
    min: f.minFollowers != null ? String(f.minFollowers) : "",
    max: f.maxFollowers != null ? String(f.maxFollowers) : "",
    rating: f.rating,
    exclude: f.exclude.join("\n"),
    excludeCampaigns: f.excludeCampaigns,
  };

  const picked = /^\d+$/.test(searchParams.picked ?? "") ? parseInt(searchParams.picked!, 10) : null;
  const result = searchParams.result ? RESULT[searchParams.result] : null;

  const side = (
    <div className="space-y-4">
      {result && (
        <div className="rounded-lg border border-status-warn bg-amber-50 px-4 py-3 text-[13px] text-status-warn">{result}</div>
      )}
      <Card title="Who's in it">
        <div className="text-[32px] font-semibold leading-none tabular-nums text-stone-900">
          {count.error ? "—" : count.total.toLocaleString("en-US")}
        </div>
        <div className="mt-1 text-[12px] text-stone-500">{count.error ? count.error : "athletes match · live from the people table"}</div>
        <div className="mt-3 grid gap-1.5 text-[13px]">
          {lines.length === 0 ? (
            <div className="text-stone-500">No filters yet: every active college athlete matches.</div>
          ) : (
            lines.map((l) => (
              <div key={l.k}>
                <span className="text-stone-500">{l.k}:</span> <span className="text-stone-800">{l.v}</span>
              </div>
            ))
          )}
          {f.handles.length > 0 && count.byHandle < f.handles.length && (
            <div className="text-[12px] text-stone-500">
              {(f.handles.length - count.byHandle).toLocaleString()} pasted handle{f.handles.length - count.byHandle === 1 ? "" : "s"} didn&apos;t
              match an active athlete.
            </div>
          )}
        </div>
        <div className="mt-4 border-t border-stone-200 pt-3">
          <div className="mb-2 text-[12px] text-stone-500">After saving, use it to</div>
          <div className="grid gap-1.5">
            <span className="rounded-md border border-stone-200 px-2.5 py-1.5 text-[12px] text-stone-400" title="Opens from a campaign's Athletes card once the audience is saved">
              Invite to a campaign
            </span>
            <a href="/admin/mobile-app/cards" className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[12px] font-medium text-stone-700 hover:border-stone-400">
              Target an app card
            </a>
            <a href={csvHref} className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[12px] font-medium text-stone-700 hover:border-stone-400">
              Download the list (CSV)
            </a>
          </div>
        </div>
        <div className="mt-4 border-t border-stone-200 pt-3">
          <div className="mb-1.5 text-[12px] text-stone-500">The CSV includes</div>
          <div className="flex flex-wrap gap-1">
            {CSV_COLS.map((c) => (
              <span key={c} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
                {c}
              </span>
            ))}
          </div>
        </div>
      </Card>
      <Note>
        Same fields as the ColdFusion audience form, on one page. ColdFusion makes you save a name first and then add filters on a
        second screen.
      </Note>
    </div>
  );

  return (
    <AudienceBuilder
      key={id ?? "new"}
      initial={draft}
      pickedNote={picked}
      side={side}
      options={{
        states: US_STATES,
        colleges: ((collegesRes.data ?? []) as { name: string | null }[]).map((c) => c.name).filter((n): n is string => !!n),
        sports: KNOWN_SPORTS as unknown as string[],
        campaigns,
        levelCounts: Object.fromEntries(
          ATHLETE_LEVELS.map((l, i) => [l.key, levelCounts[i]?.count ?? null])
        ) as Record<"college" | "high_school" | "pro" | "former", number | null>,
      }}
    />
  );
}
