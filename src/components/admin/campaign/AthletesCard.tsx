// ============================================================
// "Athletes" card — five stage tabs, each a real list:
//   Campaign audience  two panes: attached audiences | athletes
//   Opt-ins            opted in, not selected   → pick & select
//   Selected           contract + content status
//   Affiliates         affiliate_links rows
//   Paid               campaign_opt_ins with a payment
//
// Tabs and the audience pane are search params (?stage= ?audience=
// ?q=) so this stays a server component. Every number is a count of
// real rows; empty states say what to do next.
// ============================================================

import Link from "next/link";
import AdminTable from "@/components/admin/AdminTable";
import { PendingMigration } from "@/components/admin/ui";
import type { AffiliateRow, AthleteStages, AudiencePane, OptInRow, Stage } from "@/lib/admin/campaigns/queries";
import { STAGES } from "@/lib/admin/campaigns/queries";
import { personName, type PersonLite } from "@/lib/admin/campaigns/types";
import { attachAudience, detachAudience, selectAthletes } from "@/app/admin/campaigns/actions";
import { Btn, Card, Pill, TextLink, WhoCell, fmtMoney, fmtNum, fmtShortDate } from "./bits";
import CopyButton from "./CopyButton";
import SelectOptinsForm, { PickToggle } from "./SelectOptinsForm";

function matches(q: string, p: PersonLite | null, handle?: string | null): boolean {
  if (!q) return true;
  const hay = [personName(p), p?.instagram_handle, handle, p?.college_raw, p?.sport].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

function SchoolSport({ p }: { p: PersonLite | null }) {
  return (
    <>
      {p?.college_raw || <span className="text-stone-400">—</span>}
      {p?.sport && <div className="text-[12px] text-stone-500">{p.sport}</div>}
    </>
  );
}

function Toolbar({ base, stage, q, placeholder, right }: { base: string; stage: Stage; q: string; placeholder: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-2.5 md:px-5">
      <form action={base} className="flex min-w-[200px] flex-1 items-center gap-2">
        <input type="hidden" name="stage" value={stage} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="w-full max-w-sm rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
        />
      </form>
      {right}
    </div>
  );
}

function Foot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-2.5 text-[13px] text-stone-600 md:px-5">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-[13px] text-stone-500">{children}</div>;
}

