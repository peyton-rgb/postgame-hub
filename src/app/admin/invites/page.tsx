// ============================================================
// /admin/invites — Invites (the prototype's S.invites,
// S["invites-sent"], S["invites-teams"]; CF invites.cfm +
// invites_team.cfm): athletes WITHOUT the app, invited one text or
// Instagram DM at a time. Staff send it, then mark it sent.
//
//   (default)   Not sent   athlete_invites.status = not_sent
//   ?tab=sent   Sent       status = sent (private / bad IG on the
//                          Not sent tab's filter)
//   ?tab=teams  Teams      teams (083) with roster vs app counts
//
// Tables: athlete_invites (migration 091) and teams (083) — neither
// applied yet, so each tab says so until they are. Athletes are
// `people` rows; campaigns are `campaign_recaps`.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange, safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { TablePending } from "@/components/admin/ops-bits";
import CopyButton from "@/components/admin/CopyButton";
import { Avatar, CardFoot, LinkBtn, Note, TabStrip, Toolbar, Who, fmtCount, handleText } from "@/components/admin/people/bits";
import { applyAthleteBase } from "@/lib/admin/athletes";
import { fmtDay } from "@/lib/admin/athlete-detail";
import { markInvite } from "./actions";

export const dynamic = "force-dynamic";

type Tab = "not_sent" | "sent" | "teams";

interface InviteRow {
  id: string;
  channel: "text" | "dm";
  status: string;
  message: string | null;
  created_at: string;
  sent_at: string | null;
  joined_at: string | null;
  sender: { full_name: string | null; email: string | null } | null;
  campaign: { name: string | null; client_name: string | null } | null;
  person: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    instagram_handle: string | null;
    instagram_followers: number | null;
    college_raw: string | null;
    sport: string | null;
    device: string | null;
  };
}

const RESULT: Record<string, string> = {
  sent: "Marked sent.",
  private: "Marked as a private account.",
  bad_ig: "Marked as a bad Instagram handle.",
  not_sent: "Moved back to Not sent.",
  pending: "That needs the invite queue (migration 091, written, not applied). Nothing was changed.",
  error: "That didn't save. Nothing was changed.",
};

const NOTE =
  "Invites are for athletes who don't have the app yet. Staff send each one by text or Instagram DM, then mark it sent. Athletes who already have the app get an in-app notification instead, so they never show up here.";

function inviteText(r: InviteRow): string {
  if (r.message) return r.message.replace(/\{first name\}/gi, r.person.first_name ?? "there").replace(/\{school\}/gi, r.person.college_raw ?? "your school");
  const brand = r.campaign?.client_name ? `${r.campaign.client_name} is looking for athletes` : "Brands are looking for athletes";
  return `Hey ${r.person.first_name ?? "there"}! Postgame here. ${brand} at ${r.person.college_raw ?? "your school"} for a paid campaign. Download the Postgame app to opt in: postgame1.com/app`;
}

