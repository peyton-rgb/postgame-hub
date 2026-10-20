// ============================================================
// /admin/campaigns/[id] — the campaign page, rebuilt to the approved
// prototype: header (pills, facts, actions) · three tiles · Campaign
// Playbook + Campaign setup · the five-stage Athletes card.
//
// Server component. Tabs, the audience pane and search are URL
// params (?stage= ?audience= ?q=). Every figure is a count of real
// rows; nothing is invented. Columns from migration 084 are read
// through the feature-detected loader and show "—" until it lands.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import {
  loadAthleteStages,
  loadAudiencePane,
  loadCampaign,
  loadPlaybook,
  type Stage,
} from "@/lib/admin/campaigns/queries";
import CampaignHeader from "@/components/admin/campaign/CampaignHeader";
import PlaybookCard from "@/components/admin/campaign/PlaybookCard";
import SetupCard from "@/components/admin/campaign/SetupCard";
import AthletesCard from "@/components/admin/campaign/AthletesCard";

export const dynamic = "force-dynamic";

const STAGE_KEYS: Stage[] = ["audience", "optins", "selected", "affiliates", "paid"];

const RESULT_NOTES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  created: { tone: "ok", text: "Campaign created. Add the playbook files and build the opt-in page when you're ready." },
  archived: { tone: "ok", text: "Campaign archived. It's hidden from the active list; reactivate it from Edit campaign." },
  "audience-attached": { tone: "ok", text: "Audience attached." },
  "audience-removed": { tone: "ok", text: "Audience removed from this campaign." },
  "audiences-pending": { tone: "bad", text: "Attaching audiences needs migration 20261020_084 applied first. Nothing was changed." },
  "none-picked": { tone: "bad", text: "Pick at least one athlete first." },
  error: { tone: "bad", text: "That didn't save. Nothing was changed." },
};

function resultNote(result: string | undefined): { tone: "ok" | "bad"; text: string } | null {
  if (!result) return null;
  if (RESULT_NOTES[result]) return RESULT_NOTES[result];
  const m = /^selected-(\d+)(-notify)?$/.exec(result);
  if (m) {
    return {
      tone: "ok",
      text: `${m[1]} athlete${m[1] === "1" ? "" : "s"} selected${m[2] ? " and queued to be notified in the app" : ""}.`,
    };
  }
  return null;
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const id = Number(params.id);

  const { bundle, error } = await loadCampaign(supabase, id);
  if (error || !bundle) {
    return (
      <div>
        <PageHeader title="Campaign" />
        <ErrorNote message={error ? `Could not load campaign: ${error}` : "Campaign not found."} />
        <Link href="/admin/campaigns" className="mt-4 inline-block text-[13px] text-[#D73F09]">
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  const stage: Stage = STAGE_KEYS.includes(searchParams.stage as Stage) ? (searchParams.stage as Stage) : "optins";
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const audienceId = /^[0-9a-f-]{36}$/i.test(searchParams.audience ?? "") ? searchParams.audience! : null;

  const [stages, playbook, audiencePane] = await Promise.all([
    loadAthleteStages(supabase, id),
    loadPlaybook(supabase, id),
    stage === "audience"
      ? loadAudiencePane(supabase, id, audienceId, q)
      : Promise.resolve({ pending: false, attached: [], available: [], members: null, membersTotal: 0 }),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app";
  const note = resultNote(searchParams.result);
  const tileHref = (s: Stage) => `/admin/campaigns/${id}?stage=${s}`;
  const tiles: { n: string; label: string; sub?: string; stage: Stage }[] = [
    { n: stages.pending ? "—" : String(stages.totals.optins), label: "Opt-ins", stage: "optins" },
    {
      n: stages.pending ? "—" : String(stages.totals.selected),
      label: "Selected",
      sub: stages.pending ? undefined : `of ${stages.totals.optins} opt-ins`,
      stage: "selected",
    },
    { n: stages.pending ? "—" : String(stages.totals.signed), label: "Signed contracts", stage: "selected" },
  ];

  return (
    <div>
      <CampaignHeader bundle={bundle} />

      {note && (
        <div
          className={
            "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
            (note.tone === "ok" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-status-bad")
          }
        >
          {note.text}
        </div>
      )}

      {stages.error && <div className="mb-4"><ErrorNote message={`Could not load athletes: ${stages.error}`} /></div>}

      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={tileHref(t.stage)}
            className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-stone-200 bg-white px-3.5 py-3 hover:border-stone-400"
          >
            <span className="text-2xl font-semibold text-stone-900 tabular-nums">{t.n}</span>
            <span className="text-[12px] text-stone-500">
              {t.label}
              {t.sub && <span className="block text-[11px] text-stone-400">{t.sub}</span>}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <PlaybookCard bundle={bundle} playbook={playbook} />
        <SetupCard bundle={bundle} playbook={playbook} siteUrl={siteUrl} />
      </div>

      <div className="mt-3.5">
        <AthletesCard
          campaignId={id}
          stage={stage}
          q={q}
          stages={stages}
          audiencePane={audiencePane}
          selectedAudience={audienceId}
          budget={bundle.campaign.total_budget}
        />
      </div>

      <p className="px-0.5 pt-3.5 text-[12px] text-stone-500">
        Athlete folders are created automatically when an athlete or videographer submits content.
      </p>
    </div>
  );
}
