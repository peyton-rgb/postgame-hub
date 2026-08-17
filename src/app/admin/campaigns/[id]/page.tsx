// ============================================================
// /admin/campaigns/[id] — Campaign dashboard + working suite
// (Campaign_dashboard.cfm rebuilt). Header = CF's label/value
// overview; tabs = Opt-ins · Selected · Committed · Results · Pay.
//
// Real sources (canonical of each name-twin family, verified by
// row counts + FKs — see run-state doc):
//   Opt-ins  -> optin_campaigns (pages, via admin_campaign_id) +
//               athlete_campaign_optins (submissions, FK to it)
//   Selected / Committed -> athletes roster rows split by
//               funnel_stage (migration 026; honest pending state
//               until applied — roster still listed)
//   Results  -> athletes rows with post_url + metrics
//   Pay      -> payouts (read-only here; money ACTIONS live in the
//               exec-gated Pay suite, Phase 3)
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatDate, formatMoney, safeQuery } from "@/lib/admin/db";
import { PageHeader, PendingMigration, ErrorNote, FlagCell, EmptyRows } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

const TABS = ["overview", "optins", "selected", "committed", "results", "pay"] as const;
type Tab = (typeof TABS)[number];

interface RosterRow {
  id: string;
  name: string | null;
  school: string | null;
  sport: string | null;
  ig_handle: string | null;
  ig_followers: number | null;
  post_type: string | null;
  post_url: string | null;
  metrics: Record<string, unknown> | null;
  funnel_stage?: string | null;
}

