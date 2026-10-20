// ============================================================
// /admin/pay/bonus-affiliate — Bonuses & affiliate. Exec-only (layout).
//
// Prototype S["bonus-affiliate"] / S["bonus-affiliate-aff"]: one card,
// two bookmarkable tabs.
//   (default)      Bonuses — payment_bonus rows (migration 083) plus the
//                  Hub payouts whose deal label says "bonus" (what the
//                  old /admin/pay/bonus screen showed). ?show=unpaid|paid|all
//   ?tab=affiliate Affiliate balances — earned / paid / owed per athlete
//                  from affiliate_earnings (083). ?sub=history lists
//                  affiliate_payments; ?sub=upload is the monthly
//                  report preview (moved from /admin/pay/affiliate).
//                  (?view= is the Rows / Cards toggle; the old
//                  ?view=history|upload links still open the sub-view.)
//
// Writes: bonus "Mark paid" (payment_bonus.date_paid) and the payout
// approve for bonus-labeled payouts — both confirmed POSTs with audit.
// "Add bonus" has no form yet (no write path decided) so it's shown
// disabled with the reason rather than as a dead button.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { Card, fmtShortDate } from "@/components/admin/campaign/bits";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import CsvPreview from "@/components/admin/CsvPreview";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import {
  AthleteCell,
  CampaignCell,
  CardTabs,
  MethodPill,
  MobileRow,
  PAY_RESULT_NOTES,
  PayCard,
  PayTable,
  Pending083,
  ResultNote,
  SegLinks,
  StatusPill,
  dollarsFmt,
} from "@/components/admin/pay/bits";
import {
  PAYOUT_SELECT,
  loadAffiliateBalances,
  loadAffiliatePayments,
  loadBonusRows,
  payoutName,
  shapePayout,
  type AffiliateBalance,
  type AffiliatePaymentRow,
} from "@/lib/admin/pay/queries";
import { markBonusPaid, markPayoutPaid } from "../actions";

export const dynamic = "force-dynamic";

type Show = "unpaid" | "paid" | "all";

interface BonusItem {
  key: string;
  who: string;
  pic: string | null;
  handle: string | null;
  campaign: { title: string | null; brandName: string | null; brandLogo: string | null };
  reason: string | null;
  amount: number | null;
  amountLabel: string | null;
  paidAt: string | null;
  bonusId?: number;
  payoutId?: string;
  payoutStatus?: string | null;
}

const BASE = "/admin/pay/bonus-affiliate";