export default async function InvitesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const view = getListView("invites", searchParams);
  const db = supabase as any; // athlete_invites (091) / teams (083) are not in the generated types yet
  const tab: Tab = searchParams.tab === "sent" ? "sent" : searchParams.tab === "teams" ? "teams" : "not_sent";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const channel = searchParams.channel === "text" || searchParams.channel === "dm" ? searchParams.channel : "";
  const campaign = /^[0-9a-f-]{36}$/i.test(searchParams.campaign ?? "") ? searchParams.campaign! : "";
  const state = ["private", "bad_ig"].includes(searchParams.state ?? "") ? searchParams.state! : "";
  const joined = searchParams.joined === "yes" || searchParams.joined === "no" ? searchParams.joined : "";
  const { from, to } = pageRange(page);

  const notSentCount = await safeQuery<null>(() => db.from("athlete_invites").select("id", { count: "exact", head: true }).eq("status", "not_sent"));
  const invitesPending = notSentCount.pending;
  const { count: notSentN } = invitesPending
    ? { count: null }
    : await db.from("athlete_invites").select("id", { count: "exact", head: true }).eq("status", "not_sent");

  const campaignsRes = await supabase.from("campaign_recaps").select("id, name, client_name").order("created_at", { ascending: false }).limit(150);
  const campaignOptions = ((campaignsRes.data ?? []) as Array<{ id: string; name: string | null; client_name: string | null }>).map((c) => ({
    value: c.id,
    label: [c.client_name, c.name].filter(Boolean).join(" – ") || "Untitled",
  }));

  const backQs = new URLSearchParams();
  for (const [k, v] of Object.entries({ tab: tab === "not_sent" ? "" : tab, q, channel, campaign, state, joined, page: page > 1 ? String(page) : "" }))
    if (v) backQs.set(k, v);
  const back = `/admin/invites${backQs.toString() ? `?${backQs}` : ""}`;

  let body: React.ReactNode;
  let total = 0;
  let error: string | null = null;

  if (tab === "teams") {
    const teams = await safeQuery<Array<{ team_id: number; team_name: string | null; college_id: number | null; gender: string | null; sport_id: number | null }>>(
      () => {
        let tq = db.from("teams").select("team_id, team_name, college_id, gender, sport_id");
        if (q) tq = tq.ilike("team_name", `%${q}%`);
        return tq.order("team_name").range(from, to);
      }
    );
    if (teams.pending) {
      body = <TablePending table="teams" feature="Team invites" migration="083" />;
    } else if (teams.error) {
      error = teams.error;
    } else {
      const rows = teams.data ?? [];
      const { count } = await (q ? db.from("teams").select("team_id", { count: "exact", head: true }).ilike("team_name", `%${q}%`) : db.from("teams").select("team_id", { count: "exact", head: true }));
      total = count ?? 0;
      const sportIds = Array.from(new Set(rows.map((r) => r.sport_id).filter(Boolean)));
      const { data: sports } = sportIds.length ? await db.from("sports").select("sport_id, sport").in("sport_id", sportIds) : { data: [] };
      const sportOf = new Map<number, string>(((sports ?? []) as Array<{ sport_id: number; sport: string }>).map((s) => [s.sport_id, s.sport]));
      const collegeIds = Array.from(new Set(rows.map((r) => r.college_id).filter((x): x is number => x != null)));
      const { data: cols } = collegeIds.length ? await supabase.from("colleges").select("id, name").in("id", collegeIds) : { data: [] };
      const collegeOf = new Map<number, string>(((cols ?? []) as Array<{ id: number; name: string }>).map((c) => [c.id, c.name]));
      const head = () => supabase.from("people").select("id", { count: "exact", head: true });
      const counts = await Promise.all(
        rows.map(async (r) => {
          if (!r.college_id) return { roster: null, app: null };
          const sport = r.sport_id ? sportOf.get(r.sport_id) : null;
          const scope = (x: any) => {
            x = applyAthleteBase(x).eq("college_id", r.college_id);
            if (sport) x = x.ilike("sport", `%${sport}%`);
            return x;
          };
          const [a, b] = await Promise.all([scope(head()), scope(head()).not("device", "is", null)]);
          return { roster: a.error ? null : a.count ?? 0, app: b.error ? null : b.count ?? 0 };
        })
      );
      const withCounts = rows.map((r, i) => ({
        ...r,
        sport: r.sport_id ? sportOf.get(r.sport_id) ?? null : null,
        college: r.college_id ? collegeOf.get(r.college_id) ?? null : null,
        ...counts[i],
      }));
      body = (
        <AdminTable<(typeof withCounts)[number]>
          rows={withCounts}
          rowKey={(r) => String(r.team_id)}
          view={view}
          cardDetails={["r", "u"]}
          emptyLabel="No teams match."
          columns={[
            { key: "t", header: "Team", render: (r) => <span className="font-medium text-stone-900">{r.team_name ?? "—"}</span> },
            { key: "r", header: "On the roster", align: "right", render: (r) => fmtCount(r.roster) },
            { key: "u", header: "Have the app", align: "right", render: (r) => fmtCount(r.app) },
            {
              key: "x",
              header: "",
              align: "right",
              render: (r) =>
                r.college ? (
                  <LinkBtn
                    href={`/admin/athletes/export?level=college&app=no${r.sport ? `&sport=${encodeURIComponent(r.sport)}` : ""}&school=${encodeURIComponent(r.college)}`}
                    small
                    external
                  >
                    Download IG handles
                  </LinkBtn>
                ) : null,
            },
          ]}
          mobile={{
            title: (r) => r.team_name ?? "—",
            subtitle: (r) =>
              view === "cards" ? r.college ?? r.sport ?? null : `${fmtCount(r.app)} of ${fmtCount(r.roster)} have the app`,
            strip:
              view === "cards"
                ? (r) =>
                    r.college ? (
                      <LinkBtn
                        href={`/admin/athletes/export?level=college&app=no${r.sport ? `&sport=${encodeURIComponent(r.sport)}` : ""}&school=${encodeURIComponent(r.college)}`}
                        small
                        external
                      >
                        Download IG handles
                      </LinkBtn>
                    ) : null
                : undefined,
          }}
        />
      );
    }
  } else if (invitesPending) {
    body = <TablePending table="athlete_invites" feature={tab === "sent" ? "Sent invites" : "Invites to send"} migration="091" />;
  } else {
    const sel =
      "id, channel, status, message, created_at, sent_at, joined_at, sender:profiles!sent_by(full_name, email), campaign:campaign_recaps!campaign_recap_id(name, client_name), person:people!inner(id, first_name, last_name, instagram_handle, instagram_followers, college_raw, sport, device)";
    let iq = db.from("athlete_invites").select(sel, { count: "exact" });
    iq = tab === "sent" ? iq.eq("status", "sent") : iq.eq("status", state || "not_sent");
    if (channel) iq = iq.eq("channel", channel);
    if (campaign) iq = iq.eq("campaign_recap_id", campaign);
    if (tab === "sent" && joined === "yes") iq = iq.not("joined_at", "is", null);
    if (tab === "sent" && joined === "no") iq = iq.is("joined_at", null);
    if (q) iq = iq.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,instagram_handle.ilike.%${q}%,college_raw.ilike.%${q}%`, { referencedTable: "people" });
    const res = await iq.order(tab === "sent" ? "sent_at" : "created_at", { ascending: false }).range(from, to);
    if (res.error) error = res.error.message;
    total = res.count ?? 0;
    const rows = (res.data ?? []) as InviteRow[];
    const nm = (r: InviteRow) => [r.person.first_name, r.person.last_name].filter(Boolean).join(" ") || null;
    const camp = (r: InviteRow) => (r.campaign ? [r.campaign.client_name, r.campaign.name].filter(Boolean).join(" – ") : null);
    const action = (r: InviteRow, status: string, label: string, primary = false) => (
      <form action={markInvite}>
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="back" value={back} />
        <button
          className={
            "whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium " +
            (primary ? "bg-[#D73F09] text-white hover:bg-[#B33407]" : "border border-stone-300 bg-white text-stone-700 hover:border-stone-400")
          }
        >
          {label}
        </button>
      </form>
    );
    const actionsCell = (r: InviteRow) =>
      tab === "sent" ? (
        <span className="text-[12px] text-stone-500">
          Sent by {r.sender?.full_name?.split(" ")[0] ?? r.sender?.email ?? "staff"} · {fmtDay(r.sent_at)}
          {r.joined_at && <> · <span className="text-status-ok">joined the app</span></>}
        </span>
      ) : (
        <div className="flex flex-wrap justify-end gap-1.5">
          {r.channel === "text" ? (
            <CopyButton value={inviteText(r)} label="Copy text" className="whitespace-nowrap rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 hover:border-stone-400" />
          ) : r.person.instagram_handle ? (
            <a
              href={`https://ig.me/m/${r.person.instagram_handle.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 hover:border-stone-400"
            >
              Open DM
            </a>
          ) : null}
          {state ? action(r, "not_sent", "Back to queue") : action(r, "sent", "Mark sent", true)}
          {!state && action(r, "private", "Private")}
          {!state && action(r, "bad_ig", "Bad IG")}
        </div>
      );
    body = (
      <AdminTable<InviteRow>
        rows={rows}
        rowKey={(r) => r.id}
        view={view}
        cardDetails={["s", "f", "c", "ch"]}
        emptyLabel={tab === "sent" ? "No invites sent yet." : state ? "None marked this way." : "Nothing to send. Every athlete in the queue has been invited."}
        columns={[
          { key: "d", header: "Date", render: (r) => <span className="text-stone-500">{fmtDay(tab === "sent" ? r.sent_at : r.created_at)}</span> },
          { key: "to", header: "To", render: (r) => <Who name={nm(r)} sub={handleText(r.person.instagram_handle)} href={`/admin/athletes/${r.person.id}`} /> },
          { key: "s", header: "School", render: (r) => r.person.college_raw ?? <span className="text-stone-400">—</span> },
          { key: "sp", header: "Sport", secondary: true, render: (r) => r.person.sport ?? <span className="text-stone-400">—</span> },
          { key: "f", header: "Followers", align: "right", render: (r) => fmtCount(r.person.instagram_followers) },
          { key: "c", header: "Campaign", secondary: true, render: (r) => <span className="text-stone-500">{camp(r) ?? "—"}</span> },
          { key: "ch", header: "Send by", render: (r) => (r.channel === "text" ? <Pill tone="info">Text</Pill> : <Pill tone="muted">Instagram DM</Pill>) },
          {
            key: "x",
            header: "",
            align: "right",
            render: actionsCell,
          },
        ]}
        mobile={{
          // Cards carry the send buttons, so the card itself isn't a link
          // (no <a> inside <a>); the name links to the athlete instead.
          icon: view === "cards" ? (r) => <Avatar name={nm(r)} /> : undefined,
          title: (r) =>
            view === "cards" ? (
              <Link href={`/admin/athletes/${r.person.id}`} className="hover:underline">
                {nm(r) ?? "—"}
              </Link>
            ) : (
              nm(r) ?? "—"
            ),
          href: (r) => (view === "cards" ? null : `/admin/athletes/${r.person.id}`),
          strip: view === "cards" ? actionsCell : undefined,
          subtitle: (r) => [handleText(r.person.instagram_handle), r.person.college_raw, r.channel === "text" ? "Text" : "Instagram DM"].filter(Boolean).join(" · "),
          figure: (r) => fmtCount(r.person.instagram_followers),
        }}
      />
    );
  }

  const tabs = [
    { key: "not_sent", label: "Not sent", href: "/admin/invites", count: invitesPending ? "—" : fmtCount(notSentN) },
    { key: "sent", label: "Sent", href: "/admin/invites?tab=sent" },
    { key: "teams", label: "Teams", href: "/admin/invites?tab=teams" },
  ];
  const result = searchParams.result ? RESULT[searchParams.result] : null;
  const dlQs = new URLSearchParams({ level: "college", app: "no" });

  return (
    <div>
      <PageHeader
        title="Invites"
        subtitle="Athletes to invite to the app, one text or DM at a time."
        actions={
          <>
            <ViewToggle listKey="invites" view={view} />
            {tab !== "teams" && (
              <LinkBtn href={`/admin/athletes/export?${dlQs}`} external>
                Download handles
              </LinkBtn>
            )}
          </>
        }
      />

      {result && <div className="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-[13px] text-stone-700">{result}</div>}
      {error && <ErrorNote message={error} />}

      <Card pad={false}>
        <TabStrip current={tab} tabs={tabs} />
        {tab === "teams" ? (
          <Toolbar action="/admin/invites" placeholder="Search by team name" q={q} hidden={{ tab: "teams" }} />
        ) : (
          <Toolbar
            action="/admin/invites"
            placeholder="Search name, handle or school"
            q={q}
            hidden={{ tab: tab === "sent" ? "sent" : undefined }}
            selects={[
              { name: "campaign", label: "All campaigns", value: campaign, options: campaignOptions },
              {
                name: "channel",
                label: "Text or DM",
                value: channel,
                options: [
                  { value: "text", label: "Text" },
                  { value: "dm", label: "Instagram DM" },
                ],
              },
              tab === "sent"
                ? {
                    name: "joined",
                    label: "Joined the app: any",
                    value: joined,
                    options: [
                      { value: "yes", label: "Joined the app" },
                      { value: "no", label: "Not yet" },
                    ],
                  }
                : {
                    name: "state",
                    label: "Waiting to send",
                    value: state,
                    options: [
                      { value: "private", label: "Marked private" },
                      { value: "bad_ig", label: "Marked bad IG" },
                    ],
                  },
            ]}
          />
        )}
        <div className="p-3 md:p-4">{body}</div>
        <CardFoot>
          <span>
            {tab === "teams"
              ? "Same as ColdFusion's Team Invites. Download IG handles gives that team's athletes without the app."
              : "Same queue as ColdFusion's Invites Not Sent: Mark Private and Bad IG stay."}
          </span>
          {total > 0 && <span>{total.toLocaleString()} total</span>}
        </CardFoot>
      </Card>

      {total > PAGE_SIZE && (
        <Paginator
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          basePath="/admin/invites"
          params={{ tab: tab === "not_sent" ? undefined : tab, q: q || undefined, channel: channel || undefined, campaign: campaign || undefined, state: state || undefined, joined: joined || undefined }}
        />
      )}

      <Note>
        {NOTE} Athletes land in this queue when a campaign invites an audience; see{" "}
        <Link href="/admin/audiences" className="font-medium text-[#D73F09] hover:underline">
          Audiences
        </Link>
        .
      </Note>
    </div>
  );
}