export default async function CampaignDashboard({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? "")
    ? ((searchParams.tab ?? "overview") as Tab)
    : "overview";

  const { data: campaign, error } = await supabase
    .from("campaign_recaps")
    .select(
      "id, name, client_name, status, created_at, admin_campaign_id, brand_id, brief_url, tracker_url, drive_folder_id, tags, slug, brands(name)"
    )
    .eq("id", params.id)
    .single();

  if (error || !campaign) {
    return (
      <div>
        <PageHeader title="Campaign" />
        <ErrorNote message="Campaign not found." />
      </div>
    );
  }
  const brandName =
    (campaign.brands as unknown as { name: string | null } | null)?.name ?? campaign.client_name;

  // Roster (with a safe probe for funnel_stage from migration 026)
  const rosterWithStage = await safeQuery<RosterRow[]>(
    () =>
      supabase
        .from("athletes")
        .select(
          "id, name, school, sport, ig_handle, ig_followers, post_type, post_url, metrics, funnel_stage"
        )
        .eq("campaign_id", params.id)
        .order("sort_order", { ascending: true }) as any
  );
  let roster: RosterRow[] = rosterWithStage.data ?? [];
  const stagePending = rosterWithStage.pending;
  if (stagePending) {
    const { data } = await supabase
      .from("athletes")
      .select("id, name, school, sport, ig_handle, ig_followers, post_type, post_url, metrics")
      .eq("campaign_id", params.id)
      .order("sort_order", { ascending: true });
    roster = (data ?? []) as RosterRow[];
  }

  // Opt-in pages + submissions
  const adminIdNum = campaign.admin_campaign_id
    ? parseInt(campaign.admin_campaign_id, 10)
    : NaN;
  const { data: optinPages } = Number.isNaN(adminIdNum)
    ? { data: [] as any[] }
    : await supabase
        .from("optin_campaigns")
        .select("id, title, slug, status, published_at, deadline")
        .eq("admin_campaign_id", adminIdNum);
  const optinIds = (optinPages ?? []).map((o) => o.id);
  const { data: optinSubs } = optinIds.length
    ? await supabase
        .from("athlete_campaign_optins")
        .select("id, status, created_at, athlete_id, optin_campaign_id")
        .in("optin_campaign_id", optinIds)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  // Payouts for this campaign's opt-in pages
  const { data: payoutRows } = optinIds.length
    ? await supabase
        .from("payouts")
        .select("id, athlete_id, amount_cents, amount_label, status, provider, paid_at, created_at")
        .in("optin_campaign_id", optinIds)
    : { data: [] as any[] };

  const selected = roster.filter((r) => r.funnel_stage === "selected");
  const committed = roster.filter(
    (r) => r.funnel_stage === "committed" || r.funnel_stage === "delivered"
  );
  const results = roster.filter((r) => Boolean(r.post_url));

  const overview: [string, React.ReactNode][] = [
    ["Campaign ID", campaign.admin_campaign_id ?? campaign.id.slice(0, 8)],
    ["Name", campaign.name ?? "—"],
    ["Brand / Account", brandName ?? "—"],
    ["Status", <span key="s" className="capitalize">{campaign.status ?? "—"}</span>],
    ["Created", formatDate(campaign.created_at)],
    ["Roster rows", roster.length.toLocaleString()],
    ["Opt-in pages", (optinPages ?? []).length],
    ["Opt-in submissions", (optinSubs ?? []).length],
    ["Results (posts live)", results.length],
    ["Payout rows", (payoutRows ?? []).length],
    [
      "Brief",
      campaign.brief_url ? (
        <a key="b" className="text-[#D73F09] hover:underline" href={campaign.brief_url} target="_blank" rel="noreferrer">
          Open brief ↗
        </a>
      ) : (
        <FlagCell key="b" state="missing" title="No brief" />
      ),
    ],
    [
      "Tracker",
      campaign.tracker_url ? (
        <a key="t" className="text-[#D73F09] hover:underline" href={campaign.tracker_url} target="_blank" rel="noreferrer">
          Open tracker ↗
        </a>
      ) : (
        <FlagCell key="t" state="missing" title="No tracker" />
      ),
    ],
    ["Tags", (campaign.tags ?? []).join(", ") || "—"],
  ];

  const tabLink = (t: Tab, label: string, count?: number) => (
    <Link
      key={t}
      href={t === "overview" ? `/admin/campaigns/${params.id}` : `/admin/campaigns/${params.id}?tab=${t}`}
      className={
        "rounded-md px-3 py-1.5 text-[13px] font-medium " +
        (tab === t ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
      }
    >
      {label}
      {count != null && <span className="ml-1 tabular-nums opacity-75">({count})</span>}
    </Link>
  );

  const rosterColumns = [
    {
      key: "name",
      header: "Athlete",
      render: (r: RosterRow) => <span className="font-medium text-stone-900">{r.name ?? "—"}</span>,
    },
    { key: "school", header: "School", render: (r: RosterRow) => r.school ?? "—" },
    { key: "sport", header: "Sport", render: (r: RosterRow) => r.sport ?? "—", secondary: true },
    {
      key: "ig",
      header: "IG",
      render: (r: RosterRow) =>
        r.ig_handle ? <span className="text-stone-600">@{r.ig_handle.replace(/^@/, "")}</span> : "—",
    },
    {
      key: "followers",
      header: "Followers",
      align: "right" as const,
      render: (r: RosterRow) => r.ig_followers?.toLocaleString() ?? "—",
    },
    {
      key: "stage",
      header: "Stage",
      render: (r: RosterRow) =>
        stagePending ? (
          <span className="text-amber-600" title="funnel_stage arrives with migration 026">
            pending 026
          </span>
        ) : (
          <span className="capitalize text-stone-600">{r.funnel_stage ?? "—"}</span>
        ),
    },
  ];

  const rosterMobile = {
    title: (r: RosterRow) => r.name ?? "—",
    subtitle: (r: RosterRow) => [r.school, r.sport].filter(Boolean).join(" · "),
    figure: (r: RosterRow) => r.ig_followers?.toLocaleString() ?? "",
  };

  return (
    <div>
      <PageHeader
        title={campaign.name ?? "Untitled campaign"}
        subtitle={brandName ?? undefined}
        actions={
          <Link
            href={`/admin/campaigns/${params.id}/edit`}
            className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]"
          >
            Edit campaign
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1 pb-5">
        {tabLink("overview", "Dashboard")}
        {tabLink("optins", "Opt-ins", (optinSubs ?? []).length)}
        {tabLink("selected", "Selected", stagePending ? undefined : selected.length)}
        {tabLink("committed", "Committed", stagePending ? undefined : committed.length)}
        {tabLink("results", "Results", results.length)}
        {tabLink("pay", "Pay", (payoutRows ?? []).length)}
      </div>

      {tab === "overview" && (
        <div className="rounded-lg border border-stone-200 bg-white">
          <dl className="divide-y divide-stone-100">
            {overview.map(([label, value]) => (
              <div key={String(label)} className="grid grid-cols-[160px_1fr] gap-3 px-4 py-2.5 text-[13px]">
                <dt className="text-stone-500">{label}</dt>
                <dd className="text-stone-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tab === "optins" && (
        <div className="space-y-4">
          {(optinPages ?? []).length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white">
              <EmptyRows label="No opt-in page linked to this campaign yet (matched via optin_campaigns.admin_campaign_id)." />
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-stone-200 bg-white p-4 text-[13px]">
                {(optinPages ?? []).map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                    <span className="font-medium text-stone-900">{o.title ?? o.slug}</span>
                    <span className="text-stone-500">
                      {o.status ?? "—"} · deadline {formatDate(o.deadline)}
                    </span>
                  </div>
                ))}
              </div>
              <AdminTable
                rows={(optinSubs ?? []) as { id: string; status: string | null; created_at: string | null }[]}
                rowKey={(r) => r.id}
                emptyLabel="No opt-in submissions yet."
                columns={[
                  { key: "id", header: "ID", render: (r) => <span className="text-stone-500">{r.id.slice(0, 8)}</span> },
                  { key: "status", header: "Status", render: (r) => <span className="capitalize">{r.status ?? "—"}</span> },
                  { key: "created", header: "Submitted", render: (r) => formatDate(r.created_at) },
                ]}
                mobile={{
                  title: (r) => r.id.slice(0, 8),
                  subtitle: (r) => r.status ?? "",
                  figure: (r) => formatDate(r.created_at),
                }}
              />
            </>
          )}
        </div>
      )}

      {(tab === "selected" || tab === "committed") && (
        <div className="space-y-4">
          {stagePending && (
            <PendingMigration
              migration="026_roster_approval"
              feature={`The ${tab} stage split (funnel_stage on athletes)`}
            />
          )}
          <AdminTable<RosterRow>
            rows={stagePending ? roster : tab === "selected" ? selected : committed}
            rowKey={(r) => r.id}
            emptyLabel={
              stagePending
                ? "No roster rows on this campaign."
                : `No athletes in the ${tab} stage yet.`
            }
            columns={rosterColumns}
            mobile={rosterMobile}
          />
        </div>
      )}

      {tab === "results" && (
        <AdminTable<RosterRow>
          rows={results}
          rowKey={(r) => r.id}
          emptyLabel="No live posts recorded on this roster yet."
          columns={[
            ...rosterColumns.filter((c) => c.key !== "stage"),
            {
              key: "post",
              header: "Post",
              render: (r) =>
                r.post_url ? (
                  <a className="text-[#D73F09] hover:underline" href={r.post_url} target="_blank" rel="noreferrer">
                    {r.post_type ?? "View"} ↗
                  </a>
                ) : (
                  "—"
                ),
            },
          ]}
          mobile={rosterMobile}
        />
      )}

      {tab === "pay" && (
        <div className="space-y-3">
          <p className="text-[12px] text-stone-500">
            Read-only view. Money actions (mark paid, batch, deny) live in the exec-gated Pay
            suite.
          </p>
          <AdminTable
            rows={(payoutRows ?? []) as {
              id: string;
              amount_cents: number | null;
              amount_label: string | null;
              status: string | null;
              provider: string | null;
              paid_at: string | null;
              created_at: string | null;
            }[]}
            rowKey={(r) => r.id}
            emptyLabel="No payout rows for this campaign yet (payouts table)."
            columns={[
              { key: "id", header: "ID", render: (r) => <span className="text-stone-500">{r.id.slice(0, 8)}</span> },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                render: (r) => r.amount_label ?? formatMoney(r.amount_cents),
              },
              { key: "status", header: "Status", render: (r) => <span className="capitalize">{r.status ?? "—"}</span> },
              { key: "provider", header: "Method", render: (r) => r.provider ?? "—", secondary: true },
              { key: "paid", header: "Paid", render: (r) => formatDate(r.paid_at) },
            ]}
            mobile={{
              title: (r) => r.amount_label ?? formatMoney(r.amount_cents),
              subtitle: (r) => r.status ?? "",
              figure: (r) => formatDate(r.paid_at),
            }}
          />
        </div>
      )}
    </div>
  );
}
