// ============================================================
// /admin/profiles/[id] — Profile detail (batch 2 "Profile"): the
// social and NIL side of one athlete.
//
// Reach + NIL come from the `people` row. Engagement (avg likes,
// views, engagement rate, X followers, bio) lives in the scraped
// profile table `athlete_profiles` (migration 083, not applied yet):
// looked up by owner_person_id, then by Instagram handle, and shown
// as pending until the table exists. Nothing is estimated.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { ErrorNote } from "@/components/admin/ui";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { AppPill, Crumb, Facts, LevelPill, LinkBtn, PersonHead, Tiles, fmtCount, fmtUsd, handleText } from "@/components/admin/people/bits";
import { fmtDay, loadPerson, personName } from "@/lib/admin/athlete-detail";

export const dynamic = "force-dynamic";

interface ScrapedProfile {
  profile_id: number;
  biography: string | null;
  engagement_rate: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_views: number | null;
  twitter_username: string | null;
  twitter_followers: number | null;
  is_verified: boolean | null;
  is_private: boolean | null;
  date_last_scrape: string | null;
  class: string | null;
  conference: string | null;
}

const SCRAPED_COLUMNS =
  "profile_id, biography, engagement_rate, avg_likes, avg_comments, avg_views, twitter_username, twitter_followers, is_verified, is_private, date_last_scrape, class, conference";

export default async function ProfileDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const { person: p, error } = await loadPerson(supabase, params.id);
  if (error) return <ErrorNote message={error} />;
  if (!p) notFound();

  const handle = p.instagram_handle?.replace(/^@/, "") ?? null;
  const [rankRes, byOwner] = await Promise.all([
    p.nil_value != null
      ? supabase
          .from("people")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .in("person_type", ["Athlete", "Former Athlete"])
          .gt("nil_value", p.nil_value)
      : Promise.resolve({ count: null }),
    safeQuery<ScrapedProfile[]>(() => supabase.from("athlete_profiles").select(SCRAPED_COLUMNS).eq("owner_person_id", p.id).limit(1) as any),
  ]);
  let scraped = byOwner;
  if (!byOwner.pending && !byOwner.error && (byOwner.data ?? []).length === 0 && handle) {
    scraped = await safeQuery<ScrapedProfile[]>(
      () => supabase.from("athlete_profiles").select(SCRAPED_COLUMNS).ilike("instagram_username", handle).limit(1) as any
    );
  }
  const sp = (scraped.data ?? [])[0] ?? null;
  const rank = rankRes.count != null ? rankRes.count + 1 : null;

  const name = personName(p);
  const school = p.colleges?.name ?? p.college_raw;
  const pct = (n: number | null) => (n == null ? null : `${(n > 1 ? n : n * 100).toFixed(2)}%`);

  const accounts: Array<{ k: string; handle: string | null; followers: number | null; url: string | null }> = [
    { k: "Instagram", handle, followers: p.instagram_followers, url: handle ? `https://instagram.com/${handle}` : null },
    {
      k: "TikTok",
      handle: p.tiktok_handle?.replace(/^@/, "") ?? null,
      followers: p.tiktok_followers,
      url: p.tiktok_handle ? `https://www.tiktok.com/@${p.tiktok_handle.replace(/^@/, "")}` : null,
    },
    {
      k: "X",
      handle: sp?.twitter_username ?? null,
      followers: sp?.twitter_followers ?? null,
      url: sp?.twitter_username ? `https://x.com/${sp.twitter_username}` : null,
    },
  ];

  return (
    <div>
      <PersonHead
        crumb={<Crumb items={[{ label: "Profiles", href: "/admin/profiles" }, { label: name }]} />}
        name={name}
        sub={[handleText(p.instagram_handle), school, p.sport].filter(Boolean).join(" · ")}
        pills={
          <>
            <LevelPill row={p} />
            <AppPill device={p.device} />
            {sp?.is_verified && <Pill tone="info">Verified</Pill>}
            {sp?.is_private && <Pill tone="warn">Private account</Pill>}
          </>
        }
        actions={
          <>
            <LinkBtn href={`/admin/athletes/${p.id}`}>Athlete page</LinkBtn>
            <LinkBtn href={`/admin/users/${p.id}`}>Edit record</LinkBtn>
          </>
        }
      />

      <Tiles
        items={[
          { n: fmtUsd(p.nil_value), l: "NIL value" },
          { n: rank != null ? `#${rank.toLocaleString("en-US")}` : "—", l: "Rank by NIL value", href: "/admin/profiles" },
          { n: fmtCount(p.instagram_followers), l: "Instagram followers" },
          { n: fmtCount(p.tiktok_followers), l: "TikTok followers" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card title="Social accounts" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-2.5 font-semibold">Platform</th>
                    <th className="px-4 py-2.5 font-semibold">Handle</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Followers</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.k} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-stone-900">{a.k}</td>
                      <td className="px-4 py-2.5 text-stone-600">{a.handle ? `@${a.handle}` : <span className="text-stone-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtCount(a.followers)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {a.url && (
                          <a href={a.url} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-[#D73F09] hover:underline">
                            Open
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Engagement" sub="From the scraped Instagram profile">
            {scraped.pending ? (
              <div className="py-2 text-[13px] text-stone-500">
                Engagement comes from the scraped profile table (<code className="rounded bg-stone-100 px-1">athlete_profiles</code>),
                which arrives with migration 083. Nothing is estimated in the meantime.
              </div>
            ) : !sp ? (
              <div className="py-2 text-[13px] text-stone-500">No scraped profile is linked to this athlete yet.</div>
            ) : (
              <>
                <Facts
                  rows={[
                    ["Engagement rate", pct(sp.engagement_rate)],
                    ["Average likes", sp.avg_likes != null ? fmtCount(Math.round(sp.avg_likes)) : null],
                    ["Average comments", sp.avg_comments != null ? fmtCount(Math.round(sp.avg_comments)) : null],
                    ["Average views", sp.avg_views != null ? fmtCount(Math.round(sp.avg_views)) : null],
                    ["Last scraped", fmtDay(sp.date_last_scrape)],
                  ]}
                />
                {sp.biography && <p className="mt-3 whitespace-pre-line text-[13px] text-stone-600">{sp.biography}</p>}
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="NIL value">
            <Facts
              rows={[
                ["Value", fmtUsd(p.nil_value)],
                ["Last synced", fmtDay(p.nil_value_synced_at)],
                ["Rating", p.rating],
                ["Rank", rank != null ? `#${rank.toLocaleString("en-US")} of everyone with a value` : null],
              ]}
            />
          </Card>
          <Card title="School">
            <Facts
              rows={[
                ["College", school ?? null],
                ["Division", p.colleges?.ncaa_division ?? null],
                ["Conference", sp?.conference ?? null],
                ["Class", sp?.class ?? null],
                ["Sport", p.sport],
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
