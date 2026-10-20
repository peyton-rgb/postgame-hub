// ============================================================
// Deal page draft — /admin/campaigns/[id]/deal. What a selected athlete
// sees for this campaign: welcome note, the steps in order (each linked
// to the matching page, or "+ Create first"), key dates, and the app
// phone preview on the right ("What the athlete sees").
// ============================================================

"use client";

import Link from "next/link";
import { useState } from "react";
import { shortDate, type DealDraft as Draft } from "@/lib/admin/campaigns/page-drafts";
import type { DealStep } from "@/lib/admin/campaigns/pages";
import { IPhoneFrame } from "../OptinPreview";
import s from "../optin.module.css";
import { DraftBar, DraftForm, Fld, Sec, input } from "./DraftShell";

export default function DealDraft({
  campaignId,
  campaignName,
  initial,
  filledFrom,
  status,
  exists,
  pending,
  steps,
  action,
}: {
  campaignId: number;
  campaignName: string;
  initial: Draft;
  filledFrom: string[];
  status: "draft" | "live";
  exists: boolean;
  pending: boolean;
  steps: DealStep[];
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const pay = d.pay || "—";
  const due = shortDate(d.content_due) || "—";
  const postWindow = [shortDate(d.post_start), shortDate(d.post_end)].filter(Boolean).join(" – ");

  const appSteps: [string, string][] = steps.map((st) => [
    st.title,
    st.linked
      ? st.key === "paid"
        ? "After posts"
        : st.key === "post" && postWindow
          ? postWindow
          : "Open"
      : "Coming soon",
  ]);

  return (
    <DraftForm
      campaignId={campaignId}
      campaignName={campaignName}
      kind="deal"
      title="Deal page"
      sub="What a selected athlete sees for this campaign: deliverables, dates, contract, upload, instructions and pay. Most of it reads from the campaign."
      status={status}
      exists={exists}
      pending={pending}
      content={d}
      filledFrom={filledFrom}
      action={action}
    >
      <DraftBar what="deal page" srcs={filledFrom} note="Deliverables, dates and pay came from the sources on the right." />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-3.5">
          <Sec n={1} title="Welcome note" form={false}>
            <label htmlFor="f-welcome" className="mb-1 block text-[12px] font-medium text-stone-600">
              Shown at the top once they&apos;re selected
            </label>
            <textarea id="f-welcome" rows={3} value={d.welcome} onChange={(e) => set("welcome")(e.target.value)} className={input} placeholder="You're in. Here's everything in one place." />
            {!d.welcome && <div className="mt-1 text-[12px] text-stone-500">Nothing on the campaign writes this for you; a line or two in your own words.</div>}
          </Sec>

          <Sec n={2} title="Steps, in order" form={false}>
            {steps.map((st, i) => (
              <div key={st.key} className="flex items-center gap-2.5 border-t border-stone-100 py-2 text-[13px] first:border-t-0">
                <span className="text-stone-400">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-stone-900">{st.title}</span>
                  <div className="text-stone-500">{st.sub}</div>
                </span>
                {st.linked ? (
                  <span className="text-[12px] text-status-ok">✓ Linked</span>
                ) : (
                  <Link href={st.href} className="text-[13px] font-medium text-[#D73F09] hover:underline">
                    + Create first
                  </Link>
                )}
              </div>
            ))}
            <div className="mt-1.5 text-[12px] text-stone-500">
              Each step opens the matching page. Steps without a page yet show as &quot;coming soon&quot; to the athlete.
            </div>
          </Sec>

          <Sec n={3} title="Key dates">
            <Fld label="You earn" name="pay" value={d.pay} onChange={set("pay")} sources={d.sources} placeholder="$250" hint="Fills in from the opt-in page's compensation line." />
            <Fld label="Content due" name="content_due" value={d.content_due} onChange={set("content_due")} sources={d.sources} type="date" hint="Fills in from the opt-in page timeline's Create step." />
            <Fld label="Post window starts" name="post_start" value={d.post_start} onChange={set("post_start")} sources={d.sources} type="date" hint="Fills in from the opt-in page timeline's Post step." />
            <Fld label="Post window ends" name="post_end" value={d.post_end} onChange={set("post_end")} type="date" />
            <Fld label="Paid by" name="paid_by" value={d.paid_by} onChange={set("paid_by")} sources={d.sources} type="date" hint="Fills in from the campaign's expected pay date." />
          </Sec>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-3">
          <div className="mb-2 flex items-center justify-between text-[12px] text-stone-500">
            <b className="text-[13px] text-stone-900">What the athlete sees</b>
            <span>App</span>
          </div>
          <div className={s.stage} style={{ padding: "16px 6px" }}>
            <IPhoneFrame>
              <div className={s.ap} style={{ padding: "64px 20px 30px" }}>
                <div className={s.eyebrow}>Your deal</div>
                <div className={s.h1} style={{ fontSize: 22 }}>
                  {campaignName}
                </div>
                <p className={s.p} style={{ marginTop: 6 }}>
                  {d.welcome || <span style={{ color: "#AAAAB0" }}>Welcome note goes here.</span>}
                </p>
                <div className={s.stats} style={{ margin: "14px 0" }}>
                  <div className={s.stat}>
                    <div className={s.lbl}>You earn</div>
                    <div className={s.val}>{pay}</div>
                  </div>
                  <div className={s.stat}>
                    <div className={s.lbl}>Content due</div>
                    <div className={s.val}>{due}</div>
                  </div>
                </div>
                {appSteps.map(([a, b], i) => (
                  <div key={a} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,.08)", color: "#fff" }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#1B1B21", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, minWidth: 0 }}>
                      {a}
                      <div className={s.sub} style={{ fontWeight: 400, margin: 0 }}>
                        {b}
                      </div>
                    </span>
                    <span style={{ opacity: 0.5 }}>›</span>
                  </div>
                ))}
              </div>
            </IPhoneFrame>
          </div>
        </aside>
      </div>
    </DraftForm>
  );
}
