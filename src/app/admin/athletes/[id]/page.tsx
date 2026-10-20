// ============================================================
// /admin/athletes/[id] — Athlete detail (batch 2 "Athlete").
//
// One `people` row: who they are (level, school or team, sport),
// their reach (Instagram, TikTok, NIL value), whether they're on the
// Postgame app, and the campaigns they've done (recap rosters:
// athletes.person_id → campaign_recaps). Editing the record stays on
// the App user screen (/admin/users/[id]); the social/NIL view is
// /admin/profiles/[id]. Read-only here.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { ErrorNote } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { CampCell } from "@/components/admin/ops-bits";
import {
  AppPill,
  Crumb,
  Facts,
  LevelPill,
  LinkBtn,
  Note,
  PersonHead,
  Tiles,
  fmtCount,
  fmtUsd,
  handleText,
} from "@/components/admin/people/bits";
import { ATHLETE_LEVELS, levelOf } from "@/lib/admin/athletes";
import { fmtDay, genderLabel, loadPerson, loadPersonCampaigns, personName, type PersonCampaign } from "@/lib/admin/athlete-detail";

export const dynamic = "force-dynamic";

export default async function AthleteDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const { person: p, error } = await loadPerson(supabase, params.id);
  if (error) return <ErrorNote message={error} />;
  if (!p) notFound();

  const [campaigns, invites] = await Promise.all([
    loadPersonCampaigns(supabase, p.id),
    safeQuery<Array<{ id: string; channel: string | null; status: string | null; created_at: string | null; sent_at: string | null }>>(
      () =>
        supabase
          .from("athlete_invites")
          .select("id, channel, status, created_at, sent_at")
          .eq("person_id", p.id)
          .order("created_at", { ascending: false })
          .limit(20) as any
    ),
  ]);

  const name = personName(p);
  const level = levelOf(p);
  const school = p.colleges?.name ?? p.college_raw;
  const ig = handleText(p.instagram_handle);
  const tt = handleText(p.tiktok_handle);

  return (
    <div>
      <PersonHead
        crumb={<Crumb items={[{ label: "Athletes", href: "/admin/athletes" }, { label: name }]} />}
        name={name}
        sub={[ig, school, p.sport].filter(Boolean).join(" · ") || "No school or sport on file"}
        pills={
          <>
            <LevelPill row={p} />
            <AppPill device={p.device} />
            {p.is_archived && <Pill tone="muted">Archived</Pill>}
            {p.dnw_flag && <Pill tone="bad">Do not work with</Pill>}
          </>
        }
        actions={
          <>
            {p.instagram_handle && (
              <LinkBtn href={`https://instagram.com/${p.instagram_handle.replace(/^@/, "")}`} external>
                Instagram
              </LinkBtn>
            )}
            <LinkBtn href={`/admin/profiles/${p.id}`}>Social profile</LinkBtn>
            <LinkBtn href={`/admin/users/${p.id}`} primary>
              Edit record
            </LinkBtn>
          </>
        }
      />

      <Tiles
        items={[
          { n: fmtCount(p.instagram_followers), l: "Instagram followers" },
          { n: fmtCount(p.tiktok_followers), l: "TikTok followers" },
          { n: fmtUsd(p.nil_value), l: "NIL value" },
          { n: String(campaigns.length), l: "Campaigns done" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card title="Campaigns" sub="From the recap rosters this athlete is on" pad={false}>
            <div className="p-3 md:p-4">
              <AdminTable<PersonCampaign>
                rows={campaigns}
                rowKey={(c) => c.rosterId}
                emptyLabel="No recap roster is linked to this athlete yet. Work they did before the roster link existed won't show here."
                columns={[
                  {
                    key: "c",
                    header: "Campaign",
                    render: (c) => (
                      <CampCell
                        name={c.name}
                        brandName={c.brandName}
                        logo={c.logo}
                        href={c.adminCampaignId && /^\d+$/.test(c.adminCampaignId) ? `/admin/campaigns/${c.adminCampaignId}` : undefined}
                      />
                    ),
                  },
                  { key: "d", header: "Date", render: (c) => <span className="text-stone-500">{fmtDay(c.date)}</span> },
                  { key: "t", header: "Content", render: (c) => c.postType ?? <span className="text-stone-400">—</span> },
                  {
                    key: "s",
                    header: "Status",
                    render: (c) =>
                      c.approval ? (
                        <Pill tone={/approved/i.test(c.approval) ? "ok" : /reject|changes/i.test(c.approval) ? "warn" : "muted"}>{c.approval}</Pill>
                      ) : c.stage ? (
                        <Pill tone="muted">{c.stage}</Pill>
                      ) : (
                        <span className="text-stone-400">—</span>
                      ),
                  },
                  {
                    key: "p",
                    header: "",
                    align: "right",
                    render: (c) =>
                      c.postUrl ? (
                        <a href={c.postUrl} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-[#D73F09] hover:underline">
                          View post
                        </a>
                      ) : null,
                  },
                ]}
                mobile={{
                  title: (c) => c.name,
                  subtitle: (c) => [c.brandName, fmtDay(c.date), c.postType].filter(Boolean).join(" · "),
                  href: (c) => (c.adminCampaignId && /^\d+$/.test(c.adminCampaignId) ? `/admin/campaigns/${c.adminCampaignId}` : null),
                }}
              />
            </div>
          </Card>

          <Card title="Invites" sub="Texts and Instagram DMs sent to bring this athlete onto the app">
            {invites.pending ? (
              <div className="py-2 text-[13px] text-stone-500">
                The invite queue arrives with migration 091 (written, not applied). Nothing is shown until it exists.
              </div>
            ) : (invites.data ?? []).length === 0 ? (
              <div className="py-2 text-[13px] text-stone-500">{p.device ? "Already on the app, so no invites are needed." : "No invites yet."}</div>
            ) : (
              <Facts
                rows={(invites.data ?? []).map((i) => [
                  fmtDay(i.created_at),
                  <span key={i.id}>
                    {i.channel === "text" ? "Text" : "Instagram DM"} ·{" "}
                    {i.status === "sent" ? `sent ${fmtDay(i.sent_at)}` : i.status === "private" ? "private account" : i.status === "bad_ig" ? "bad Instagram" : "not sent"}
                  </span>,
                ])}
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <Facts
              rows={[
                ["Level", ATHLETE_LEVELS.find((l) => l.key === level)?.label ?? "—"],
                [level === "pro" ? "School or team" : "School", school ?? null],
                ["Division", p.colleges?.ncaa_division ?? null],
                ["Sport", p.sport],
                ["Gender", p.gender ? genderLabel(p.gender) : null],
                ["School state", p.college_state ?? p.colleges?.state ?? null],
                ["Hometown", [p.hometown_city, p.hometown_state].filter(Boolean).join(", ") || null],
                ["Rating", p.rating],
                ["Instagram", ig],
                ["TikTok", tt],
              ]}
            />
          </Card>
          <Card title="Postgame app">
            <Facts
              rows={[
                ["On the app", p.device ? "Yes" : "Not yet"],
                ["Device", p.device],
                ["Joined", fmtDay(p.admin_created_at)],
                ["ColdFusion user id", p.admin_user_id != null ? String(p.admin_user_id) : null],
                ["Status", p.is_active ? "Active" : "Inactive"],
              ]}
            />
          </Card>
          {p.dnw_flag && (
            <Note>
              <b>Do not work with.</b> {p.dnw_reason ?? "No reason recorded."} Change it on the{" "}
              <a href={`/admin/users/${p.id}`} className="font-medium text-[#D73F09] hover:underline">
                user record
              </a>
              .
            </Note>
          )}
        </div>
      </div>
    </div>
  );
}