export default function AthletesCard({
  campaignId,
  stage,
  q,
  stages,
  audiencePane,
  selectedAudience,
  budget,
}: {
  campaignId: number;
  stage: Stage;
  q: string;
  stages: AthleteStages;
  audiencePane: AudiencePane;
  selectedAudience: string | null;
  budget: number | null;
}) {
  const base = `/admin/campaigns/${campaignId}`;
  const tabHref = (s: Stage) => `${base}?stage=${s}`;

  const tabs = (
    <div className="flex gap-0.5 overflow-x-auto border-b border-stone-200 px-3" role="tablist">
      {STAGES.map((s) => (
        <Link
          key={s.key}
          href={tabHref(s.key)}
          role="tab"
          aria-selected={stage === s.key}
          className={
            "whitespace-nowrap border-b-2 px-2.5 pb-2 pt-3 text-[13px] font-medium " +
            (stage === s.key ? "border-[#D73F09] text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800")
          }
        >
          {s.label}
          <span className="ml-1 rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-500 tabular-nums">
            {stages.pending ? "—" : stages.counts[s.key]}
          </span>
        </Link>
      ))}
    </div>
  );

  let body: React.ReactNode;

  if (stages.pending) {
    body = (
      <div className="p-4">
        <PendingMigration migration="20261019_083_blended_admin_schema.sql" feature="Athlete stages" />
      </div>
    );
  } else if (stage === "audience") {
    body = (
      <AudienceStage
        campaignId={campaignId}
        q={q}
        stages={stages}
        pane={audiencePane}
        selected={selectedAudience}
      />
    );
  } else if (stage === "optins") {
    const rows = stages.optins.filter((r) => matches(q, r.person, r.instagram_username));
    body = (
      <>
        <Toolbar base={base} stage={stage} q={q} placeholder="Search athletes..." right={<span className="text-[12px] text-stone-500">{rows.length} rows</span>} />
        {rows.length === 0 ? (
          <>
            <Empty>{q ? "No opt-ins match." : "No opt-ins yet. Share the opt-in page to get started."}</Empty>
            <Foot>
              <span>Tick athletes to select them. They&apos;re told in the app and sign the contract there.</span>
            </Foot>
          </>
        ) : (
          <SelectOptinsForm campaignId={campaignId} action={selectAthletes}>
            <div className="p-3 md:p-0">
              <AdminTable<OptInRow>
                rows={rows}
                rowKey={(r) => String(r.campaign_opt_in_id)}
                columns={[
                  { key: "name", header: "Name", render: (r) => <WhoCell person={r.person} handle={r.instagram_username} /> },
                  { key: "followers", header: "Followers", align: "right", render: (r) => fmtNum(r.person?.instagram_followers) },
                  { key: "college", header: "College", render: (r) => r.person?.college_raw ?? <span className="text-stone-400">—</span> },
                  { key: "sport", header: "Sport", secondary: true, render: (r) => r.person?.sport ?? <span className="text-stone-400">—</span> },
                  { key: "agent", header: "Agent", secondary: true, render: (r) => <span className="text-stone-500">{r.person?.agency ?? "—"}</span> },
                  { key: "optin", header: "Opted in", render: (r) => <span className="text-stone-500">{fmtShortDate(r.date_optin)}</span> },
                  { key: "pick", header: "", align: "right", render: (r) => <PickToggle id={r.campaign_opt_in_id} /> },
                ]}
                mobile={{
                  title: (r) => personName(r.person) ?? r.instagram_username ?? "Unknown athlete",
                  subtitle: (r) => [r.person?.college_raw, r.person?.sport].filter(Boolean).join(" · ") || null,
                  strip: (r) => (
                    <>
                      <span className="text-stone-500">Opted in {fmtShortDate(r.date_optin)}</span>
                      <span className="ml-auto">
                        <PickToggle id={r.campaign_opt_in_id} />
                      </span>
                    </>
                  ),
                  figure: (r) => `${fmtNum(r.person?.instagram_followers)} followers`,
                }}
              />
            </div>
          </SelectOptinsForm>
        )}
      </>
    );
  } else if (stage === "selected") {
    const rows = stages.selected.filter((r) => matches(q, r.person, r.instagram_username));
    const signed = (r: OptInRow) => !!r.date_contract_sign || (r.person_id ? stages.contractFiles.has(r.person_id) : false);
    const content = (r: OptInRow) => (r.person_id ? stages.submissions.get(r.person_id) ?? null : null);
    const approved = rows.filter((r) => content(r) === "approved").length;
    body = (
      <>
        <Toolbar base={base} stage={stage} q={q} placeholder="Search athletes..." right={<span className="text-[12px] text-stone-500">{rows.length} rows</span>} />
        {rows.length === 0 ? (
          <Empty>{q ? "No selected athletes match." : "No one selected yet. Pick athletes on the Opt-ins tab."}</Empty>
        ) : (
          <div className="p-3 md:p-0">
            <AdminTable<OptInRow>
              rows={rows}
              rowKey={(r) => String(r.campaign_opt_in_id)}
              columns={[
                { key: "name", header: "Name", render: (r) => <WhoCell person={r.person} handle={r.instagram_username} /> },
                { key: "followers", header: "Followers", align: "right", render: (r) => fmtNum(r.person?.instagram_followers) },
                { key: "college", header: "College", secondary: true, render: (r) => r.person?.college_raw ?? <span className="text-stone-400">—</span> },
                { key: "agent", header: "Agent", secondary: true, render: (r) => <span className="text-stone-500">{r.person?.agency ?? "—"}</span> },
                {
                  key: "contract",
                  header: "Contract",
                  render: (r) =>
                    signed(r) ? (
                      <span className="text-status-ok">✓ Signed{r.date_contract_sign ? ` ${fmtShortDate(r.date_contract_sign)}` : ""}</span>
                    ) : (
                      <Pill tone="warn">Not signed</Pill>
                    ),
                },
                {
                  key: "content",
                  header: "Content",
                  render: (r) => {
                    const s = content(r);
                    return s ? <Pill tone={s === "approved" ? "ok" : "info"}>{s.replace(/_/g, " ")}</Pill> : <Pill tone="warn">Not uploaded</Pill>;
                  },
                },
                {
                  key: "state",
                  header: "",
                  align: "right",
                  render: (r) => (
                    <span className="text-[12px] text-stone-500">{r.date_paid ? "Paid" : r.date_selected ? `Selected ${fmtShortDate(r.date_selected)}` : ""}</span>
                  ),
                },
              ]}
              mobile={{
                title: (r) => personName(r.person) ?? r.instagram_username ?? "Unknown athlete",
                subtitle: (r) => r.person?.college_raw ?? null,
                strip: (r) => (
                  <>
                    {signed(r) ? <span className="text-status-ok">✓ Signed</span> : <Pill tone="warn">Not signed</Pill>}
                    {content(r) ? <Pill tone={content(r) === "approved" ? "ok" : "info"}>{content(r)}</Pill> : <Pill tone="warn">Not uploaded</Pill>}
                  </>
                ),
                figure: (r) => fmtNum(r.person?.instagram_followers),
              }}
            />
          </div>
        )}
        <Foot>
          <span>
            {rows.filter(signed).length} of {rows.length} signed · {approved} content approved
          </span>
          <Btn href="/dashboard/posting-instructions" small>
            Posting instructions
          </Btn>
        </Foot>
      </>
    );
  } else if (stage === "affiliates") {
    const rows = stages.affiliates.filter((r) => matches(q, r.person, r.ig));
    const paidOut = rows.reduce((t, r) => t + r.paid_out, 0);
    body = (
      <>
        <Toolbar base={base} stage={stage} q={q} placeholder="Search athletes..." right={<span className="text-[12px] text-stone-500">{rows.length} rows</span>} />
        {rows.length === 0 ? (
          <Empty>
            {q
              ? "No affiliate links match."
              : "No affiliate links yet. Set the affiliate link in Edit campaign; per-athlete links are generated from the old admin until that tool moves over."}
          </Empty>
        ) : (
          <div className="p-3 md:p-0">
            <AdminTable<AffiliateRow>
              rows={rows}
              rowKey={(r) => String(r.affiliate_id)}
              columns={[
                { key: "name", header: "Name", render: (r) => <WhoCell person={r.person} handle={r.ig} /> },
                {
                  key: "link",
                  header: "Affiliate link",
                  render: (r) => {
                    const url = r.short_url || r.link;
                    return url ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="max-w-[260px] truncate font-mono text-[12px] text-stone-700">{url.replace(/^https?:\/\//, "")}</span>
                        <CopyButton value={url} />
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    );
                  },
                },
                { key: "clicks", header: "Clicks", align: "right", render: (r) => fmtNum(r.clicks) },
                { key: "paid", header: "Paid out", align: "right", render: (r) => fmtMoney(r.paid_out) },
                { key: "status", header: "Status", render: (r) => (r.paid_out > 0 ? <Pill tone="ok">Paid</Pill> : <Pill tone="info">Earning</Pill>) },
              ]}
              mobile={{
                title: (r) => personName(r.person) ?? r.ig ?? "Unknown athlete",
                subtitle: (r) => (r.short_url || r.link)?.replace(/^https?:\/\//, "") ?? null,
                strip: (r) => <span className="text-stone-500">{fmtNum(r.clicks)} clicks</span>,
                figure: (r) => fmtMoney(r.paid_out),
              }}
            />
          </div>
        )}
        <Foot>
          <span>{fmtMoney(paidOut)} paid out so far</span>
          <Btn href="/admin/pay/affiliate" small>
            Affiliate payments
          </Btn>
        </Foot>
      </>
    );
  } else {
    const rows = stages.paid.filter((r) => matches(q, r.person, r.instagram_username));
    const total = rows.reduce((t, r) => t + Number(r.amount_paid ?? 0), 0);
    body = (
      <>
        <Toolbar base={base} stage={stage} q={q} placeholder="Search athletes..." right={<span className="text-[12px] text-stone-500">{rows.length} rows</span>} />
        {rows.length === 0 ? (
          <Empty>{q ? "No payouts match." : "Nobody paid yet. Payouts open once content is approved and posted."}</Empty>
        ) : (
          <div className="p-3 md:p-0">
            <AdminTable<OptInRow>
              rows={rows}
              rowKey={(r) => String(r.campaign_opt_in_id)}
              columns={[
                { key: "name", header: "Name", render: (r) => <WhoCell person={r.person} handle={r.instagram_username} /> },
                { key: "amount", header: "Amount", align: "right", render: (r) => fmtMoney(r.amount_paid) },
                { key: "method", header: "Method", render: (r) => r.method_paid ?? <span className="text-stone-400">—</span> },
                { key: "paidon", header: "Paid on", render: (r) => <span className="text-stone-500">{fmtShortDate(r.date_paid)}</span> },
                {
                  key: "batch",
                  header: "Batch",
                  secondary: true,
                  render: (r) =>
                    r.payment?.payout_batch_id ? (
                      <span className="font-mono text-[12px] text-stone-600">{r.payment.payout_batch_id}</span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (r.payment?.transaction_status ? <Pill tone="info">{r.payment.transaction_status}</Pill> : <Pill tone="ok">Paid</Pill>),
                },
              ]}
              mobile={{
                title: (r) => personName(r.person) ?? r.instagram_username ?? "Unknown athlete",
                subtitle: (r) => [r.method_paid, fmtShortDate(r.date_paid)].filter(Boolean).join(" · ") || null,
                figure: (r) => fmtMoney(r.amount_paid),
              }}
            />
          </div>
        )}
        <Foot>
          <span>
            {fmtMoney(total)} paid{budget != null ? ` of ${fmtMoney(budget)} budget` : ""}
          </span>
          <Btn href="/admin/pay" small>
            Payouts
          </Btn>
        </Foot>
      </>
    );
  }

  return (
    <Card title="Athletes" sub="Each athlete sits on the tab for how far they've got." pad={false}>
      {tabs}
      {body}
    </Card>
  );
}

// ------------------------------------------------------------
// Campaign audience: two panes
// ------------------------------------------------------------

function AudienceStage({
  campaignId,
  q,
  stages,
  pane,
  selected,
}: {
  campaignId: number;
  q: string;
  stages: AthleteStages;
  pane: AudiencePane;
  selected: string | null;
}) {
  const base = `/admin/campaigns/${campaignId}`;
  const cur = selected ? pane.attached.find((a) => a.audience_id === selected) ?? null : null;
  const total = pane.attached.reduce((t, a) => t + a.size, 0);
  const byPerson = new Map<string, OptInRow>();
  for (const r of stages.all) if (r.person_id) byPerson.set(r.person_id, r);

  const itemCls = (on: boolean) =>
    "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] " +
    (on ? "bg-white shadow-[inset_2px_0_0_#D73F09,0_1px_2px_rgba(0,0,0,.05)]" : "hover:bg-white");

  const aside = (
    <aside className="flex flex-col gap-0.5 border-b border-stone-200 bg-stone-50 p-2 md:border-b-0 md:border-r">
      <div className="px-2.5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Audiences</div>
      {pane.pending ? (
        <div className="px-2.5 pb-2 text-[12px] text-stone-500">
          Attaching saved audiences arrives with migration <code className="rounded bg-stone-200 px-1">20261020_084</code>. Until then this
          tab lists athletes who were invited directly.
        </div>
      ) : (
        <>
          <Link href={`${base}?stage=audience`} className={itemCls(!cur)}>
            <span className="min-w-0 flex-1 font-medium text-stone-900">All attached</span>
            <span className="text-[12px] text-stone-500 tabular-nums">{fmtNum(total)}</span>
          </Link>
          {pane.attached.map((a) => (
            <Link key={a.audience_id} href={`${base}?stage=audience&audience=${a.audience_id}`} className={itemCls(cur?.audience_id === a.audience_id)}>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-medium text-stone-900">{a.name}</span>
                <span className="flex items-center gap-1.5 text-[12px] text-stone-500">
                  <i className={"inline-block h-[7px] w-[7px] rounded-full border " + (a.invited_at ? "border-status-ok bg-status-ok" : "border-stone-300")} />
                  {a.invited_at ? `Invited · ${fmtNum(a.optin_count ?? 0)} opted in` : "Not invited yet"}
                </span>
              </span>
              <span className="text-[12px] text-stone-500 tabular-nums">{fmtNum(a.size)}</span>
            </Link>
          ))}
          {pane.attached.length === 0 && <div className="px-2.5 pb-2 text-[12px] text-stone-500">No audiences attached yet.</div>}
          <div className="mt-auto grid gap-2 border-t border-stone-200 px-2.5 pb-1 pt-2.5">
            {pane.available.length > 0 ? (
              <form action={attachAudience} className="flex gap-1.5">
                <input type="hidden" name="campaign_id" value={campaignId} />
                <select name="audience_id" defaultValue="" className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-[12px]" aria-label="Attach a saved audience">
                  <option value="">Choose a saved audience…</option>
                  {pane.available.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-md bg-[#D73F09] px-2 py-1 text-[12px] font-medium text-white">
                  Attach
                </button>
              </form>
            ) : (
              <span className="text-[12px] text-stone-500">No saved audiences to attach.</span>
            )}
            <TextLink href="/admin/audiences">+ Make an audience</TextLink>
          </div>
        </>
      )}
    </aside>
  );

  // Right pane rows: a selected audience's members, or the directly-invited list.
  type Row = { key: string; person: PersonLite | null; handle: string | null; opt: OptInRow | null };
  const rows: Row[] = cur
    ? (pane.members ?? []).map((p) => ({ key: p.id, person: p, handle: p.instagram_handle ?? null, opt: byPerson.get(p.id) ?? null }))
    : stages.audience
        .filter((r) => matches(q, r.person, r.instagram_username))
        .map((r) => ({ key: String(r.campaign_opt_in_id), person: r.person, handle: r.instagram_username, opt: r }));

  const status = (r: Row) =>
    r.opt?.is_optin ? <Pill tone="ok">Opted in</Pill> : r.opt?.is_invited || r.opt?.date_invited ? <Pill tone="info">Invited</Pill> : <Pill>Not invited</Pill>;

  const head = cur ? (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-1.5 pt-3.5 md:px-5">
      <div>
        <b className="text-[14px] text-stone-900">{cur.name}</b>
        <div className="text-[12px] text-stone-500">
          {fmtNum(cur.size)} athletes · attached {fmtShortDate(cur.attached_at)} ·{" "}
          {cur.invited_at ? `${fmtNum(cur.invited_count ?? 0)} invited · ${fmtNum(cur.optin_count ?? 0)} opted in` : "not invited yet"}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-stone-400" title="Inviting an audience from the Hub arrives with the invite slice">
          Invite · soon
        </span>
        <Btn href={`/admin/audiences/export?${new URLSearchParams(Object.entries(cur.filters).filter(([, v]) => typeof v === "string" && v !== "") as [string, string][]).toString()}`} small external>
          Download
        </Btn>
        <form action={detachAudience}>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="audience_id" value={cur.audience_id} />
          <button type="submit" className="rounded-md px-2.5 py-1 text-[12px] font-medium text-stone-500 hover:bg-stone-100">
            Remove
          </button>
        </form>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-1.5 pt-3.5 md:px-5">
      <div>
        <b className="text-[14px] text-stone-900">{pane.pending ? "Invited athletes" : "All attached audiences"}</b>
        <div className="text-[12px] text-stone-500">
          {pane.pending
            ? `${stages.audience.length} invited, still to opt in`
            : `${fmtNum(total)} athletes across ${pane.attached.length} audience${pane.attached.length === 1 ? "" : "s"} · ${stages.audience.length} invited, still to opt in`}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)]">
      {aside}
      <div className="min-w-0">
        {head}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-2.5 md:px-5">
          <form action={base} className="flex min-w-[200px] flex-1 items-center gap-2">
            <input type="hidden" name="stage" value="audience" />
            {cur && <input type="hidden" name="audience" value={cur.audience_id} />}
            <input type="search" name="q" defaultValue={q} placeholder="Search this audience..." className="w-full max-w-sm rounded-md border border-stone-300 px-3 py-1.5 text-[13px]" />
          </form>
          <span className="text-[12px] text-stone-500">
            {cur ? `${rows.length} of ${fmtNum(pane.membersTotal)} rows` : `${rows.length} rows`}
          </span>
        </div>
        {rows.length === 0 ? (
          <Empty>
            {cur
              ? q
                ? "No athletes in this audience match."
                : "No athletes match this audience's filters right now."
              : pane.attached.length
                ? "Everyone invited has opted in, or nobody has been invited yet."
                : "No audiences attached yet. Attach a saved audience or make a new one, then invite them."}
          </Empty>
        ) : (
          <div className="p-3 md:p-0">
            <AdminTable<Row>
              rows={rows}
              rowKey={(r) => r.key}
              columns={[
                { key: "who", header: "Athlete", render: (r) => <WhoCell person={r.person} handle={r.handle} /> },
                { key: "school", header: "School · sport", render: (r) => <SchoolSport p={r.person} /> },
                { key: "followers", header: "Followers", align: "right", render: (r) => fmtNum(r.person?.instagram_followers) },
                { key: "invited", header: "Invited", render: (r) => <span className="text-stone-500">{r.opt?.date_invited ? fmtShortDate(r.opt.date_invited) : "—"}</span> },
                { key: "status", header: "Status", render: status },
              ]}
              mobile={{
                title: (r) => personName(r.person) ?? r.handle ?? "Unknown athlete",
                subtitle: (r) => [r.person?.college_raw, r.person?.sport].filter(Boolean).join(" · ") || null,
                strip: status,
                figure: (r) => fmtNum(r.person?.instagram_followers),
              }}
            />
          </div>
        )}
        <Foot>
          <span>{stages.audience.length} invited, waiting to opt in.</span>
          <TextLink href="/admin/audiences">All saved audiences</TextLink>
        </Foot>
      </div>
    </div>
  );
}