export default async function BonusAffiliatePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();

  const tab = searchParams.tab === "affiliate" ? "affiliate" : "bonuses";
  const show: Show = searchParams.show === "paid" || searchParams.show === "all" ? searchParams.show : "unpaid";
  const subRaw = searchParams.sub ?? searchParams.view;
  const sub = subRaw === "history" || subRaw === "upload" ? subRaw : "balances";
  const layout = getListView("pay-bonus-affiliate", searchParams);
  const toggle = <ViewToggle listKey="pay-bonus-affiliate" view={layout} />;
  const note = searchParams.result ? PAY_RESULT_NOTES[searchParams.result] : undefined;

  // Bonus count for the tab pill is always the unpaid count.
  let payoutQ = supabase.from("payouts").select(PAYOUT_SELECT).ilike("amount_label", "%bonus%").order("created_at", { ascending: false }).limit(300);
  if (tab === "bonuses" && show === "unpaid") payoutQ = payoutQ.eq("status", "pending");
  if (tab === "bonuses" && show === "paid") payoutQ = payoutQ.eq("status", "paid");

  const [unpaidBonus, unpaidPayoutBonus, bonusRows, payoutRes, balances, history] = await Promise.all([
    loadBonusRows(supabase, "unpaid"),
    supabase.from("payouts").select("id", { count: "exact", head: true }).ilike("amount_label", "%bonus%").eq("status", "pending"),
    tab === "bonuses" ? loadBonusRows(supabase, show) : Promise.resolve(null),
    tab === "bonuses" ? payoutQ : Promise.resolve(null),
    tab === "affiliate" && sub === "balances" ? loadAffiliateBalances(supabase) : Promise.resolve(null),
    tab === "affiliate" && sub === "history" ? loadAffiliatePayments(supabase) : Promise.resolve(null),
  ]);

  const bonusCount = (unpaidBonus.pending || unpaidBonus.error ? 0 : unpaidBonus.rows.length) + (unpaidPayoutBonus.count ?? 0);

  const header = (
    <PageHeader
      title="Bonuses & affiliate"
      subtitle="Extra payments, and what athletes have earned from affiliate links."
      actions={
        tab === "bonuses" ? (
          <button
            type="button"
            disabled
            title="Adding a bonus needs the payment_bonus table (migration 083) and a write path — not wired yet"
            className="cursor-not-allowed rounded-md bg-stone-200 px-2.5 py-1.5 text-[12px] font-medium text-stone-500"
          >
            + Add bonus
          </button>
        ) : undefined
      }
    />
  );

  const tabs = (
    <CardTabs
      active={tab}
      tabs={[
        { key: "bonuses", label: "Bonuses", href: BASE, count: bonusCount, showCount: true },
        { key: "affiliate", label: "Affiliate balances", href: `${BASE}?tab=affiliate` },
      ]}
    />
  );

  // ---------------- Bonuses ----------------
  if (tab === "bonuses") {
    if (payoutRes?.error) {
      return (
        <div>
          {header}
          <ErrorNote message={payoutRes.error.message} />
        </div>
      );
    }
    const items: BonusItem[] = [];
    for (const b of bonusRows?.rows ?? []) {
      items.push({
        key: `b-${b.payment_bonus_id}`,
        who: b.personName ?? (b.instagram_username ? `@${b.instagram_username.replace(/^@/, "")}` : "—"),
        pic: b.personPic,
        handle: b.personName ? b.instagram_username : null,
        campaign: { title: b.campaignName, brandName: b.brandName, brandLogo: b.brandLogo },
        reason: null,
        amount: b.amount != null ? Number(b.amount) : null,
        amountLabel: null,
        paidAt: b.date_paid,
        bonusId: b.payment_bonus_id,
      });
    }
    for (const r of (payoutRes?.data ?? []).map(shapePayout)) {
      items.push({
        key: `p-${r.id}`,
        who: payoutName(r),
        pic: r.profiles?.avatar_url ?? null,
        handle: r.profiles?.ig_handle ?? null,
        campaign: { title: r.campaign?.title ?? null, brandName: r.campaign?.brandName ?? null, brandLogo: r.campaign?.brandLogo ?? null },
        reason: r.amount_label,
        amount: r.amount_cents != null ? r.amount_cents / 100 : null,
        amountLabel: r.amount_cents == null ? r.amount_label : null,
        paidAt: r.paid_at,
        payoutId: r.id,
        payoutStatus: r.status,
      });
    }

    const ret = (
      <>
        <input type="hidden" name="return_to" value={BASE} />
        {show !== "unpaid" && <input type="hidden" name="return_show" value={show} />}
      </>
    );
    const amt = (i: BonusItem) => (i.amount != null ? dollarsFmt(i.amount, i.amount % 1 !== 0) : (i.amountLabel ?? "—"));
    const action = (i: BonusItem) => {
      if (i.bonusId != null && !i.paidAt)
        return (
          <form action={markBonusPaid}>
            <input type="hidden" name="payment_bonus_id" value={i.bonusId} />
            {ret}
            <ConfirmSubmit summary={`Mark the ${amt(i)} bonus to ${i.who} as paid? Only do this once the money has gone out. Logged to the audit trail.`} confirmLabel="Mark paid">
              Mark paid
            </ConfirmSubmit>
          </form>
        );
      if (i.payoutId && i.payoutStatus === "pending")
        return (
          <form action={markPayoutPaid}>
            <input type="hidden" name="id" value={i.payoutId} />
            {ret}
            <ConfirmSubmit summary={`Mark the ${amt(i)} bonus payout to ${i.who} as PAID? This stamps paid_at now and is logged. It does not move money.`} confirmLabel="Mark paid">
              Mark paid
            </ConfirmSubmit>
          </form>
        );
      return i.paidAt ? <span className="text-[12px] text-stone-500">Paid {fmtShortDate(i.paidAt)}</span> : i.payoutStatus ? <StatusPill status={i.payoutStatus} /> : null;
    };

    return (
      <div>
        {header}
        {note && <ResultNote tone={note.tone}>{note.text}</ResultNote>}
        <Card pad={false}>
          {tabs}
          <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2.5 md:px-4">
            <SegLinks
              active={show}
              items={[
                { key: "unpaid", label: "Unpaid", href: BASE },
                { key: "paid", label: "Paid", href: `${BASE}?show=paid` },
                { key: "all", label: "All", href: `${BASE}?show=all` },
              ]}
            />
            <div className="ml-auto">{toggle}</div>
          </div>
          <PayTable<BonusItem>
            rows={items}
            rowKey={(i) => i.key}
            view={layout}
            card={(i) => (
              <PayCard
                top={<AthleteCell name={i.who} pic={i.pic} handle={i.handle} href={i.payoutId ? `/admin/pay/${i.payoutId}` : undefined} />}
                figure={amt(i)}
                details={[
                  { label: "Campaign", value: <CampaignCell {...i.campaign} /> },
                  { label: "Reason", value: i.reason ?? "—" },
                ]}
                actions={action(i)}
              />
            )}
            emptyLabel={show === "unpaid" ? "No unpaid bonuses." : show === "paid" ? "No bonuses have been paid in the Hub yet." : "No bonuses in the Hub yet."}
            columns={[
              { key: "who", header: "Athlete", render: (i) => <AthleteCell name={i.who} pic={i.pic} handle={i.handle} href={i.payoutId ? `/admin/pay/${i.payoutId}` : undefined} /> },
              { key: "camp", header: "Campaign", render: (i) => <CampaignCell {...i.campaign} /> },
              { key: "reason", header: "Reason", secondary: true, render: (i) => <span className="text-stone-600">{i.reason ?? "—"}</span> },
              { key: "amount", header: "Amount", align: "right", render: (i) => <span className="font-semibold text-stone-900">{amt(i)}</span> },
              { key: "act", header: "", align: "right", render: (i) => <span className="inline-flex justify-end">{action(i)}</span> },
            ]}
            mobile={(i) => (
              <MobileRow
                top={<AthleteCell name={i.who} pic={i.pic} handle={i.handle} href={i.payoutId ? `/admin/pay/${i.payoutId}` : undefined} />}
                figure={amt(i)}
                strip={<span className="truncate">{[i.campaign.title, i.reason].filter(Boolean).join(" · ") || "—"}</span>}
                actions={action(i)}
              />
            )}
          />
          {bonusRows?.pending && (
            <div className="border-t border-stone-200 px-4 py-2.5 text-[12px] text-stone-500 md:px-5">
              The bonus ledger (payment_bonus) arrives with migration 083 — until then this lists only Hub payouts whose deal label says &ldquo;bonus&rdquo;.
            </div>
          )}
          {bonusRows?.error && <div className="border-t border-stone-200 px-4 py-2.5 text-[12px] text-status-bad">{bonusRows.error}</div>}
        </Card>
      </div>
    );
  }

  // ---------------- Affiliate ----------------
  const viewSeg = (
    <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2.5 md:px-4">
      <SegLinks
        active={sub}
        items={[
          { key: "balances", label: "Balances", href: `${BASE}?tab=affiliate` },
          { key: "history", label: "Payout history", href: `${BASE}?tab=affiliate&sub=history` },
          { key: "upload", label: "Monthly upload", href: `${BASE}?tab=affiliate&sub=upload` },
        ]}
      />
      {sub !== "upload" && <div className="ml-auto">{toggle}</div>}
    </div>
  );

  return (
    <div>
      {header}
      {note && <ResultNote tone={note.tone}>{note.text}</ResultNote>}
      <Card pad={false}>
        {tabs}
        {viewSeg}

        {sub === "balances" &&
          (balances?.pending ? (
            <Pending083 feature="Affiliate balances" />
          ) : balances?.error ? (
            <div className="px-4 py-6 text-[13px] text-status-bad">{balances.error}</div>
          ) : (
            <PayTable<AffiliateBalance>
              rows={balances?.rows ?? []}
              rowKey={(r) => r.key}
              view={layout}
              card={(r) => (
                <PayCard
                  top={
                    <AthleteCell
                      name={r.personName ?? (r.instagram_username ? `@${r.instagram_username.replace(/^@/, "")}` : "—")}
                      pic={r.personPic}
                      handle={r.personName ? r.instagram_username : null}
                    />
                  }
                  figure={dollarsFmt(Math.max(0, r.earned - r.paid), true)}
                  details={[
                    { label: "Brand", value: r.programs.join(", ") || "—" },
                    { label: "Earned", value: dollarsFmt(r.earned, true) },
                    { label: "Paid", value: dollarsFmt(r.paid, true) },
                  ]}
                />
              )}
              emptyLabel="No affiliate earnings in the Hub yet."
              columns={[
                {
                  key: "who",
                  header: "Athlete",
                  render: (r) => (
                    <AthleteCell
                      name={r.personName ?? (r.instagram_username ? `@${r.instagram_username.replace(/^@/, "")}` : "—")}
                      pic={r.personPic}
                      handle={r.personName ? r.instagram_username : null}
                    />
                  ),
                },
                { key: "prog", header: "Brand", render: (r) => <span className="text-stone-600">{r.programs.join(", ") || "—"}</span> },
                { key: "earned", header: "Earned", align: "right", render: (r) => dollarsFmt(r.earned, true) },
                { key: "paid", header: "Paid", align: "right", render: (r) => dollarsFmt(r.paid, true) },
                { key: "owed", header: "Owed", align: "right", render: (r) => <span className="font-semibold text-stone-900">{dollarsFmt(Math.max(0, r.earned - r.paid), true)}</span> },
              ]}
              mobile={(r) => (
                <MobileRow
                  top={<AthleteCell name={r.personName ?? (r.instagram_username ? `@${r.instagram_username.replace(/^@/, "")}` : "—")} pic={r.personPic} />}
                  figure={dollarsFmt(Math.max(0, r.earned - r.paid), true)}
                  strip={
                    <span>
                      {r.programs.join(", ") || "—"} · earned {dollarsFmt(r.earned)} · paid {dollarsFmt(r.paid)}
                    </span>
                  }
                />
              )}
            />
          ))}

        {sub === "history" &&
          (history?.pending ? (
            <Pending083 feature="Affiliate payouts" />
          ) : history?.error ? (
            <div className="px-4 py-6 text-[13px] text-status-bad">{history.error}</div>
          ) : (
            <PayTable<AffiliatePaymentRow>
              rows={history?.rows ?? []}
              rowKey={(r) => String(r.affiliate_payment_id)}
              view={layout}
              card={(r) => (
                <PayCard
                  top={<AthleteCell name={r.personName ?? "—"} pic={r.personPic} />}
                  figure={dollarsFmt(r.payment, true)}
                  strip={<MethodPill method={r.payment_method} />}
                  details={[
                    { label: "Program", value: r.program ?? "—" },
                    { label: "Paid", value: fmtShortDate(r.payment_date) },
                  ]}
                />
              )}
              emptyLabel="No affiliate payouts in the Hub yet."
              columns={[
                { key: "who", header: "Athlete", render: (r) => <AthleteCell name={r.personName ?? "—"} pic={r.personPic} /> },
                { key: "prog", header: "Program", render: (r) => <span className="text-stone-600">{r.program ?? "—"}</span> },
                { key: "method", header: "Method", secondary: true, render: (r) => <MethodPill method={r.payment_method} /> },
                { key: "date", header: "Paid", render: (r) => <span className="text-stone-600">{fmtShortDate(r.payment_date)}</span> },
                { key: "amt", header: "Amount", align: "right", render: (r) => <span className="font-semibold text-stone-900">{dollarsFmt(r.payment, true)}</span> },
              ]}
              mobile={(r) => (
                <MobileRow
                  top={<AthleteCell name={r.personName ?? "—"} pic={r.personPic} />}
                  figure={dollarsFmt(r.payment, true)}
                  strip={<span>{[r.program, fmtShortDate(r.payment_date)].filter(Boolean).join(" · ")}</span>}
                />
              )}
            />
          ))}

        {sub === "upload" && (
          <div className="px-4 py-4 md:px-5">
            <h2 className="pb-3 text-[13px] font-semibold text-stone-900">Upload the monthly affiliate report</h2>
            <CsvPreview />
            <p className="mt-3 text-[12px] text-stone-500">
              Preview works now. Applying it needs the affiliate tables (migration 083) — no apply button until the write has somewhere real to go.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
